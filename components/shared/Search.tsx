"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { formUrlQuery, removeKeysFromQuery } from "@/lib/utils";

export const Search = () => {
    const router = useRouter();
    const searchParams = useSearchParams();

    // The query as it currently exists in the URL — the source of truth.
    const urlQuery = searchParams.get("query") ?? "";

    // Seeded from the URL so a shared or reloaded `?query=` link shows its term in the box
    // and stays filtered. Starting at "" made state and URL disagree: the effect either
    // wiped the filter on mount, or (once guarded) left a filtered list with an empty box.
    const [query, setQuery] = useState(urlQuery);

    // Last query value this component is known to be in sync with, used to tell an external
    // URL change apart from one we caused ourselves.
    const lastSyncedQuery = useRef(urlQuery);

    // Adopt URL changes that did NOT come from typing here — Back/Forward, or a link.
    // Without this, the push effect below would fire on the external change while `query`
    // still held the old text and shove that stale value back into the URL, making the
    // browser Back button appear broken.
    useEffect(() => {
        if (urlQuery !== lastSyncedQuery.current) {
            lastSyncedQuery.current = urlQuery;
            setQuery(urlQuery);
        }
    }, [urlQuery]);

    // Debounced: reflect local typing into the URL.
    useEffect(() => {
        // Already in sync — nothing to push. This is what suppresses the redundant self
        // -navigation on mount (which Next 15's staleTimes.dynamic=0 turns into a real extra
        // server render of the page). It is a pure value comparison, so unlike the previous
        // first-render ref it is idempotent under React StrictMode's dev double-invoke.
        if (query === urlQuery) return;

        const delayDebounceFn = setTimeout(() => {
            const newUrl = query
                ? formUrlQuery({
                    searchParams: searchParams.toString(),
                    key: "query",
                    value: query,
                })
                : removeKeysFromQuery({
                    searchParams: searchParams.toString(),
                    keysToRemove: ["query"],
                });

            lastSyncedQuery.current = query;
            router.push(newUrl, { scroll: false });
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [router, searchParams, query, urlQuery]);

    return (
        <div className="search">
            <Image
                src="/assets/icons/search.svg"
                alt="search"
                width={24}
                height={24}
            />

            {/* Controlled so the seeded query from the URL is visible to the user. */}
            <Input
                className="search-field"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
        </div>
    );
};