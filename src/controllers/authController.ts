import {Request, Response} from 'express';
import {User} from '../models/User';
import {Session} from '../models/Session';
import bycrpt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mendaftarkan User Baru
export const register = async (req: Request, res: Response) => {
    try {
        const {name, email, password} = req.body;

        // Validasi input
        if (!name || !email || !password) {
            return res.status(400).json({message: 'Semua field harus diisi'});
        }

        // Cek apakah user sudah ada
        const existingUser = await User.findOne({email});
        if (existingUser) {
            return res.status(400).json({message: 'Email sudah terdaftar'});
        }

        // Hash password
        const hashedPassword = await bycrpt.hash(password, 10); // 10 merupakan jumlah salt rounds

        // Buat user baru
        const user = new User({
            name,
            email,
            password: hashedPassword,
        });

        await user.save(); // Simpan user ke database

        //  Respon dengan status 201 Created
        res.status(201).json({
            user:{
                _id: user._id,
                name: user.name,
                email: user.email,
        },
        message: 'User berhasil dibuat',
    });
    

    }  catch (error) {
        res.status(500).json({ message: "Serve error", error })
    }
}

// login
export const login = async (req: Request, res: Response) => {
    try {
        const {email, password} = req.body;
        if (!email || !password) {
            return res.status(400).json({message: 'Email dan password harus diisi'});
        }

    // mencari user
    const user = await User.findOne({email})
    if (!user) {
        return res.status(401).json({message: 'Email atau password salah'});
    }

    // Generate Token JWT
    const token = jwt.sign(
        {userId: user.id},
        process.env.JWT_SECRET || 'secret', // Ganti dengan secret key yang aman
        {expiresIn : '24h'} // Token berlaku selama 24 jam
    )

    // Membuat Sesi
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Sesi berlaku selama 24 jam

    const session = new Session({
        userId : user._id,
        token,
        expiresAt,
        deviceInfo: req.headers['user-agent'],
    })
    await session.save()

    res.json({
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
        },
        token,
        message: 'Login berhasil',
    })

    } catch (error) {
        res.status(500).json({message: 'Server error', error});
    }
}

// Logout
export const logout = async (req: Request, res: Response) => {
    try {
        const token = req.header("Authorization")?.replace('Bearer ', '')
    if (token) {
        // Hapus sesi berdasarkan token
        await Session.deleteOne({token});
    }
    res.json({message: 'Logout berhasil'});
    } catch (error) {
        res.status(500).json({message: 'Server error', error});
    }
}