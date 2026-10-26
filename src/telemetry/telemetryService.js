import { getVehicle } from "../vehicles/vehicleManager.js";
import { validateTelemetry } from "./telemetryValidator.js";
import { routeTelemetry } from "../v2v/messageRouter.js";
import Telemetry from "../database/telemetryModel.js";
import { config } from "../config/env.js";

export async function processTelemetry(data, authenticatedVehicleId) {
    const validation = validateTelemetry(data);

    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const vehicle = getVehicle(data.vehicleId);

    if (!vehicle) {
        throw new Error("Vehicle is not connected");
    }

    if (data.vehicleId !== authenticatedVehicleId) {
        throw new Error("vehicleId does not match the connected vehicle");
    }

    const timestamp = data.timestamp ?? Date.now();
    const age = Date.now() - timestamp;
    if (age > config.telemetryMaxAgeMs || age < -config.telemetryMaxAgeMs) {
        throw new Error("Telemetry timestamp is stale or too far in the future");
    }

    if (vehicle.measurementTimestamp !== null &&
        timestamp < vehicle.measurementTimestamp) {
        throw new Error("Out-of-order telemetry timestamp");
    }

    if (data.sequence !== undefined &&
        vehicle.sequence !== null &&
        data.sequence <= vehicle.sequence) {
        throw new Error("Out-of-order telemetry sequence");
    }

    vehicle.updateTelemetry(data, timestamp);

    await Telemetry.create({
        vehicleId: data.vehicleId,
        timestamp: new Date(timestamp),

        latitude: data.position.latitude,
        longitude: data.position.longitude,
        accuracy: data.accuracy,
        sequence: data.sequence,

        speed: data.motion?.speed ?? 0,
        heading: data.motion?.heading ?? 0,
        acceleration: data.motion?.acceleration ?? 0,

        braking: data.status?.braking ?? false
    });

    routeTelemetry(vehicle);

    return vehicle;
}