import { Document, Schema, model, models } from "mongoose";

export interface IImage extends Document {
    title: string;
    transformationType: string;
    publicId: string;
    secureURL: String;
    width?: number;
    height?: number;
    config?: object;
    transformationUrl?: String;
    aspectRatio?: string;
    color?: string;
    prompt?: string;
    author?: {
        _id: String,
        firstName: String,
        lastName: String
    }
    createdAt?: Date;
    updatedAt?: Date;
}


const ImageSchema = new Schema({
    title: { type: String, required: true },
    transformationType: { type: String, required: true },
    publicId: { type: String, required: true },
    secureURL: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    config: { type: Object },
    transformationUrl: { type: String },
    aspectRatio: { type: String },
    color: { type: String },
    prompt: { type: String },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })
// `timestamps: true` lets mongoose manage createdAt + updatedAt automatically. This
// replaces the hand-rolled fields, one of which was misspelled `updateAt` (no 'd') —
// so `getUserImages`' `.sort({ updatedAt: -1 })` sorted on a non-existent field and
// silently no-op'd. The canonical `updatedAt` now exists and updates on every write.


const Image = models?.Image || model("Image", ImageSchema);

export default Image;