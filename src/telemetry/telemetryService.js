import { getVehicle } from "../vehicles/vehicleManager.js";
import { validateTelemetry } from "./telemetryValidator.js";
import { routeTelemetry } from "../v2v/messageRouter.js";
import Telemetry from "../database/telemetryModel.js";

export async function processTelemetry(data) {
    const validation = validateTelemetry(data);

    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const vehicle = getVehicle(data.vehicleId);

    if (!vehicle) {
        throw new Error("Vehicle is not connected");
    }

    vehicle.updateTelemetry(data);

    await Telemetry.create({
        vehicleId: data.vehicleId,
        timestamp: new Date(data.timestamp || Date.now()),

        latitude: data.position.latitude,
        longitude: data.position.longitude,

        speed: data.motion?.speed ?? 0,
        heading: data.motion?.heading ?? 0,
        acceleration: data.motion?.acceleration ?? 0,

        braking: data.status?.braking ?? false
    });

    routeTelemetry(vehicle);

    return vehicle;
}