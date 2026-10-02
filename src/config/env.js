import dotenv from "dotenv";

dotenv.config();

export const config = {
    port: Number(process.env.PORT) || 8080,

    mongodbUri: process.env.MONGODB_URI,

    v2vRangeMeters: Number(process.env.V2V_RANGE_METERS) || 1000,

    telemetryIntervalMs:
        Number(process.env.TELEMETRY_INTERVAL_MS) || 1000
};