import { Request, Response, NextFunction } from "express";
import { Activity, IActivity } from "../models/Activity";
import { logger } from "../utils/logger";
import { timeStamp } from "console";

export const logActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, name, description, duration, difficulty, feeback,} = req.body;
        const userId = req.user._id; 
        
        if (!userId) {
            return res.status(401).json({ message: "User belum terautentikasi" });
        }

        const activity = new Activity({
            userId,
            type,
            name,
            description,
            duration,
            difficulty, 
            feeback,
            timeStamp: new Date(),
        })

        await activity.save();
        logger.info(`Aktivitas logged untuk user ${userId}`);

        res.status(201).json({ success: true, data: activity, });
        
    } catch (error) {
        next(error);
        }
}