import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
    {
        vehicleId: {
            type: String,
            required: true
        },

        eventType: {
            type: String,
            required: true
        },

        timestamp: {
            type: Date,
            default: Date.now
        },

        latitude: Number,

        longitude: Number,

        data: {
            type: Object,
            default: {}
        }
    }
);

const Event = mongoose.model(
    "Event",
    eventSchema
);

export default Event;