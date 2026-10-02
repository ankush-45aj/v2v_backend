import {
    addVehicle,
    removeVehicle
} from "../vehicles/vehicleManager.js";

import { handleMessage } from "./messageHandler.js";

export function handleConnection(socket) {

    let vehicleId = null;

    socket.on("message", async (message) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.type === "connect") {

                if (!data.vehicleId) {
                    socket.send(JSON.stringify({
                        type: "error",
                        message: "vehicleId is required"
                    }));

                    return;
                }

                const added = addVehicle(
                    data.vehicleId,
                    socket
                );

                if (!added) {
                    socket.send(JSON.stringify({
                        type: "error",
                        message: "Vehicle already connected"
                    }));

                    socket.close();

                    return;
                }

                vehicleId = data.vehicleId;

                socket.send(JSON.stringify({
                    type: "connected",
                    vehicleId,
                    message: "Vehicle connected successfully"
                }));

                console.log(
                    `${vehicleId} connected`
                );

                return;
            }

            await handleMessage(
                data,
                socket
            );

        } catch (error) {

            socket.send(JSON.stringify({
                type: "error",
                message: error.message
            }));
        }
    });

    socket.on("close", () => {

        if (vehicleId) {

            removeVehicle(vehicleId);

            console.log(
                `${vehicleId} disconnected`
            );
        }
    });

    socket.on("error", (error) => {

        console.error(
            `WebSocket error: ${error.message}`
        );
    });
}