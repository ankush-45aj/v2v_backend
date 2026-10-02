import { VehicleState } from "./vehicleState.js";

const vehicles = new Map();

export function addVehicle(vehicleId, socket) {
    if (vehicles.has(vehicleId)) {
        return false;
    }

    const vehicle = new VehicleState(vehicleId, socket);

    vehicles.set(vehicleId, vehicle);

    return true;
}

export function removeVehicle(vehicleId) {
    return vehicles.delete(vehicleId);
}

export function getVehicle(vehicleId) {
    return vehicles.get(vehicleId);
}

export function getAllVehicles() {
    return Array.from(vehicles.values());
}

export function getVehicleCount() {
    return vehicles.size;
}