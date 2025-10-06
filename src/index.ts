import express, { Request, Response } from "express";
import {serve} from "inngest/express"
import {inngest} from "./inngest/index"
import {functions as inggestFunctions} from "./inngest/functions"
import {logger} from "./utils/logger"
import dotenv from "dotenv"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import authRoutes from "./routes/auth"
import { errorHandler } from "./middleware/errorHandler";
import chatRouter from "./routes/chat"
import moodRouter from "./routes/mood"
import activityRouter from "./routes/activity"
import { connectDB } from "./utils/db"; 

// Load environtment variables
dotenv.config()

// inisialisasi express
const app = express();

// middleware
app.use(cors()); // Mengaktifkan CORS untuk semua route
app.use(helmet()); // Menyetel security-related HTTP headers
app.use(morgan("dev")); // Log HTTP requests ke console

// Parse JSON
app.use(express.json());

  // set up endpoint inggest
app.use("/api/inngest", serve({client: inngest, functions:inggestFunctions}))

// routes
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});
app.use("/auth", authRoutes)
app.use("/chat", chatRouter)
app.use("/api/mood", moodRouter)
app.use("/api/activity", activityRouter)

// Error handling
app.use(errorHandler)

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Then start the server
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(
        `Inngest endpoint available at http://localhost:${PORT}/api/inngest`
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();