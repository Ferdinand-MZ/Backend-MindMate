import mongoose, {Document, Schema} from "mongoose"

export interface ISession extends Document {
    userId: mongoose.Types.ObjectId
    token: string
    expiresAt: Date
    deviceinfo?: string
    lastActive: Date
}

const SessionSchema = new Schema<ISession>(
    {
        userId: {type: Schema.Types.ObjectId, ref:"User", required: true},
        token: {type: String, required: true, unique: true},
        expiresAt: {type: Date, required: true},
    },
    {timestamps: true}
)

// index untuk pembersihan otomatis dari sesi lama
SessionSchema.index({ExpiresAt: 1})

// Mengeksport model Session
export const Session = mongoose.model<ISession>("Session", SessionSchema)