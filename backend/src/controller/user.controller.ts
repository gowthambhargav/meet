import { Request, RequestHandler } from "express";
import User from "../Schema/user";
import { GetDetailsFromToken } from "../util/token";

export const CreateUser: RequestHandler = async (req: Request, res) => {
    try {
        // TODO: implement logic
        if(!req.body) return res.status(400).json({error:"Request body is missing"});
        
        const {username,email,password} =  req.body;
        if(!username) return res.status(400).json({error:"username is required"})
        if(!email) return res.status(400).json({error:"email is required"})
        if(!password) return res.status(400).json({error:"password is required"})
            const user = await User.create({username,email,password});
        if(!user) return res.status(500).json({error:"Failed to create user"})

        res.json(user);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error })
    }
}


export const LoginUser: RequestHandler = async (req, res) => {
    try {
       if(!req.body) return res.status(400).json({error:"Request body is missing"});
         const {email,password} = req.body;
        if(!email) return res.status(400).json({error:"email is required"})
        if(!password) return res.status(400).json({error:"password is required"})
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = user.generateAuthToken();
        await user.save();
        const { password: _, ...userData } = user.toObject();
        res.json({ user: userData });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error })
        
    }
}

export const getUserDetails: RequestHandler = async (req, res) => {
    try {
        const userToken = GetDetailsFromToken(req.params.id);
        const userId = userToken?.id;
        console.log(userId,userToken);
        
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(user);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error })
    }
}