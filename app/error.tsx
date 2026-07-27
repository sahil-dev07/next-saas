"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

// App Router global error boundary. Server actions rethrow via handleError, so a
// surfaced error lands here in the UI instead of a blank crash.
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Client-side telemetry hook (swap for a real logger later).
        console.error(error)
    }, [error])

    return (
        <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
            <h2 className="h2-bold text-dark-600">Something went wrong</h2>
            <p className="p-16-regular text-dark-400">
                An unexpected error occurred. Please try again.
            </p>
            <Button onClick={reset} className="submit-button">
                Try again
            </Button>
        </main>
    )
}
