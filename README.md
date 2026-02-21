# 🐒 MonkeyMeter

**Is the monkey driving?**

We all have an instant-gratification monkey in our brain — the one from [Tim Urban's legendary TED talk](https://www.ted.com/talks/tim_urban_inside_the_mind_of_a_master_procrastinator). MonkeyMeter is a browser extension that tells you when that monkey has grabbed the wheel.

It watches for autopilot browsing patterns — doom-scrolling through Shorts/Reels/TikTok/Games and mindless link-hopping — and gently nudges you with a reflective prompt when your behavior looks more monkey than human.

## Tech Stack

- [WXT](https://wxt.dev) — next-gen browser extension framework
- React
- TypeScript
- Vanilla CSS
- Chrome Extensions Manifest V3

## Getting Started

```bash
# Install dependencies
npm install

# Run in dev mode (Chrome)
npm run dev

# Run in dev mode (Firefox)
npm run dev:firefox

# Build for production
npm run build

# Generate an unpackable extension ZIP file
npm run zip
```

## Manual Installation (Unpacked)
If you don't want to run the dev server, you can manually load the built extension:
1. Run `npm run zip` to generate a compiled `.zip` file in the `.output` directory.
2. Unzip the file.
3. Open your browser's extension page (e.g., `chrome://extensions`).
4. Enable **Developer Mode**.
5. Click **Load unpacked** and select the unzipped folder.

## License

MIT
