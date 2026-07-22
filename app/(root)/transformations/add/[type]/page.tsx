import Header from '@/components/shared/Header'
import TransformationForm from '@/components/shared/TransformationForm';
import { transformationTypes } from '@/constants'
import { getUserById } from '@/lib/actions/user.actions';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Next 15: `params` is a Promise — destructure after awaiting. `type` stays narrowed to
// TransformationTypeKey because it indexes the `transformationTypes` lookup below.
const AddTransformationTypePage = async ({ params }: {
    params: Promise<{ type: TransformationTypeKey }>
}) => {
    const { type } = await params;
    const { userId } = await auth();
    const transformation = transformationTypes[type];

    if (!userId) redirect('/sign-in')

    const user = await getUserById(userId);

    return (
        <>
            <Header
                title={transformation.title}
                subtitle={transformation.subTitle}
            />

            <section className="mt-10">
                <TransformationForm
                    action="Add"
                    userId={user._id}
                    type={transformation.type as TransformationTypeKey}
                    creditBalance={user.creditBalance}
                />
            </section>
        </>
    )
}

export default AddTransformationTypePage