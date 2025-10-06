import mongoose from "mongoose"
import {logger} from "./logger"

const MONGODB_URI =
    "mongodb+srv://ferdinandmaulanazafauzi:Pendekar203@mindmate.wfzp3rt.mongodb.net/?retryWrites=true&w=majority&appName=MindMate"

export const connectDB = async () => {
    try {
        // Nunggu sampai mongodb konek
        await mongoose.connect(MONGODB_URI)
        logger.info("Terhubung ke MongoDB Atlas")
    } catch(error) {
        logger.error("Koneksi MongoDB error:", error)
        process.exit(1)
    }
}