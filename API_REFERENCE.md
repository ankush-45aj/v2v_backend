# V2V Backend API Reference

This document describes the HTTP and WebSocket interfaces currently implemented by the backend.

## Connection Details

- Local HTTP base URL: `http://localhost:8080`
- Local WebSocket URL: `ws://localhost:8080`
- On Render, use the service's assigned HTTPS URL for HTTP and `wss://` for WebSocket.
- JSON request bodies should use `Content-Type: application/json` and `Accept: application/json`.
- GET and DELETE requests do not need a request body.
- No endpoint currently requires authentication.

For Flutter testing:

- Android emulator: use `http://10.0.2.2:8080` and `ws://10.0.2.2:8080` to reach the development machine.
- Physical phone: use the development machine's LAN IP (for example, `http://192.168.1.20:8080`) and ensure both devices are on a reachable network.
- iOS simulator: `localhost` normally reaches the development machine. A physical iPhone needs the machine's LAN IP.
- Production: use the deployed HTTPS URL for HTTP and the same host with `wss://` for WebSocket.
- Android may block unencrypted HTTP/WebSocket traffic unless the development app's network security configuration permits cleartext traffic. Prefer HTTPS/WSS for deployed apps.

Common Flutter packages are `http` for REST, `web_socket_channel` for WebSocket, and `geolocator` for location. The backend does not provide a location-permission or GPS service; Flutter must request location permission and collect the phone's readings.

### Suggested Flutter flow

1. Call `GET /api/health` and `GET /api/config` to check the backend and read the configured range/freshness limits.
2. Optionally register the vehicle once with `POST /api/vehicles`. Registration is persistent; it does not create a live connection.
3. Open the WebSocket and send the `connect` message. Wait for the `connected` response before sending telemetry.
4. Listen to GPS updates and send `telemetry` frames on that same socket. Include GPS accuracy and the GPS measurement timestamp when available.
5. Listen continuously for `v2v_telemetry` and `error` frames. Use the received data to update nearby vehicle markers.
6. On reconnect, send `connect` again and resume telemetry. Live vehicle state is in-memory and is lost when the backend process restarts or the socket disconnects.

The server does not acknowledge successful telemetry or event writes. A `v2v_telemetry` frame is delivered only when another connected vehicle has a fresh position within range; use REST state/history endpoints for polling or persisted history.

## HTTP API

### `GET /api/health`

Basic process health check.

Response `200`:

```json
{
  "status": "ok",
  "service": "V2V Backend",
  "timestamp": 1790967223215
}
```

### `GET /api/status`

Returns service status and the number of currently connected WebSocket vehicles. This count is in-memory and resets when the process restarts.

Response `200`:

```json
{
  "status": "ok",
  "service": "V2V Backend",
  "activeVehicles": 1,
  "timestamp": 1790967223215
}
```

### `GET /api/config`

Returns public runtime settings.

Response `200`:

```json
{
  "v2vRangeMeters": 1000,
  "telemetryIntervalMs": 1000,
  "telemetryMaxAgeMs": 30000
}
```

`telemetryMaxAgeMs` is the maximum accepted measurement age and the freshness limit for V2V range calculations. It can be configured with `TELEMETRY_MAX_AGE_MS`.

### `GET /api/database/status`

Reports the Mongoose connection state. `200` means connected; a non-connected state returns `503`.

Response `200`:

```json
{
  "database": "MongoDB",
  "status": "connected"
}
```

### `POST /api/vehicles`

Registers a vehicle in MongoDB's `cars` collection. This does not connect it to the live WebSocket vehicle list.

Request:

```json
{
  "vehicleId": "CAR_01",
  "vehicleType": "car"
}
```

`vehicleType` is optional and defaults to `car`.

Response `201`:

```json
{
  "success": true,
  "message": "Vehicle registered successfully",
  "vehicle": {
    "_id": "...",
    "vehicleId": "CAR_01",
    "vehicleType": "car",
    "lastSeen": "2026-10-03T12:00:00.000Z",
    "createdAt": "2026-10-03T12:00:00.000Z",
    "updatedAt": "2026-10-03T12:00:00.000Z",
    "__v": 0
  }
}
```

