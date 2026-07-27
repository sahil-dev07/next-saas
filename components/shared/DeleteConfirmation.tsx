"use client";

import { useTransition } from "react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { deleteImage } from "@/lib/actions/image.actions";

import { Button } from "../ui/button";

export const DeleteConfirmation = ({ imageId }: { imageId: string }) => {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild className="w-full rounded-full">
                <Button
                    type="button"
                    className="button h-[44px] w-full md:h-[54px]"
                    variant="destructive"
                >
                    Delete Image
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="flex flex-col gap-10">
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Are you sure you want to delete this image?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="p-16-regular">
                        This will permanently delete this image
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="border bg-red-500 text-white hover:bg-red-600"
                        onClick={() =>
                            startTransition(async () => {
                                // try/catch is required under React 19: a rejected async
                                // transition is re-thrown during render and escalates to the
                                // root error boundary (app/error.tsx), replacing the page with
                                // the error screen. (React 18 only logged it.) deleteImage
                                // rethrows via handleError on auth/IDOR/not-found failures; the
                                // success path redirects server-side and never reaches here.
                                try {
                                    await deleteImage(imageId);
                                } catch (error) {
                                    console.error("deleteImage failed:", error);
                                    toast({
                                        title: "Delete failed",
                                        description:
                                            "Could not delete this image. Please try again.",
                                        duration: 3000,
                                        className: "error-toast",
                                    });
                                }
                            })
                        }
                    >
                        {isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};