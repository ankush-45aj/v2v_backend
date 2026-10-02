import { config } from "../config/env.js";
import { calculateDistance } from "./distance.js";

export function getNearbyVehicles(sourceVehicle, allVehicles) {
    const nearbyVehicles = [];

    if (!sourceVehicle.position) {
        return nearbyVehicles;
    }

    for (const vehicle of allVehicles) {
        if (vehicle.vehicleId === sourceVehicle.vehicleId) {
            continue;
        }

        if (!vehicle.position) {
            continue;
        }

        const distance = calculateDistance(
            sourceVehicle.position,
            vehicle.position
        );

        if (distance <= config.v2vRangeMeters) {
            nearbyVehicles.push({
                vehicle,
                distance
            });
        }
    }

    return nearbyVehicles;
}

export function isWithinRange(positionA, positionB, rangeMeters) {
    const distance = calculateDistance(positionA, positionB);

    return {
        distanceMeters: distance,
        withinRange: distance <= rangeMeters
    };
}