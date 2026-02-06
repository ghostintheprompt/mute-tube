# YouTube Ad Muter Extension 🔇

A lightweight Chrome extension that automatically mutes YouTube ads and skips them when possible. Because nobody has time for loud, obnoxious ads when you're just trying to vibe to music.

## What This Does

- **Auto-mutes** YouTube ads instantly
- **Auto-clicks** skip buttons when they appear
- **Runs silently** in the background
- **Zero configuration** needed

## Installation

1. Clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder
5. That's it. Go watch YouTube ad-free.

## How It Works

The extension uses content scripts to detect YouTube ads and automatically:
- Mute the video player when ads are detected
- Click skip buttons as soon as they become available
- Restore normal volume when ads end

## Files Structure

```
├── manifest.json      # Extension configuration
├── src/
│   ├── content/       # Scripts that run on YouTube pages
│   ├── background/    # Background service worker
│   ├── popup/         # Extension popup UI (optional)
│   └── utils/         # Helper functions
```

## Contributing

Found a bug? YouTube changed their ad system again? Open an issue or submit a PR.

## Disclaimer

This extension is for educational purposes. Use responsibly and consider supporting content creators you enjoy.