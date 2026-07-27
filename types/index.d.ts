/* eslint-disable no-unused-vars */

// ====== USER PARAMS
declare type CreateUserParams = {
    clerkId: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    photo: string;
};

declare type UpdateUserParams = {
    firstName: string;
    lastName: string;
    username: string;
    photo: string;
};

// ====== IMAGE PARAMS
declare type AddImageParams = {
    image: {
        title: string;
        publicId: string;
        transformationType: string;
        width: number;
        height: number;
        config: any;
        secureURL: string;
        transformationUrl: string;
        aspectRatio: string | undefined;
        prompt: string | undefined;
        color: string | undefined;
    };
    path: string;
};

declare type UpdateImageParams = {
    image: {
        _id: string;
        title: string;
        publicId: string;
        transformationType: string;
        width: number;
        height: number;
        config: any;
        secureURL: string;
        transformationUrl: string;
        aspectRatio: string | undefined;
        prompt: string | undefined;
        color: string | undefined;
    };
    path: string;
};

declare type Transformations = {
    restore?: boolean;
    fillBackground?: boolean;
    remove?: {
        prompt: string;
        removeShadow?: boolean;
        multiple?: boolean;
    };
    recolor?: {
        prompt?: string;
        to: string;
        multiple?: boolean;
    };
    removeBackground?: boolean;
};

// ====== TRANSACTION PARAMS
declare type CheckoutTransactionParams = {
    planId: number;
};

declare type CreateTransactionParams = {
    stripeId: string;
    amount: number;
    credits: number;
    plan: string;
    buyerId: string;
    createdAt: Date;
};

declare type TransformationTypeKey =
    | "restore"
    | "fill"
    | "remove"
    | "recolor"
    | "removeBackground";

// ====== URL QUERY PARAMS
declare type FormUrlQueryParams = {
    searchParams: string;
    key: string;
    value: string | number | null;
};

declare type UrlQueryParams = {
    params: string;
    key: string;
    value: string | null;
};

declare type RemoveUrlQueryParams = {
    searchParams: string;
    keysToRemove: string[];
};

// NOTE: the old `SearchParamProps` alias was removed in the Next 15 upgrade. It typed
// `params`/`searchParams` as plain (non-Promise) objects, which Next 15's generated per-route
// PageProps check rejects — both are Promises now. It also merged three different routes'
// params into one shape. Each page now types its own awaited params/searchParams Promise inline.

declare type TransformationFormProps = {
    action: "Add" | "Update";
    type: TransformationTypeKey;
    creditBalance: number;
    data?: IImage | null;
    config?: Transformations | null;
};

declare type TransformedImageProps = {
    image: any;
    type: string;
    title: string;
    transformationConfig: Transformations | null;
    isTransforming: boolean;
    hasDownload?: boolean;
    setIsTransforming?: React.Dispatch<React.SetStateAction<boolean>>;
};