import mongoose, { Schema } from "mongoose";
import "dotenv/config";

const connectDb = async () => {
  try {
    const url = process.env.MONGO_URL;

    if (!url) throw new Error("MONGO_URL is missing in environment variables");

    await mongoose.connect(url);
  } catch (error) {
    console.log("DB is not conneted", error);
  }
};

connectDb();

const UserSchema = new Schema({
  username: { type: String, unique: true },
  password: { type: String, min: 6, max: 12 },
});

const ContentSchema = new Schema({
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ["image", "video", "article", "audio"],
    required: true,
  },
  link: { type: String, required: true },
  tags: [{ type: mongoose.Types.ObjectId, ref: "Tag" }],
  userId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
});

const TagSchema = new Schema({
  name: { type: String, required: true },
});

const LinkSchema = new Schema({
  hash: { type: String, required: true },
  userId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
});

export const User = mongoose.model("User", UserSchema);
export const Content = mongoose.model("Content", ContentSchema);
export const Tag = mongoose.model("Tag", TagSchema);
export const Link = mongoose.model("Link", LinkSchema);
