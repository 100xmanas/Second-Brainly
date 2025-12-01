import express, { type Response } from "express";
import z from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { Content, User, Link } from "./db.js";
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
        message: "Validation failed!",
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
      message: "New user created successfully.",
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
        message: "Validation failed!",
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
      message: "User sign in successfully",
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
        message: "Validation failed!",
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
      message: "New content added",
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
      message: "All documents retrieved successfully",
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
          message: "Content not find",
        });
      }

      // Delete content based on contentId and userId.
      await Content.findByIdAndDelete({ contentId, userId: req.userId });

      res.status(200).json({
        success: true,
        message: "Content deleted successfully",
      });
    } catch (error) {
      console.log(error);
      res.status(500).send("Internal server error");
    }
  }
);

// Create a shareable link for your second brain (OR Share Content Link)
app.post(
  "/api/v1/brain/share",
  auth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { share } = req.body;

      if (share) {
        //check if link is available?

        const existingLink = await Link.findOne({ userId: req.userId });
        if (existingLink) {
          return res.status(200).json({
            success: true,
            message: "Link created",
            link: existingLink.hash,
          });
        }

        //generate the link
        const hash = uuidv4();
        await Link.create({ userId: req.userId, contentId });
        return res.status(200).json({
          success: true,
          message: "Link created",
          contentId: hash,
        });
      } else {
        await Link.deleteOne({ userId: req.userId });
        return res.status(200).json({
          success: true,
          message: "sharing is disabled",
        });
      }
    } catch (error) {
      console.log(error);

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Fetch another user's shared brain content (OR Get Shared Content)
app.get("/api/v1/brain/:shareLink", async (req, res) => {
  try {
    const hash = req.params.shareLink;

    const link = await Link.findOne({ hash });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Share link is invalid",
      });
    }

    // Fetch content and user details for the shareable link.
    const contents = await Content.find({ userId: link.userId });
    const user = await User.findOne({ _id: link.userId }); // check

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Fetched another user's shared brain contents",
      username: user.username,
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

app.listen(process.env.PORT, () => {
  console.log(`🎤 Server is up and running on port ${process.env.PORT}`);
});
