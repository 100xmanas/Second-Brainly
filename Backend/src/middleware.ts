import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import "dotenv/config";

//override the types of the express request object
export interface AuthRequest extends Request {
  userId?: string;
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers["authorization"];

  if (!token) throw new Error("authorization required");

  if (!process.env.JWT_SECRET)
    throw new Error("JWT_SECRET is missing in environment variables");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (typeof decoded === "string") {
      return res.status(400).json({ msg: "Invalid token payload" });
    }

    // req.userId = decoded.id;
    req.userId = (decoded as JwtPayload).id;
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ success: false, msg: "Invalid token" });
  }
};
