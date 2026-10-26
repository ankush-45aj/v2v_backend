import { isValidPosition } from "../v2v/distance.js";

export function validateTelemetry(data) {
    if (!data) {
        return {
            valid: false,
            error: "Telemetry data is missing"
        };
    }

    if (data.type !== "telemetry") {
        return {
            valid: false,
            error: "Invalid message type"
        };
    }

    if (typeof data.vehicleId !== "string" || !data.vehicleId.trim()) {
        return {
            valid: false,
            error: "vehicleId is required"
        };
    }

    if (!isValidPosition(data.position)) {
        return {
            valid: false,
            error: "Invalid position"
        };
    }

    if (data.timestamp !== undefined &&
        (!Number.isSafeInteger(data.timestamp) || data.timestamp < 0)) {
        return {
            valid: false,
            error: "timestamp must be a nonnegative epoch-millisecond integer"
        };
    }

    if (data.sequence !== undefined &&
        (!Number.isSafeInteger(data.sequence) || data.sequence < 0)) {
        return {
            valid: false,
            error: "sequence must be a nonnegative integer"
        };
    }

    if (data.accuracy !== undefined &&
        (!Number.isFinite(data.accuracy) || data.accuracy < 0)) {
        return {
            valid: false,
            error: "accuracy must be a nonnegative number"
        };
    }

    const speed = data.motion?.speed ?? 0;

    if (!Number.isFinite(speed) || speed < 0) {
        return {
            valid: false,
            error: "Invalid speed"
        };
    }

    const heading = data.motion?.heading ?? 0;
    if (!Number.isFinite(heading) || heading < 0 || heading >= 360) {
        return {
            valid: false,
            error: "Invalid heading"
        };
    }

    const acceleration = data.motion?.acceleration ?? 0;
    if (!Number.isFinite(acceleration)) {
        return {
            valid: false,
            error: "Invalid acceleration"
        };
    }

    const braking = data.status?.braking ?? false;
    if (typeof braking !== "boolean") {
        return {
            valid: false,
            error: "Invalid braking status"
        };
    }

    return {
        valid: true
    };
}