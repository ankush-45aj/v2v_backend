export class VehicleState {
    constructor(vehicleId, socket) {
        this.vehicleId = vehicleId;
        this.socket = socket;

        this.position = null;

        this.accuracy = null;
        this.measurementTimestamp = null;
        this.sequence = null;

        this.speed = 0;
        this.heading = 0;
        this.acceleration = 0;

        this.braking = false;

        this.lastSeen = Date.now();
    }

    updateTelemetry(data, timestamp) {
        this.position = { ...data.position };
        this.accuracy = data.accuracy ?? null;
        this.measurementTimestamp = timestamp;
        this.sequence = data.sequence ?? null;

        this.speed = data.motion?.speed ?? 0;
        this.heading = data.motion?.heading ?? 0;
        this.acceleration = data.motion?.acceleration ?? 0;

        this.braking = data.status?.braking ?? false;

        this.lastSeen = Date.now();
    }
}