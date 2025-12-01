import express, { type Response } from "express";
import z from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Content, User } from "./db.js";
import "dotenv/config";
import { auth, type AuthRequest } from "./middleware.js";

const app = express();

// Sign up
app.post("/api/v1/signup", async (req, res) => {
  try {
    const signupReqBody = z.object({
      username: z.email(),
      password: z.string(),
    });

    const parsedData = signupReqBody.safeParse(req.body);

    if (!parsedData.success) {
      return res.status(400).json({
        success: false,
        msg: "Validation failed!",
      });
    }

    const { username, password } = parsedData.data;

    const exitingUser = await User.findOne({ username });

    if (exitingUser) return res.status(409).send("User already exists");

    const hashedPassword = bcrypt.hash(password, 10);

    await User.create({
      username,
      password: hashedPassword,
    });

    res.status(200).json({
      success: true,
      msg: "New user created successfully.",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
});

// Sign in
app.post("/api/v1/signin", async (req, res) => {
  try {
    const signinReqBody = z.object({
      username: z.email(),
      password: z.string(),
    });

    const parsedData = signinReqBody.safeParse(req.body);

    if (!parsedData.success) {
      return res.status(400).json({
        success: false,
        msg: "Validation failed!",
      });
    }

    const { username, password } = parsedData.data;

    const user = await User.findOne({ username });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const comparePassword = await bcrypt.compare(password, user.password!); // The ! tells TS: “this is definitely not undefined”.
    if (!comparePassword) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET)
      throw new Error("JWT_SECRET is missing in environment variables");

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.status(200).json({
      success: true,
      msg: "User sign in successfully",
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
});

// Add new content
app.post("/api/v1/content", auth, async (req: AuthRequest, res: Response) => {
  try {
    const contentReqBody = z.object({
      link: z.string().url(),
      type: z.enum(["image", "video", "article", "audio"]),
      title: z.string(),
      tags: z.array(z.string()),
    });

    const parsedData = contentReqBody.safeParse(req.body);

    if (!parsedData.success) {
      return res.status(401).json({
        success: false,
        msg: "Validation failed!",
      });
    }

    const { link, type, title, tags } = parsedData.data;

    await Content.create({
      link,
      type,
      title,
      tags,
      userId: req.userId,
    });

    res.status(200).json({
      success: true,
      msg: "New content added",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
});

// Fetching all existing documents (no pagination)
app.get("/api/v1/contents", auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "user not found.",
      });
    }

    const contents = await Content.find({ _id: userId });

    res.json({
      success: true,
      msg: "All documents retrieved successfully",
      contents,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Delete a document
app.delete(
  "/api/v1/delete-content/:contentId",
  auth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { contentId } = req.params;

      if (!contentId) {
        return res.status(401).json({
          success: false,
          msg: "Content not find",
        });
      }

      // Delete content based on contentId and userId.
      await Content.findByIdAndDelete({ contentId, userId: req.userId });

      res.status(200).json({
        success: true,
        msg: "Content deleted successfully",
      });
    } catch (error) {
      console.log(error);
      res.status(500).send("Internal server error");
    }
  }
);

// Create a shareable link for your second brain
app.post("/api/v1/brain/share", async (req, res) => {
  const { share } = req.body;

  
});

// Fetch another user's shared brain content
app.get("/api/v1/brain/:shareLink", (req, res) => {});

app.listen(process.env.PORT, () => {
  console.log(`🎤 Server is up and running on port ${process.env.PORT}`);
});
