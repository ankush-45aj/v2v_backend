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

    if (!data.vehicleId) {
        return {
            valid: false,
            error: "vehicleId is required"
        };
    }

    if (!data.position) {
        return {
            valid: false,
            error: "position is required"
        };
    }

    const { latitude, longitude } = data.position;

    if (
        typeof latitude !== "number" ||
        latitude < -90 ||
        latitude > 90
    ) {
        return {
            valid: false,
            error: "Invalid latitude"
        };
    }

    if (
        typeof longitude !== "number" ||
        longitude < -180 ||
        longitude > 180
    ) {
        return {
            valid: false,
            error: "Invalid longitude"
        };
    }

    const speed = data.motion?.speed ?? 0;

    if (typeof speed !== "number" || speed < 0) {
        return {
            valid: false,
            error: "Invalid speed"
        };
    }

    return {
        valid: true
    };
}