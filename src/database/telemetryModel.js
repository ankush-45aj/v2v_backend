import mongoose from "mongoose";

const telemetrySchema = new mongoose.Schema(
    {
        vehicleId: {
            type: String,
            required: true,
            index: true
        },

        timestamp: {
            type: Date,
            required: true,
            index: true
        },

        latitude: Number,

        longitude: Number,

        speed: Number,

        heading: Number,

        acceleration: Number,

        braking: Boolean
    }
);

const Telemetry = mongoose.model(
    "Telemetry",
    telemetrySchema
);

export default Telemetry;