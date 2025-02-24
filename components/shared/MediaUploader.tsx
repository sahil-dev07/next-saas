"use client";
import { useToast } from "@/components/ui/use-toast"
import { CldImage, CldUploadWidget } from 'next-cloudinary'
import { dataUrl, getImageSize } from "@/lib/utils";
import { PlaceholderValue } from "next/dist/shared/lib/get-img-props";
import Image from "next/image";

type MediaUploderProps = {
    onValueChange: (value: string) => void;
    setImage: React.Dispatch<any>;
    publicId: string;
    image: any;
    type: string;
}

const MediaUploader = ({
    onValueChange,
    setImage,
    image,
    publicId,
    type
}: MediaUploderProps) => {
    const { toast } = useToast()
    const handleDiscardImage = () => {
        setImage(null); // Reset image state
        onValueChange(""); // Reset the publicId field
        toast({
          title: "Image removed",
          description: "You can upload a new image.",
          duration: 3000,
          className: "success-toast",
        });
      };

    const onUploadSuccessHandler = (result: any) => {
        setImage((prevState: any) => ({
            ...prevState,
            publicId: result?.info?.public_id,
            width: result?.info?.width,
            height: result?.info?.height,
            secureURL: result?.info?.secure_url,
        }))

        onValueChange(result?.info?.public_id)

        toast({
            title: 'Image uploaded Successfully',
            description: 'One Credit was deducted from your account',
            duration: 3000,
            className: "success-toast"
        })
    }

    const onUploadErrorHandler = () => {
        toast({
            title: 'Something Went Wrong, While Uploading',
            description: 'Please try again',
            duration: 3000,
            className: "error-toast"
        })
    }

    return (

        <CldUploadWidget
            uploadPreset="jsm_imaginify"
            options={{
                multiple: false,
                resourceType: "image",
            }}
            onSuccess={onUploadSuccessHandler}
            onError={onUploadErrorHandler}
        >
            {({ open }) => (
                <div className="flex flex-col gap-4">
                    <h3 className="h3-bold text-dark-600">Original</h3>

                    {publicId ? (
                        <>
                            <div className="cursor-pointer overflow-hidden rounded-[10px]">
                                <CldImage
                                    className="media-uploader_cldImage"
                                    src={publicId}
                                    width={getImageSize(type, image, "width")}
                                    height={getImageSize(type, image, "height")}
                                    alt="image"
                                    sizes={"(max-width: 767px) 100vw, 50vw "}
                                    placeholder={dataUrl as PlaceholderValue}
                                />
                            </div>
                            <button
                                type="button"
                                className="discard-button bg-red-500 text-white px-4 py-2 rounded"
                                onClick={handleDiscardImage}
                            >
                                Discard Image
                            </button>
                        </>
                    ) : (
                        <div
                            className="media-uploader_cta"
                            onClick={() => open()}
                        >
                            <div className="media-uploader_cta-image">
                                <Image
                                    src={"/assets/icons/add.svg"}
                                    alt="Add Image"
                                    width={24}
                                    height={24} />
                            </div>
                            <p className="p-14-medium">Click here to upload image</p>
                        </div>
                    )

                    }
                </div>
            )}
        </CldUploadWidget>

    )
}

export default MediaUploader