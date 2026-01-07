# API Reference

OpenTracker exposes several API endpoints for tracker operations and frontend interactions.

## Tracker Endpoints

### Announce

The announce endpoint is used by BitTorrent clients to report their status and receive peer lists.

#### HTTP Announce

```
GET /announce?info_hash={info_hash}&peer_id={peer_id}&port={port}&uploaded={uploaded}&downloaded={downloaded}&left={left}&event={event}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `info_hash` | string | 20-byte SHA-1 hash of the torrent's info dictionary (URL-encoded) |
| `peer_id` | string | 20-byte unique identifier for the client |
| `port` | integer | Port the client is listening on |
| `uploaded` | integer | Total bytes uploaded this session |
| `downloaded` | integer | Total bytes downloaded this session |
| `left` | integer | Bytes remaining to download (0 = seeder) |
| `event` | string | Optional: `started`, `completed`, `stopped` |
| `compact` | integer | Optional: 1 for compact peer list |
| `numwant` | integer | Optional: number of peers wanted (default: 50) |

**Response** (bencoded):

```
d8:completei10e10:incompletei5e8:intervali1800e5:peersXX:...e
```

### Scrape

Get statistics for one or more torrents:

```
GET /scrape?info_hash={info_hash}
```

**Response** (bencoded):

```
d5:filesd20:{info_hash}d8:completei10e10:downloadedi50e10:incompletei5eeee
```

## WebSocket Announces

OpenTracker supports WebSocket announces for WebTorrent clients:

```javascript
const ws = new WebSocket('wss://announce.your-domain.com')

ws.send(JSON.stringify({
  action: 'announce',
  info_hash: '...',
  peer_id: '...',
  // ... other parameters
}))
```

## REST API

### Authentication

All authenticated endpoints require a valid session cookie.

### Torrents

#### List Torrents

```
GET /api/torrents
```

Query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 25, max: 100) |
| `sort` | string | Sort field: `created`, `seeders`, `leechers`, `size` |
| `order` | string | Sort order: `asc`, `desc` |
| `category` | string | Filter by category slug |
| `search` | string | Full-text search query |

#### Get Torrent

```
GET /api/torrents/{id}
```

#### Download Torrent

```
GET /api/torrents/{id}/download
```

Returns the `.torrent` file with the user's passkey embedded.

### User

#### Get Current User

```
GET /api/user/me
```

#### Get User Stats

```
GET /api/user/{id}/stats
```

## Rate Limits

All API endpoints are rate-limited:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Read operations | 100 | 1 minute |
| Write operations | 10 | 1 minute |
| Authentication | 5 | 5 minutes |
| Tracker announces | 200 | 1 minute |

Exceeding limits returns `429 Too Many Requests`.

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later."
  }
}
```

Common error codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorized for this action |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
