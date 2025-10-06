import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";    
import { logger } from "../utils/logger";
import {inngest} from "../inngest/index";
import {User} from "../models/User";
import { ChatSession, IChatSession } from "../models/ChatSession";
import { Types } from "mongoose";
import { Session } from "inspector/promises";
import { InngestSessionResponse, InngestEvent } from "../types/inngest";
import { GoogleGenAI } from "@google/genai";


// initialize Gemini API
const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || 'AIzaSyD3pQcrDDOR3cnUj84Rw0Cmk4Y823inPU8'
})

// Membuat Sesi Chat
export const createChatSession = async (req: Request, res: Response) => {
    try{
        if (!req.user || !req.user.id) {
        return res.status(401).json({message: "User belum terautentikasi"});        
    }

    const userId = new Types.ObjectId(req.user.id);
    const user = await User.findById(userId);

    if(!user) {
        return res.status(404).json({message: "User tidak ditemukan"});
    }

    // generate id sesi unik
    const sessionId = uuidv4();

    const session = new ChatSession({
        sessionId,
        userId,
        startTime: new Date(),
        status: "active",
        messages: [],
    }) 
    await session.save();

    res.status(201).json({messages: "Sesi chat berhasil dibuat", sessionId: session.sessionId});
    } catch(error) {
        logger.error("Error membuat sesi chat:", error)
        res.status(500).json({message: "Error membuat sesi chat", error: error instanceof Error ? error.message : "Error tidak diketahui", });
    }
}

export const sendMessage = async (req: Request, res: Response) => {
    try {
        const {sessionId} = req.params;
        const {message} = req.body;
        const userId = new Types.ObjectId(req.user.id);

        logger.info("Memproses Pesan:", {sessionId, message})

        // Mencari Sesi dengan sessionId
        const session = await ChatSession.findOne({sessionId});
        
        if (!session) {
            logger.warn("Sesi chat tidak ditemukan:", {sessionId});
            return res.status(404).json({message: "Sesi chat tidak ditemukan"});
        }

        if (session.userId.toString() !== userId.toString()) {
            logger.warn("Akses ditolak untuk sesi chat:", {sessionId, userId})
            return res.status(403).json({message: "Akses ditolak untuk sesi chat ini"});
        }


        // Membuat event inngest untuk memproses pesan
        const event: InngestEvent = {
            name: "therapy/session.message",
            data: {
                message,
                history: session.messages,
            }
        }

        logger.info("Mengirim pesan ke Inngest:", {event})

        await inngest.send(event);

        const analysisPrompt = `Analisis Pesan Chat Terapi ini dan berikan insights. Return HANYA dalam bentuk JSON yang valid tanpa markdown formatting atau additional text.
        Pesan : ${message}
        Context : ${JSON.stringify({
            memory: event.data.memory,
            goals: event.data.goals,
        })}

        Required JSON Structure :
        {
            "emotionalState": "string", // Emosi yang terdeteksi dalam pesan
            "themes": ["string"], // Tema utama yang dibahas
            "riskLevel": number, // Level risiko dari 0 (rendah) hingga 10 (tinggi)
            "recommendedApproach": "string",
            "progressIndicators": ["string"]
        }
        `

        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: analysisPrompt,
        })

        const analysis_res = response.text
        const analysis = JSON.parse(analysis_res || "{}")

        logger.info("Response dari Gemini:", analysis)

        // Generate Pesan Therapis
        const responsePrompt = `${event.data.systemPrompt}
        
        Berdasarkan konteks berikut, generate respons therapis:
        Pesan : ${message}
        Analysis : ${JSON.stringify(analysis)}
        Memory : ${JSON.stringify(event.data.memory)}
        Goals : ${JSON.stringify(event.data.goals)}
        
        Berikan respons yang:
        1. Menangani kebutuhan emosional secara langsung
        2. Menggunakan teknik terapeutik yang sesuai
        3. Menunjukkan empati dan pemahaman
        4. Menjaga batasan profesional
        5. Mempertimbangkan keselamatan dan kesejahteraan`

        const responseResult = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: responsePrompt,
        })

        const response_ = responseResult.text
        logger.info("Response yang di generate:", response)

        session.messages.push({
            role: "assistant",
            content: response_ || "Tidak ada Respons yang di generate",
            timestamp: new Date(),
            metadata: {
                analysis,
                progress: {
                    emotionalState: analysis.emotionalState,
                    riskLevel: analysis.riskLevel,
                }
            }
        })

        // save sesi yang terupdate
        await session.save();
        logger.info("Sesi chat diperbarui:", {sessionId})

        res.json({
            response, message: response, analysis, metadata: {
                progress: {
                    emotionalState: analysis.emotionalState,
                    riskLevel: analysis.riskLevel,
                },
            },
        })
    } catch (error) {
    logger.error("Error dalam Send Message", error);
    res.status(500).json({
      message: "Error Memproses Pesan",
      error: error instanceof Error ? error.message : "Error tidak dikenal (kayak dia ke aku)",
    }); 
  }
}

// Riwayat Sesi
export const getSessionHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = new Types.ObjectId(req.user.id);
    const session = await ChatSession.findOne({ sessionId, userId }).exec();

    if (!session) {
        return res.status(404).json({ message: "Sesi chat tidak ditemukan" })
    };

    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Akses ditolak untuk sesi chat ini" });
    }

    res.json({ messages: session.messages, startTime: session.startTime, status: session.status });
    
  } catch (error) {
    logger.error("Error getSessionHistory:", error);
    res.status(500).json({ message: "Error fetch riwayat sesi" });
  }
};

// Mendapatkan Sesi Chat berdasarkan sessionId
export const getChatSession = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    logger.info(`Getting chat session: ${sessionId}`);
    const chatSession = await ChatSession.findOne({ sessionId });
    if (!chatSession) {
      logger.warn(`Chat session not found: ${sessionId}`);
      return res.status(404).json({ error: "Chat session not found" });
    }
    logger.info(`Found chat session: ${sessionId}`);
    res.json(chatSession);
  } catch (error) {
    logger.error("Failed to get chat session:", error);
    res.status(500).json({ error: "Failed to get chat session" });
  }
};

// Chat History
export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = new Types.ObjectId(req.user.id);

    const session = await ChatSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "Sesi chat tidak ditemukan" });
    if (session.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Akses ditolak untuk sesi chat ini" });
    }

    res.json({ messages: session.messages });
  } catch (error) {
    logger.error("Error getChatHistory:", error);
    res.status(500).json({ message: "Error fetch riwayat sesi" });
  }
};