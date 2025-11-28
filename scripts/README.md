# Video Download Script

Automated script to download videos from Fleek product pages.

## Prerequisites

1. **Node.js** (already installed if you can run `npm`)
2. **ffmpeg** - Required for video downloading

### Installing ffmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html) or use:
```bash
choco install ffmpeg
```

## Usage

### Basic Usage

```bash
npm run download-video https://www.joinfleek.com/products/y2k-jeans-140
```

This will:
1. Fetch the product page
2. Extract video URLs (m3u8, mp4, etc.)
3. Download the video using ffmpeg
4. Save it to `assets/{product-name}.mp4`

### Custom Output Path

```bash
npm run download-video https://www.joinfleek.com/products/y2k-jeans-140 --output assets/my-custom-name.mp4
```

### Direct Node Usage

```bash
node scripts/download-video.js https://www.joinfleek.com/products/y2k-jeans-140
```

## How It Works

1. **Fetches HTML** from the product page
2. **Extracts video URLs** using multiple patterns:
   - `<video>` tags
   - `<source>` tags
   - m3u8 HLS streams
   - Direct video file URLs (.mp4, .webm, etc.)
   - JSON data (for React/Next.js apps)
   - Data attributes
3. **Selects best URL** (prefers m3u8, then mp4)
4. **Downloads using ffmpeg** with `-c copy` (no re-encoding, fast)
5. **Saves to assets/** folder with product name

## Examples

```bash
# Download from Y2K jeans product page
npm run download-video https://www.joinfleek.com/products/y2k-jeans-140

# Output will be: assets/y2k_jeans_140.mp4
```

## Troubleshooting

### "ffmpeg is not installed"
- Install ffmpeg using instructions above
- Verify with: `ffmpeg -version`

### "No video URLs found"
- The script will save the page HTML to `debug_page.html`
- Check the file to see what's on the page
- The video might be loaded dynamically via JavaScript (not in initial HTML)

### Video not downloading
- Check the video URL found - it might be incorrect
- Try downloading the video URL directly in a browser
- Some videos might require authentication or headers

## Notes

- Videos are downloaded without re-encoding (`-c copy`) for speed
- The script prefers m3u8 streams (HLS) as they're usually the source
- If multiple video URLs are found, it picks the best one (m3u8 > mp4 > first found)
- The product name is extracted from the URL slug

