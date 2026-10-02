const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

export function calculateDistance(position1, position2) {
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
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return EARTH_RADIUS_METERS * c;
}