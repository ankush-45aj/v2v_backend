import { getAllVehicles } from "../vehicles/vehicleManager.js";
import { getNearbyVehicles } from "./rangeManager.js";

export function routeTelemetry(sourceVehicle) {
    const allVehicles = getAllVehicles();

    const nearbyVehicles = getNearbyVehicles(
        sourceVehicle,
        allVehicles
    );

    for (const nearby of nearbyVehicles) {
        const target = nearby.vehicle;

        const packet = {
            type: "v2v_telemetry",

            sourceVehicle: sourceVehicle.vehicleId,

            distance: Math.round(nearby.distance),

            timestamp: Date.now(),

            position: sourceVehicle.position,

            motion: {
                speed: sourceVehicle.speed,
                heading: sourceVehicle.heading,
                acceleration: sourceVehicle.acceleration
            },

            status: {
                braking: sourceVehicle.braking
            }
        };

        if (target.socket.readyState === 1) {
            target.socket.send(JSON.stringify(packet));

            console.log(
                `V2V: ${sourceVehicle.vehicleId} -> ${target.vehicleId} (${Math.round(nearby.distance)}m)`
            );
        }
    }
}