# Torznab API

Trackarr implements the Torznab API specification, enabling seamless integration with the \*arr ecosystem including **Prowlarr**, **Sonarr**, **Radarr**, and **Lidarr**.

## Overview

Torznab is an extension of the Newznab API tailored for torrent indexers. It provides a standardized interface that automation tools use to search and download torrents.

### Features

- 🔍 **Full-text search** with category filtering
- 📺 **TV search** with season/episode parsing
- 🎬 **Movie search** with IMDB support
- 🔐 **Dedicated API key**, revocable without touching your passkey
- 📦 **Personalized downloads** with announce URL injection

## Setup with Prowlarr

### Step 1: Open the Integrations page

1. Log in to Trackarr
2. Click your username in the top-right → **Integrations**
3. The page lists every value to paste, with copy buttons, and a **Test connection** button

### Step 2: Add Indexer in Prowlarr

1. Open Prowlarr → **Indexers** → **Add Indexer**
2. Select **Generic Torznab**
3. Configure:

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Name     | `Trackarr`                             |
| URL      | `https://your-tracker.com/api/torznab` |
| API Path | `/api` (the default)                   |
| API Key  | Your API key (`tk_…`) from Step 1      |

4. Click **Test** to verify the connection
5. Click **Save**

### Step 3: Sync with \*arr Apps

Prowlarr will automatically sync Trackarr as an indexer to your connected Sonarr, Radarr, and Lidarr instances.

::: tip Without Prowlarr
Sonarr, Radarr and Lidarr can also add Trackarr directly: **Settings → Indexers → + → Torznab**, with the same URL, API Path and API Key.
:::

## API Key

The API key (`tk_` followed by 40 hex characters) is only for Torznab apps. It is created the first time you open the Integrations page.

- **Regenerate key** on the Integrations page rotates it: apps using the old key stop working, your passkey and downloaded `.torrent` files are untouched
- The API key keeps the passkey out of app settings and logs, but it is **not a separate identity**: `.torrent` files downloaded with it carry the passkey. If the key leaks, regenerate it **and** ask an admin to reset your passkey (then re-download your active torrents)
- Downloaded `.torrent` files still carry your **passkey** in their announce URL, so nothing changes in your torrent client
- Indexers set up with the passkey as API key keep working, but switching to the API key is recommended: a leaked passkey means rotating it in every torrent
- An admin **passkey reset** also revokes the API key

## API Endpoints

All functions are served by a single endpoint (URL + API Path):

```
GET /api/torznab/api?t={function}&apikey={apiKey}&...
```

### Capabilities (`t=caps`)

Returns XML describing indexer capabilities. No authentication required.

```bash
curl "https://your-tracker.com/api/torznab/api?t=caps"
```

**Response:** XML with supported search types and categories.

### Search (`t=search`)

General torrent search.

```bash
curl "https://your-tracker.com/api/torznab/api?t=search&apikey=YOUR_API_KEY&q=ubuntu"
```

| Parameter | Type    | Required | Description                          |
| --------- | ------- | -------- | ------------------------------------ |
| `q`       | string  | No       | Search query                         |
| `cat`     | string  | No       | Comma-separated Newznab category IDs |
| `limit`   | integer | No       | Max results (default: 25, max: 100)  |
| `offset`  | integer | No       | Result offset for pagination         |

### TV Search (`t=tvsearch`)

Search with TV-specific parameters.

```bash
curl "https://your-tracker.com/api/torznab/api?t=tvsearch&apikey=YOUR_API_KEY&q=Breaking+Bad&season=1&ep=1"
```

| Parameter | Type   | Description    |
| --------- | ------ | -------------- |
| `season`  | string | Season number  |
| `ep`      | string | Episode number |

### Movie Search (`t=movie`)

Search with movie-specific parameters.

```bash
curl "https://your-tracker.com/api/torznab/api?t=movie&apikey=YOUR_API_KEY&imdbid=tt0111161"
```

| Parameter | Type   | Description                 |
| --------- | ------ | --------------------------- |
| `imdbid`  | string | IMDB ID (e.g., `tt1234567`) |

### Download

Download a torrent file with your passkey embedded in the announce URL.

```bash
curl -O "https://your-tracker.com/api/torznab/download?id=INFO_HASH&apikey=YOUR_API_KEY"
```

## Category Mapping

Trackarr categories are automatically mapped to Newznab standard IDs:

| Newznab ID | Category    | Trackarr Slugs            |
| ---------- | ----------- | ------------------------- |
| 2000       | Movies      | `movies`                  |
| 2040       | Movies/HD   | `movies-hd`               |
| 2045       | Movies/UHD  | `movies-uhd`, `movies-4k` |
| 5000       | TV          | `tv`                      |
| 5040       | TV/HD       | `tv-hd`                   |
| 5045       | TV/UHD      | `tv-uhd`, `tv-4k`         |
| 5070       | TV/Anime    | `anime`, `tv-anime`       |
| 3000       | Audio       | `audio`, `music`          |
| 4050       | PC/Games    | `games`, `games-pc`       |
| 7020       | Books/Ebook | `ebooks`, `books`         |

