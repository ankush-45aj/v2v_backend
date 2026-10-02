export class VehicleState {
    constructor(vehicleId, socket) {
        this.vehicleId = vehicleId;
        this.socket = socket;

        this.position = null;

        this.speed = 0;
        this.heading = 0;
        this.acceleration = 0;

        this.braking = false;

        this.lastSeen = Date.now();
    }

    updateTelemetry(data) {
        this.position = data.position;

        this.speed = data.motion?.speed ?? 0;
        this.heading = data.motion?.heading ?? 0;
        this.acceleration = data.motion?.acceleration ?? 0;

        this.braking = data.status?.braking ?? false;

        this.lastSeen = Date.now();
    }
}