Errors:

- `400`: `vehicleId` is missing or empty.
- `409`: a vehicle with that ID already exists in MongoDB or is currently connected.
- `500`: database or other server error; body has `success: false` and an `error` string.

### `GET /api/vehicles`

Returns vehicles currently connected over WebSocket, not every vehicle registered in MongoDB.

Response `200` when none are connected:

```json
{
  "success": true,
  "count": 0,
  "vehicles": []
}
```

Each live vehicle entry contains `vehicleId`, `position`, `speed`, `heading`, `acceleration`, `braking`, and `lastSeen`. Before its first telemetry message, `position` is `null` and the numeric/status values are defaults.
After its first telemetry message, entries also include optional `accuracy` (horizontal uncertainty in meters) and `measurementTimestamp` (the GPS measurement time in epoch milliseconds). `lastSeen` remains the server receipt time.

### `GET /api/vehicles/:vehicleId`

Looks up a currently connected vehicle only. A MongoDB registration by itself is not enough.

Success response `200` has the form `{"success":true,"vehicle":{...}}`.

Error `404`:

```json
{
  "success": false,
  "error": "VEHICLE_NOT_FOUND"
}
```

**Implementation note:** this route returns the internal vehicle object, including its WebSocket object. Do not use it in Flutter. Prefer `GET /api/vehicles/:vehicleId/state`, which returns explicit public fields.

### `GET /api/vehicles/:vehicleId/state`

Returns public live telemetry state for a connected vehicle.

Response `200`:

```json
{
  "success": true,
  "vehicleId": "CAR_01",
  "position": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "accuracy": 5,
  "measurementTimestamp": 1790967223215,
  "speed": 45,
  "heading": 90,
  "acceleration": 1.2,
  "braking": false,
  "lastSeen": 1790967223215
}
```

Error `404`: `{"success":false,"error":"VEHICLE_NOT_FOUND"}`.

### `DELETE /api/vehicles/:vehicleId`

Deletes the MongoDB registration if present and removes the live WebSocket connection if present. The active WebSocket is closed with code `1000` when deleted.

Response `200`:

```json
{
  "success": true,
  "message": "Vehicle removed successfully",
  "vehicleId": "CAR_01"
}
```

Errors: `404` if it was neither registered nor connected; `500` on a database/server error.

### `GET /api/vehicles/:vehicleId/telemetry`

Returns up to the latest 100 persisted telemetry records, newest first.

Response `200`:

```json
{
  "success": true,
  "vehicleId": "CAR_01",
  "count": 1,
  "telemetry": [
    {
      "_id": "...",
      "vehicleId": "CAR_01",
      "timestamp": "2026-10-03T12:00:00.000Z",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "accuracy": 5,
      "sequence": 105,
      "speed": 45,
      "heading": 90,
      "acceleration": 1.2,
      "braking": false
    }
  ]
}
```

An unknown vehicle ID returns `200` with `count: 0`; database errors return `500`.

### `POST /api/v2v/distance`

Calculates the Haversine distance between two positions in meters.

Request:

```json
{
  "vehicleA": { "latitude": 37.7749, "longitude": -122.4194 },
  "vehicleB": { "latitude": 37.775, "longitude": -122.4194 }
}
```

Response `200`:

```json
{
  "success": true,
  "distanceMeters": 11.119492664034915
}
```

Thrown errors return `400`. Both positions are required, and latitude/longitude must be finite numeric degrees within `-90..90` and `-180..180`. Invalid coordinates return `{"success":false,"error":"Both positions must contain valid latitude and longitude"}`.

### `POST /api/v2v/range`

Calculates distance and compares it with `V2V_RANGE_METERS` (default `1000`). Request body is the same as `/api/v2v/distance`.

Response `200`:

```json
{
  "success": true,
  "distanceMeters": 11.119492664034915,
  "withinRange": true
}
```

