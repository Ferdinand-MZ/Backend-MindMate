import { inngest } from "./index";
import { GoogleGenAI } from "@google/genai";
import {logger} from "../utils/logger";

const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || 'AIzaSyD3pQcrDDOR3cnUj84Rw0Cmk4Y823inPU8'
})

export const processChatMessage = inngest.createFunction(
    {
        id: "process-chat-message",
    },
    {event: "therapy/session.message"},
    async ({event, step}) => {
        try {
            const {
                message, 
                history, 
                memory = {
                    userProfile: {
                        emotionalState: [],
                        riskLevel: 0,
                        preferences: {},
                    },
                    sessionContext: {
                        conversionThemes: [],
                        conversionTechnique: []
                    },
                },
                goals = [],
                systemPrompt,
            } = event.data

            logger.info("Memproses Chat dengan AI:", {
                message,
                historyLength: history?.length,
            })

            const analysis = await step.run("analyze-message", async () => {
                try {
                    const prompt = `Analisis pesan chat terapi ini dan berikan insights. Return HANYA dalam bentuk JSON yang valid tanpa markdown formatting atau additional text.
                    Message : ${message}
                    Context : ${JSON.stringify({memory, goals})}
                    
                    Required JSON Structure :
                    {
                        "emotionalState": "string", // Emosi yang terdeteksi dalam pesan
                        "themes": ["string"], // Tema utama yang dibahas
                        "riskLevel": number, // Level risiko dari 0 (rendah) hingga 10 (tinggi)
                        "recommendedApproach": "string",
                        "progressIndicators": ["string"]
                    }`
                    
                    const response = await genAI.models.generateContent({
                        model: 'gemini-2.0-flash',
                        contents: "Menjelaskan Bagaimana AI bekerja dalam beberapa kata"
                    })

                    const text = response.text
                    logger.info("Response dari Gemini:", {text})

                    const cleanText = text?.replace(/```json\n|\n```/g, '').trim()
                    const parsedAnalysis = JSON.parse(cleanText || "{}")

                    return parsedAnalysis
                } catch (error) {
                    logger.error("Error di message analysis:", {error, message})

                    return {
                        emotionalState: "neutral",
                        themes: [],
                        riskLevel: 0,
                        recommendedApproach: "supportive",
                        progressIndicators: [],
                    }
                }
            })

            const updatedMemory = await step.run("update-memory", async () => {
                if (analysis.emotionalState) {
                    memory.userProfile.emotionalState.push(analysis.emotionalState)
                }
                
                if (analysis.themes) {
                    memory.sessionContext.conversionThemes.push(...analysis.themes)
                }

                if (analysis.riskLevel) {
                    memory.userProfile.riskLevel = analysis.riskLevel
                }
                return memory
            })

            // Kalau terdeteksi riskLevel yang tinggi 
            if (analysis.riskLevel > 4) {
                await step.run("trigger-risk-alert", async () => {
                    logger.warn("Risk level tinggi terdeteksi:", {message, riskLevel: analysis.riskLevel})
            })
            }

            // Buat Generate Response yang therapeutic
            const response = await step.run("generate-response", async () => {
                try {
                    const prompt = `${systemPrompt}
                    
                    Berdasarkan pesan chat berikut, generate respons yang bersifat therapeutic: 
                    Pesan: ${message}
                    Analysis: ${JSON.stringify(analysis)} 
                    Memory: ${JSON.stringify(memory )} 
                    Goals: ${JSON.stringify(goals)} 

                    Berikan Respons yang bersifat:
                    1. Menangani kebutuhan emosional segera
                    2. Menggunakan teknik terapeutik yang sesuai
                    3. Menunjukkan empati dan pengertian
                    4. Menjaga batasan profesional
                    5. Mempertimbangkan keselamatan dan kesejahteraan`
                    const response = await genAI.models.generateContent({
                        model: 'gemini-2.0-flash',
                        contents: prompt,
                    })

                    const results = response.text
                    const responseText = results?.trim()

                    logger.info("Response Untuk balasan Chat:", {responseText})
                    
                    return responseText
                } catch (error) {
                    logger.error("Error men generate response:", {error})
                    return "Saya di sini untuk membantu Anda. Bisakah Anda ceritakan lebih banyak tentang apa yang ada di pikiran Anda?"
                }
            })
                return {
                    response,
                    analysis,
                    updatedMemory,
                }
            
        } catch (error) {
            logger.error("Error di chat message processing:", {error, message: event.data.message})

            // default state
            return {
            response: "Saya di sini untuk membantu Anda. Bisakah Anda ceritakan lebih banyak tentang apa yang ada di pikiran Anda?",
            analysis: {
                emotionalState: "neutral",
                themes: [],
                riskLevel: 0,
                recommendedApproach: "supportive",
                progressIndicators: [],
            },
            updatedMemory: event.data.memory,
            }
        }
    }
)

export const analyzeTheraphySession = inngest.createFunction(
    {
    id: "analyze-therapy-session",
    },
    
    {event: "therapy/session.created"}, async ({event, step}) => {
    try {
        const sessionContent = await step.run("get-session-content", async () => {
            return event.data.notes || event.data.transcript
        })

        // analyze session using gemini
        const analysis = await step.run("analyze-with-gemini", async () => {
            const prompt = `Analisis sesi terapi berikut dan berikan insights. 
            Session Content : ${sessionContent}

            Tolong Berikan :
            1. Kunci Tema dan Topik yang dibahas
            2. Analisis dari Emotional State Klien selama sesi
            3. Area yang berpotensi menjadi perhatian
            4. Rekomendasi untuk follow up
            5. Indikator progress

            Return HANYA dalam bentuk JSON yang valid tanpa markdown formatting atau additional text.`
            const response = await genAI.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
            })

            const results = response.text
            const responseText = results?.trim() || "{}"

            return JSON.parse(responseText || "{}")
        })

        // menyimpan analisis
        await step.run("store-analysis", async () => {
            logger.info("Analisis Sesi Terapi Berhasil Disimpan:")
            return analysis
        })

        if(analysis.areasOfConcern?.length > 0) {
            await step.run("trigger-concern-alert", async () => {
                logger.warn("Indikator perhatian terdeteksi dalam sesi terapi:", {
                    sessionId: event.data.sessionId,
                    concerns: analysis.areasOfConcern,
                })
            
            // Menambahkan logika nya disini

            })
        }

        return {
            message: "Analisis sesi terapi selesai",
            analysis,
        }
    } catch (error) {
            logger.error("Error di Sesi Analisis Terapi:", error)
            throw error
    }  
    }
)

export const generateActivityRecommendations = inngest.createFunction(
    { 
        id: "generate-activity-recommendations",
    },
    {event: "mood/updated"},
    async ({event, step}) => {

    }
)

export const functions = [processChatMessage, analyzeTheraphySession]