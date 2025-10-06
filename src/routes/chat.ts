import express from "express";
import {
    sendMessage,
    getSessionHistory,
    getChatSession,
    getChatHistory,
    createChatSession
} from "../controllers/chat";

import { auth } from "@/middleware/auth";

const router = express.Router();
router.post("/sessions", createChatSession)
router.get("/sessions/:sessionId", getChatSession);
router.post("/sessions/:sessionId/messages", sendMessage);

export default router;
