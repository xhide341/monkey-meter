# 🐒 MonkeyMeter

**Is the monkey driving?**

We all have an instant-gratification monkey in our brain — the one from [Tim Urban's legendary TED talk](https://www.ted.com/talks/tim_urban_inside_the_mind_of_a_master_procrastinator). MonkeyMeter is a browser extension that tells you when that monkey has grabbed the wheel.

It watches for autopilot browsing patterns (doom-scrolling through Shorts/Reels/TikTok/Games) and gently nudges you with a reflective prompt when your behavior looks more monkey than human.

## Tech Stack

- WXT
- React
- TypeScript
- Vanilla CSS
- Chrome Extensions Manifest V3

## Getting Started

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build for production
npm run build
```

### Loading the Extension (Unpacked)
Whether you use `npm run dev` or `npm run build`, the compiled extension will be generated in the `.output` directory. You can use this directory to manually load the extension:

1. Open your browser's extension page (e.g., `chrome://extensions`).
2. Enable **Developer Mode**.
3. Click **Load unpacked** and select the generated folder inside the `.output` directory (e.g., `.output/chrome-mv3`).

## License

MIT
