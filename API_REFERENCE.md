# V2V Backend API Reference

This document describes the HTTP and WebSocket interfaces currently implemented by the backend.

## Connection Details

- Local HTTP base URL: `http://localhost:8080`
- Local WebSocket URL: `ws://localhost:8080`
- On Render, use the service's assigned HTTPS URL for HTTP and `wss://` for WebSocket.
- JSON request bodies should use `Content-Type: application/json` and `Accept: application/json`.
- GET and DELETE requests do not need a request body.
- No endpoint currently requires authentication.

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
  "telemetryIntervalMs": 1000
}
```

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

**Implementation note:** the current route returns the internal vehicle object, which includes its WebSocket object. Frontend code should not depend on that internal field; this response should be changed to return explicit public vehicle fields before production use.

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

Thrown errors return `400`. Coordinates should be numeric degrees: latitude `-90..90`, longitude `-180..180`. The current route does not validate these ranges or required fields; malformed values may produce `null`/non-finite results instead of a clean `400`.

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

Thrown errors return `400`. It has the same coordinate-validation limitation as the distance route.

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

Errors: `404` if the source is not connected; `400` for a calculation error. A connected source without a position gets an empty `nearbyVehicles` list.

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
  "motion": { "speed": 45, "heading": 90, "acceleration": 1.2 },
  "status": { "braking": false }
}
```

Valid latitude and longitude are numeric and within `-90..90` and `-180..180`; speed must be a nonnegative number. Missing speed, heading, acceleration, or braking defaults to `0`, `0`, `0`, and `false`. Valid telemetry is saved to MongoDB and updates in-memory state. There is no success acknowledgment. If another connected vehicle is in range, it receives a `v2v_telemetry` frame with source vehicle, distance, position, motion, and status.

Validation/processing failures return `{"type":"error","message":"..."}`. Telemetry from a vehicle that has not connected returns `Vehicle is not connected`.

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