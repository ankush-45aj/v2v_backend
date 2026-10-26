const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

export function isValidPosition(position) {
    return position !== null &&
        typeof position === "object" &&
        Number.isFinite(position.latitude) &&
        position.latitude >= -90 &&
        position.latitude <= 90 &&
        Number.isFinite(position.longitude) &&
        position.longitude >= -180 &&
        position.longitude <= 180;
}

export function calculateDistance(position1, position2) {
    if (!isValidPosition(position1) || !isValidPosition(position2)) {
        throw new TypeError("Both positions must contain valid latitude and longitude");
    }

    const lat1 = toRadians(position1.latitude);
    const lat2 = toRadians(position2.latitude);

    const deltaLat = toRadians(
        position2.latitude - position1.latitude
    );

    const deltaLon = toRadians(
        position2.longitude - position1.longitude
    );

    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(Math.min(1, a)),
        Math.sqrt(Math.max(0, 1 - a))
    );

    return EARTH_RADIUS_METERS * c;
}