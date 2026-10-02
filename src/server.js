import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { WebSocketServer } from "ws";

import { config } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

import {
    getAllVehicles,
    getVehicle,
    getVehicleCount,
    removeVehicle
} from "./vehicles/vehicleManager.js";

import Vehicle from "./database/vehicleModel.js";
import Telemetry from "./database/telemetryModel.js";
import Event from "./database/eventModel.js";

import { calculateDistance } from "./v2v/distance.js";
import {
    getNearbyVehicles,
    isWithinRange
} from "./v2v/rangeManager.js";

import { handleConnection } from "./websocket/connectionHandler.js";

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   SYSTEM APIs
========================= */

app.get("/api/health", (req, res) => {

    res.json({
        status: "ok",
        service: "V2V Backend",
        timestamp: Date.now()
    });

});


app.get("/api/status", (req, res) => {

    res.json({
        status: "ok",
        service: "V2V Backend",
        activeVehicles: getVehicleCount(),
        timestamp: Date.now()
    });

});


app.get("/api/config", (req, res) => {

    res.json({
        v2vRangeMeters: config.v2vRangeMeters,
        telemetryIntervalMs: config.telemetryIntervalMs
    });

});


/* =========================
   VEHICLE APIs
========================= */

app.post("/api/vehicles", async (req, res) => {

    try {

        const { vehicleId, vehicleType } = req.body;

        if (!vehicleId) {

            return res.status(400).json({
                success: false,
                error: "INVALID_VEHICLE_ID",
                message: "vehicleId is required"
            });

        }

        const existingVehicle =
            getVehicle(vehicleId) ||
            await Vehicle.findOne({ vehicleId });

        if (existingVehicle) {

            return res.status(409).json({
                success: false,
                error: "VEHICLE_ALREADY_EXISTS",
                message: `Vehicle ${vehicleId} already exists`
            });

        }

        const vehicle = await Vehicle.create({
            vehicleId,
            vehicleType: vehicleType || "car"
        });

        res.status(201).json({
            success: true,
            message: "Vehicle registered successfully",
            vehicle
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: "VEHICLE_ALREADY_EXISTS"
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});


app.get("/api/vehicles", (req, res) => {

    const vehicles = getAllVehicles();

    res.json({
        success: true,
        count: vehicles.length,

        vehicles: vehicles.map(vehicle => ({
            vehicleId: vehicle.vehicleId,
            vehicleType: vehicle.vehicleType,
            position: vehicle.position,
            speed: vehicle.speed,
            heading: vehicle.heading,
            acceleration: vehicle.acceleration,
            braking: vehicle.braking,
            lastSeen: vehicle.lastSeen
        }))
    });

});


app.get("/api/vehicles/:vehicleId", (req, res) => {

    const vehicle =
        getVehicle(req.params.vehicleId);

    if (!vehicle) {

        return res.status(404).json({
            success: false,
            error: "VEHICLE_NOT_FOUND"
        });

    }

    res.json({
        success: true,
        vehicle
    });

});


app.get(
    "/api/vehicles/:vehicleId/state",
    (req, res) => {

        const vehicle =
            getVehicle(req.params.vehicleId);

        if (!vehicle) {

            return res.status(404).json({
                success: false,
                error: "VEHICLE_NOT_FOUND"
            });

        }

        res.json({
            success: true,
            vehicleId: vehicle.vehicleId,
            position: vehicle.position,
            speed: vehicle.speed,
            heading: vehicle.heading,
            acceleration: vehicle.acceleration,
            braking: vehicle.braking,
            lastSeen: vehicle.lastSeen
        });

    }
);


app.delete(
    "/api/vehicles/:vehicleId",
    async (req, res) => {

        try {

            const vehicleId = req.params.vehicleId;
            const activeVehicle = getVehicle(vehicleId);
            const databaseVehicle = await Vehicle.findOneAndDelete({
                vehicleId
            });
            const removedFromRuntime = removeVehicle(vehicleId);

            if (activeVehicle?.socket?.readyState === 1) {
                activeVehicle.socket.close(1000, "Vehicle removed");
            }

            if (!databaseVehicle && !removedFromRuntime) {

                return res.status(404).json({
                    success: false,
                    error: "VEHICLE_NOT_FOUND"
                });

            }

            res.json({
                success: true,
                message: "Vehicle removed successfully",
                vehicleId
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


/* =========================
   TELEMETRY HISTORY
========================= */

app.get(
    "/api/vehicles/:vehicleId/telemetry",
    async (req, res) => {

        try {

            const telemetry =
                await Telemetry
                    .find({
                        vehicleId:
                            req.params.vehicleId
                    })
                    .sort({
                        timestamp: -1
                    })
                    .limit(100);

            res.json({
                success: true,
                vehicleId:
                    req.params.vehicleId,
                count: telemetry.length,
                telemetry
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


/* =========================
   V2V DISTANCE
========================= */

app.post(
    "/api/v2v/distance",
    (req, res) => {

        try {

            const {
                vehicleA,
                vehicleB
            } = req.body;

            const distance =
                calculateDistance(
                    vehicleA,
                    vehicleB
                );

            res.json({
                success: true,
                distanceMeters: distance
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                error: error.message
            });

        }

    }
);


/* =========================
   V2V RANGE
========================= */

app.post(
    "/api/v2v/range",
    (req, res) => {

        try {

            const {
                vehicleA,
                vehicleB
            } = req.body;

            const result =
                isWithinRange(
                    vehicleA,
                    vehicleB,
                    config.v2vRangeMeters
                );

            res.json({
                success: true,
                ...result
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                error: error.message
            });

        }

    }
);


/* =========================
   NEARBY VEHICLES
========================= */

app.get(
    "/api/v2v/nearby/:vehicleId",
    (req, res) => {

        try {

            const sourceVehicle =
                getVehicle(req.params.vehicleId);

            if (!sourceVehicle) {
                return res.status(404).json({
                    success: false,
                    error: "VEHICLE_NOT_FOUND"
                });
            }

            const nearby =
                getNearbyVehicles(
                    sourceVehicle,
                    getAllVehicles()
                );

            res.json({
                success: true,
                vehicleId:
                    req.params.vehicleId,
                rangeMeters:
                    config.v2vRangeMeters,
                nearbyVehicles: nearby.map(({ vehicle, distance }) => ({
                    vehicleId: vehicle.vehicleId,
                    distanceMeters: distance,
                    position: vehicle.position,
                    speed: vehicle.speed,
                    heading: vehicle.heading
                }))
            });

        } catch (error) {

            res.status(400).json({
                success: false,
                error: error.message
            });

        }

    }
);


/* =========================
   EVENTS
========================= */

app.get(
    "/api/events",
    async (req, res) => {

        try {

            const events =
                await Event
                    .find()
                    .sort({
                        timestamp: -1
                    })
                    .limit(100);

            res.json({
                success: true,
                count: events.length,
                events
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


app.get(
    "/api/events/:vehicleId",
    async (req, res) => {

        try {

            const events =
                await Event
                    .find({
                        vehicleId:
                            req.params.vehicleId
                    })
                    .sort({
                        timestamp: -1
                    })
                    .limit(100);

            res.json({
                success: true,
                vehicleId:
                    req.params.vehicleId,
                count: events.length,
                events
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                error: error.message
            });

        }

    }
);


/* =========================
   DATABASE STATUS
========================= */

app.get(
    "/api/database/status",
    (req, res) => {

        const connectionStates = [
            "disconnected",
            "connected",
            "connecting",
            "disconnecting"
        ];
        const state = connectionStates[mongoose.connection.readyState] || "unknown";

        res.status(state === "connected" ? 200 : 503).json({
            database: "MongoDB",
            status: state
        });

    }
);


/* =========================
   START SERVER
========================= */

async function startServer() {

    await connectDatabase();

    const server = app.listen(
        config.port,
        () => {

            console.log(
                `HTTP server running on port ${config.port}`
            );

        }
    );

    const wss =
        new WebSocketServer({
            server
        });

    wss.on(
        "connection",
        handleConnection
    );

    console.log(
        `WebSocket server running at ws://localhost:${config.port}`
    );

}


startServer().catch(error => {

    console.error(
        "Server failed to start:",
        error
    );

    process.exit(1);

});