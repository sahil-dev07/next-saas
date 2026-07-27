import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import Header from "@/components/shared/Header";
import TransformationForm from "@/components/shared/TransformationForm";
import { transformationTypes } from "@/constants";
import { getUserById } from "@/lib/actions/user.actions";
import { getImageById } from "@/lib/actions/image.actions";

// Next 15: `params` is a Promise — destructure after awaiting, not in the signature.
const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) redirect("/sign-in");

    const user = await getUserById(userId);
    const image = await getImageById(id);

    const transformation =
        transformationTypes[image.transformationType as TransformationTypeKey];

    // Guard against a stored image whose transformationType isn't a known key —
    // dereferencing .title/.subTitle on undefined would crash the page.
    if (!transformation) redirect("/");

    return (
        <>
            <Header title={transformation.title} subtitle={transformation.subTitle} />

            <section className="mt-10">
                <TransformationForm
                    action="Update"
                    type={image.transformationType as TransformationTypeKey}
                    creditBalance={user.creditBalance}
                    config={image.config}
                    data={image}
                />
            </section>
        </>
    );
};

export default Page;