import {NextFunction, Request, Response} from 'express';
import jwt from 'jsonwebtoken';
import {User} from '../models/User';

// Extend Request Express type untuk include user
declare global {
    namespace Express {
        interface Request {
            user?: any
        }
    }
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");

        if(!token) {
            return res.status(401).json({messsage : "Diperlukan autentikasi!"})
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'secret' // Ganti dengan secret key yang aman
        ) as any
        const user = await User.findById(decoded.userId)

        if (!user) {
            return res.status(401).json({message: "User tidak ditemukan!"})
        }

        req.user = user
        next();
    } catch (error) {
        res.status(401).json({message: "Token tidak valid!"})
    }
}