### Quick Setup: Seed Torznab Categories

For new installations, Trackarr provides a one-click solution to create Torznab-compatible categories:

1. Go to **Admin Panel → Categories**
2. If no categories exist, click **Seed Torznab Categories**
3. This creates the following structure:

| Category | Newznab ID | Subcategories                                                         |
| -------- | ---------- | --------------------------------------------------------------------- |
| Movies   | 2000       | HD (2040), UHD/4K (2045), SD (2030), Blu-Ray (2050)                   |
| TV       | 5000       | HD (5040), UHD/4K (5045), SD (5030), Anime (5070), Documentary (5080) |
| Audio    | 3000       | MP3 (3010), Lossless (3040)                                           |
| Games    | 4050       | PC (4050), Console (1000), PlayStation (1180), Xbox (1040)            |
| Software | 4000       | Windows (4020), Mac (4030)                                            |
| Books    | 7000       | Ebooks (7020), Comics (7030), Magazines (7010)                        |
| XXX      | 6000       | —                                                                     |
| Other    | 8000       | —                                                                     |

::: tip
All seeded categories include proper Newznab IDs, ensuring immediate compatibility with Prowlarr, Sonarr, Radarr, and Lidarr without any additional configuration.
:::

::: warning
The seed button only appears when no categories exist. To re-seed, delete all existing categories first.
:::

## Response Format

Search results are returned as RSS 2.0 with Torznab namespace extensions:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>Trackarr</title>
    <item>
      <title>Example.Movie.2024.1080p.BluRay</title>
      <guid>abc123...</guid>
      <pubDate>Wed, 08 Jan 2025 10:00:00 +0000</pubDate>
      <size>4500000000</size>
      <torznab:attr name="seeders" value="25"/>
      <torznab:attr name="peers" value="5"/>
      <enclosure url="https://..." type="application/x-bittorrent"/>
    </item>
  </channel>
</rss>
```

## Error Handling

Errors are returned as XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Incorrect user credentials"/>
```

| Code | Description                |
| ---- | -------------------------- |
| 100  | Incorrect user credentials |
| 101  | Account suspended          |
| 200  | Missing parameter          |
| 201  | Incorrect parameter        |
| 300  | No such function           |

## Security Notes

- **HTTPS Only**: Always use HTTPS to protect your API key
- **API key = Identity**: anyone with it can search and download as you, and read your passkey from the downloaded `.torrent` files. If it leaks, regenerate it and have an admin reset your passkey
- **Rate Limits**: API is rate limited to prevent abuse (see below)

## Rate Limits

Torznab endpoints are protected by a configurable rate limiting system. Default limits:

| Endpoint | Limit       | Window   |
| -------- | ----------- | -------- |
| Search   | 30 requests | 1 minute |
| Download | 20 requests | 1 minute |

Exceeding these limits will result in a `429 Too Many Requests` error. Repeated violations may result in temporary IP blacklisting with progressive penalties (5 min → 10 min → 20 min → up to 24h).

::: tip Admin Configuration
Rate limits can be configured from the **Admin Panel → Torznab API** page:

- **Time Window**: Duration for rate limit calculations (10-3600 seconds)
- **Search Limit**: Max search requests per window per user
- **Download Limit**: Max download requests per window per user

Admins can also:

- Enable/disable the Torznab API entirely
- Enable/disable request logging
- View real-time API statistics and usage
- Block specific users from API access
- Reset user passkeys (also revokes their API key)
- View blocked IPs and users
  :::

## Admin Panel Features

The Torznab API admin panel (`/admin/torznab`) provides comprehensive management:

### API Statistics

- Total requests, last 24h requests
- Unique API users
- Average response time
- Breakdown by function type (search, tvsearch, movie, download)
- Error count tracking

### Configuration

- Enable/disable API globally
- Toggle request logging
- Copy API endpoint URL

### Rate Limiting

- Adjustable time window (10s - 1h)
- Configurable search/download limits per user
- Quick presets (Strict, Default, Relaxed, Generous)

### User Management

- View all users with API access
- See per-user request counts and rate limit violations
- Reset user passkeys
- Block users from API access
- View per-user request logs

### Request Logs

- Real-time log of recent API requests
- Function type, query, results, response time
- Error tracking

### Blacklist Management

- View currently rate-limited IPs
- View manually blocked users
- Unblock users as needed

## Troubleshooting

### "Incorrect user credentials" error

- Copy the API key again from the Integrations page (`tk_` + 40 hex characters), it may have been regenerated
- Use **Test connection** on the Integrations page to check the key from the tracker itself
- Check that your account is not banned
- Ensure you're using the correct tracker URL

### No results returned

- Try a broader search query
- Check that the category filter matches available content
- Verify torrents exist in the requested categories

### Connection timeout

- Confirm the tracker URL is accessible
- Check firewall rules allow outbound HTTPS
- Try the capabilities endpoint first to test connectivity
