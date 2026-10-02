import mongoose from "mongoose";
import { config } from "./env.js";

export async function connectDatabase() {
    try {
        await mongoose.connect(config.mongodbUri);

        console.log("MongoDB Atlas connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        throw error;
    }
}