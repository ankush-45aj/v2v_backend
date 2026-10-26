import { processTelemetry } from "../telemetry/telemetryService.js";

import Event from "../database/eventModel.js";

export async function handleMessage(
    data,
    socket,
    vehicleId
) {

    switch (data.type) {

        case "telemetry":

            await processTelemetry(data, vehicleId);

            break;


        case "event":

            if (!vehicleId || data.vehicleId !== vehicleId) {
                throw new Error("vehicleId does not match the connected vehicle");
            }

            await processEvent(data);

            break;


        case "heartbeat":

            socket.send(JSON.stringify({
                type: "heartbeat_ack",
                timestamp: Date.now()
            }));

            break;


        default:

            socket.send(JSON.stringify({
                type: "error",
                message: `Unknown message type: ${data.type}`
            }));
    }
}


async function processEvent(data) {

    await Event.create({
        vehicleId: data.vehicleId,

        eventType: data.eventType,

        timestamp: new Date(
            data.timestamp || Date.now()
        ),

        latitude: data.position?.latitude,

        longitude: data.position?.longitude,

        data: data.data || {}
    });
}