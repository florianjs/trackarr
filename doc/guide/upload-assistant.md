# Upload Assistant

Creating a good torrent takes many steps: build the `.torrent`, run MediaInfo, take screenshots, host them, write the description. The upload assistant does all of it from one file or folder, in the browser or from a terminal.

| Step | What happens |
| --- | --- |
| `.torrent` | Private, with your personal announce URL, and a `source` tag (the tracker's host) so the same files shared elsewhere get another info hash. The tracker keeps the same info hash: you seed the file you just created. |
| MediaInfo | Read from the largest video: container, duration, size, every video, audio and subtitle track. The full report goes in a spoiler, without your local path. |
| Screenshots | Spread over the video (intro and credits skipped), hosted on [Pixhost](https://pixhost.to). Tick **Adult content** to file them as NSFW there. |
| Description | BBCode, in the language you pick (8 languages): title, release details read from the name (source, group), tracks, screenshots, file list. Editable before publishing. |
| Publish | Name, category, tags, IMDb/TMDb/TVDB IDs, and the torrent goes to the tracker (moderation rules apply as usual). |

## In the browser

**Home → Upload assistant** (also linked from the upload window), or `/upload/assistant`.

Drop a file or a folder, or pick one. Everything runs in your browser: the files are never sent to the tracker, only the screenshots (relayed to Pixhost) and the `.torrent`.

- MediaInfo comes from [mediainfo.js](https://github.com/buzz/mediainfo.js) (WebAssembly).
- Screenshots use the browser's own decoder. For what it cannot play (HEVC in MKV, AVI, old codecs...), the assistant loads [ffmpeg.wasm](https://ffmpegwasm.netlify.app) (about 30 MB, once) and reads the file in place: nothing is copied into memory.
- Hashing reads the files piece by piece: a 50 GB release works, at the speed of your disk and browser (slower than a native client).

Once published, **Download the .torrent** and add it to your client, saving to the folder that holds the files: it checks them and starts seeding at once.

## From a terminal

For large releases or batches, `trackarr-upload.mjs` does the same, faster. Download it from the assistant page (`/tools/trackarr-upload.mjs`). It needs **Node.js 20+**, **ffmpeg** and **mediainfo** in the `PATH` (without mediainfo it still works, with a shorter description).

```bash
# macOS: brew install ffmpeg mediainfo   Debian/Ubuntu: apt install ffmpeg mediainfo
node trackarr-upload.mjs "/data/Movie.2024.1080p.WEB-DL-GROUP" \
  --url https://tracker.example --key tk_... --save \
  --category "Movies/HD" --lang fr --adult
```

The key is the API key of the **Integrations** page. `--save` remembers the address and key in `~/.config/trackarr-upload.json`; the next runs only need the path. `--dry-run` builds everything and writes `<name>.torrent` and `<name>.bbcode.txt` without publishing. `node trackarr-upload.mjs --help` lists every option.

With ffmpeg built with zimg (most builds), HDR screenshots are tone-mapped so they do not look washed out.

::: warning API key, uploads and passkey
The CLI publishes with the same API key as Prowlarr or Sonarr (`Authorization: Bearer`). Anyone holding that key can upload in your name, and can read your passkey: it is in the announce URL of every `.torrent` the key downloads (Torznab) and in the assistant settings. If the key leaks, **regenerate it and reset your passkey**, both on the Integrations page, then download your seeding torrents again.
:::

## Descriptions in BBCode

Torrent descriptions accept BBCode as well as Markdown: a description using BBCode tags (`[b]`, `[url]`, `[img]`, `[spoiler]`...) is rendered as BBCode, any other as Markdown. Supported: `b i u s`, `center left right`, `size=1-7`, `color`, `url`, `img`, `quote`, `code`, `spoiler`, `list` / `[*]`, `hr`. Everything is escaped and sanitized; links and images must be `http(s)`.

Descriptions can hold up to 50,000 characters, room for a full MediaInfo report.

## Server side

| Variable          | Description                                                     | Default                          |
| ----------------- | --------------------------------------------------------------- | -------------------------------- |
| `PIXHOST_API_URL` | Image upload endpoint, for a proxy or tests                     | `https://api.pixhost.to/images`  |

The tracker relays screenshots to Pixhost for the browser (`POST /api/upload-assistant/screenshot`, 30 per minute, 10 MB each, JPEG/PNG/WebP checked by content): the page's security policy lets it talk to the tracker only. The page needs `'wasm-unsafe-eval'` in the Content Security Policy for WebAssembly (it allows compiling WebAssembly, not `eval()` of JavaScript); the tracker sets it.
