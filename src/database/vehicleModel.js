import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
    {
        vehicleId: {
            type: String,
            required: true,
            unique: true
        },

        vehicleType: {
            type: String,
            default: "car"
        },

        lastSeen: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

const Vehicle = mongoose.model(
    "Vehicle",
    vehicleSchema,
    "cars"
);

export default Vehicle;