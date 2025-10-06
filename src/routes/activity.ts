import express from "express";
import { auth } from "../middleware/auth";
import { logActivity } from "../controllers/activityController";

const router = express.Router();
router.use(auth);

// Log Aktivitas baru
router.post("/", logActivity);
export default router;