Thrown errors return `400`. It uses the same coordinate validation as the distance route.

### `GET /api/v2v/nearby/:vehicleId`

Returns connected vehicles within the configured range of a connected source vehicle. The source and nearby vehicles need telemetry positions first.

Response `200`:

```json
{
  "success": true,
  "vehicleId": "CAR_01",
  "rangeMeters": 1000,
  "nearbyVehicles": [
    {
      "vehicleId": "CAR_02",
      "distanceMeters": 11.1,
      "position": { "latitude": 37.775, "longitude": -122.4194 },
      "speed": 30,
      "heading": 180
    }
  ]
}
```

Errors: `404` if the source is not connected; `400` for a calculation error. A connected source without a position or with a stale position gets an empty `nearbyVehicles` list. Stale targets are omitted. Results include only connected vehicles and the configured range is read from `V2V_RANGE_METERS`.

### `GET /api/events`

Returns up to the latest 100 persisted events, newest first.

Response `200`:

```json
{
  "success": true,
  "count": 1,
  "events": [
    {
      "_id": "...",
      "vehicleId": "CAR_01",
      "eventType": "collision",
      "timestamp": "2026-10-03T12:00:00.000Z",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "data": { "severity": "high" }
    }
  ]
}
```

Database errors return `500`.

### `GET /api/events/:vehicleId`

Same response format as `/api/events`, filtered by vehicle ID. An ID with no events returns `200` and an empty list; database errors return `500`.

## WebSocket API

Connect to `ws://localhost:8080` locally. On Render, use `wss://<your-service-host>`. Send JSON text frames. There is no HTTP-style `Content-Type` header for individual WebSocket messages.

### Connect a vehicle

Send:

```json
{
  "type": "connect",
  "vehicleId": "CAR_01"
}
```

Success response:

```json
{
  "type": "connected",
  "vehicleId": "CAR_01",
  "message": "Vehicle connected successfully"
}
```

Missing ID returns `{"type":"error","message":"vehicleId is required"}`. An ID already connected on another socket returns `{"type":"error","message":"Vehicle already connected"}` and closes the new socket. Keep this socket open; closing it removes the vehicle from live state.

### Send telemetry

Send after connecting that vehicle ID:

```json
{
  "type": "telemetry",
  "vehicleId": "CAR_01",
  "position": { "latitude": 37.7749, "longitude": -122.4194 },
  "accuracy": 5.0,
  "timestamp": 1790967223215,
  "sequence": 105,
  "motion": { "speed": 45, "heading": 90, "acceleration": 1.2 },
  "status": { "braking": false }
}
```

Valid latitude and longitude must be finite numbers within `-90..90` and `-180..180`. `accuracy` is optional and, when supplied, must be a nonnegative number. `timestamp` is optional epoch milliseconds for when the GPS measurement was taken; if omitted, the server uses its receipt time. A supplied timestamp more than `telemetryMaxAgeMs` old or that far in the future is rejected. `sequence` is an optional nonnegative integer; when supplied, it must increase for that connection. Older timestamps are rejected so delayed messages cannot roll live state backward.

Speed must be a finite, nonnegative number; heading must be in `[0, 360)` and acceleration finite. Missing speed, heading, acceleration, or braking defaults to `0`, `0`, `0`, and `false`. Only the vehicle ID bound to the WebSocket connection may send its telemetry. Valid telemetry is saved to MongoDB and updates in-memory state. There is no success acknowledgment. If another connected vehicle has a fresh position and is in range, it receives a `v2v_telemetry` frame with source vehicle, unrounded `distance`/`distanceMeters`, server `timestamp`, GPS `measurementTimestamp`, optional `accuracy`, position, motion, and status.

`accuracy` reports the phone's GPS uncertainty; it does not improve the coordinates. Distance remains a calculation from the supplied GPS positions, so poor phone GPS or inaccurate timestamps still produce inaccurate physical estimates. For better measurements, the client must request high-accuracy location updates and send the provider's accuracy and measurement timestamp.

