import express from "express";
import { auth } from "../middleware/auth";
import { createMood } from "../controllers/moodController"

const router = express.Router();

// Semua rute di sini memerlukan autentikasi
router.use(auth)

// Track Mood baru
router.post("/", createMood);

export default router;