Validation/processing failures return `{"type":"error","message":"..."}`. Telemetry from a vehicle that has not connected returns `Vehicle is not connected`.

Server validation details:

- `position.latitude` and `position.longitude` must be finite numbers in their geographic ranges.
- `accuracy` is optional and, if provided, must be a finite nonnegative number in meters.
- `timestamp` is optional and, if provided, must be a nonnegative epoch-millisecond integer. It must be within `telemetryMaxAgeMs` of server time.
- `sequence` is optional and, if provided, must be a nonnegative integer greater than the sequence on the immediately previous accepted telemetry message. If a message omits `sequence`, the stored sequence is cleared; send it on every telemetry message if you want this check to remain effective.
- `motion.speed` must be finite and nonnegative; `motion.heading` must be in `[0, 360)`; `motion.acceleration` must be finite.
- `status.braking` must be a boolean.
- Missing speed, heading, acceleration, and braking default to `0`, `0`, `0`, and `false`.
- Telemetry for a vehicle ID different from the one connected on this WebSocket is rejected.

Note: the backend uses `timestamp` for ordering and freshness, but its proximity freshness check uses the timestamp of the GPS measurement. Keep device clocks reasonably synchronized, or omit `timestamp` and let the server use its receive time.

### Receive nearby telemetry

A connected target vehicle receives this frame when another vehicle's accepted telemetry is processed and both positions are fresh and within the configured range:

```json
{
  "type": "v2v_telemetry",
  "sourceVehicle": "CAR_02",
  "distance": 11.119492664034915,
  "distanceMeters": 11.119492664034915,
  "timestamp": 1790967223220,
  "measurementTimestamp": 1790967223215,
  "accuracy": 5.0,
  "position": { "latitude": 37.775, "longitude": -122.4194 },
  "motion": { "speed": 30, "heading": 180, "acceleration": 0.2 },
  "status": { "braking": false }
}
```

`timestamp` is when the backend created the outgoing frame; `measurementTimestamp` is when the source phone says it measured that location. The distance is calculated between the source and receiving vehicle's last positions. `accuracy` is the source location's optional reported GPS accuracy. No V2V frame is sent back to the source as an acknowledgment.

### Send an event

```json
{
  "type": "event",
  "vehicleId": "CAR_01",
  "eventType": "collision",
  "position": { "latitude": 37.7749, "longitude": -122.4194 },
  "data": { "severity": "high" }
}
```

The server persists the event but sends no success acknowledgment. Verify using `GET /api/events/CAR_01`. `vehicleId` and `eventType` are required by the database schema; persistence failures are returned as an error frame.

Event messages must use the vehicle ID connected on that WebSocket. `timestamp`, `position`, and `data` are optional. The backend does not currently validate an event timestamp or coordinate range.

### Heartbeat

Send `{"type":"heartbeat"}`. Response:

```json
{
  "type": "heartbeat_ack",
  "timestamp": 1790967223215
}
```

Unknown message types and malformed JSON return an error frame with `type: "error"` and a `message` string.

## Frontend Integration Notes

- Vehicle registration is persistent; live vehicle state requires a WebSocket connection.
- Telemetry and events are sent over WebSocket; there are no HTTP POST routes for them.
- Successful telemetry and event frames have no direct acknowledgment. Use the REST read routes to verify persisted data.
- Event submissions are not deduplicated; every valid event frame creates a new record.
- The API currently has no pagination parameters; history endpoints return at most 100 records.
- Error response formats vary by endpoint, so clients should handle both HTTP errors and JSON `error` values.
- `GET /api/status` and `GET /api/vehicles` describe active in-memory WebSocket connections, not all registered vehicles.
- `GET /api/vehicles/:vehicleId/telemetry`, `GET /api/events`, and `GET /api/events/:vehicleId` are MongoDB-backed history endpoints.
- No authentication or authorization is implemented. Do not expose the service publicly for sensitive or safety-critical use without adding appropriate security controls.