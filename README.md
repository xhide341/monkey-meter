# 🐒 MonkeyMeter

**Is the monkey driving?**

We all have an instant-gratification monkey in our brain — the one from [Tim Urban's legendary TED talk](https://www.ted.com/talks/tim_urban_inside_the_mind_of_a_master_procrastinator). MonkeyMeter is a browser extension that tells you when that monkey has grabbed the wheel.

It watches for autopilot browsing patterns — doom-scrolling through Shorts/Reels/TikTok/Games and mindless link-hopping — and gently nudges you with a reflective prompt when your behavior looks more monkey than human.

## How It Works

MonkeyMeter runs quietly in the background and tracks behavioral signals that indicate autopilot browsing:

| Signal                  | What it detects                                         |
| ----------------------- | ------------------------------------------------------- |
| 🎮 **Distracting content** | Time spent on YouTube Shorts, TikTok, Reels, Games, etc |
| ⏱️ **Dwell drift**      | Extended time on non-educational sites (30s+)           |

These signals feed into a **scoring engine** that computes an autopilot score across rolling time windows (5m, 25m, 1h). The score drives a state machine with five monkey states:

> 🧘 Focused → 🐒 Curious → 🙈 Distracted → 🙊 Doom Mode → 🐵💥 Chaos

### Smart Idle Detection

MonkeyMeter **automatically pauses drift tracking** when:

- 🛋️ You're idle (no mouse/keyboard activity for 60+ seconds)
- ⏸️ System detects you're away from keyboard

This ensures accurate scoring — if you step away from your computer or switch to another app, that time won't count against you. All pause/resume events are logged in the activity log for full transparency.

### Reflective Overlay

When the score crosses a threshold, an **overlay** appears on your current page asking:

- **"✅ Intentional"** — you're in control, monkey stands down
- **"🐒 Monkey Mode"** — acknowledged, score stays
- **"🔇 Don't Ask Again"** — suppresses future prompts for that domain

The extension also recognizes **educational content** (docs, tutorials, courses) and reduces the weight of signals from those pages — because reading MDN for 30 minutes isn't doom-scrolling.

## Tech Stack

- [WXT](https://wxt.dev) — next-gen browser extension framework
- TypeScript
- Vanilla CSS
- Chrome Extensions Manifest V3

## Project Structure

```
entrypoints/
├── background.ts          # Service worker: dwell tracking, idle detection, scoring loop
├── overlay.content.ts     # Content script: educational page classifier + overlay UI
└── popup/                 # Extension popup: live score dashboard + activity log
lib/
├── types.ts               # Type definitions
├── events.ts              # Behavioral event detection (short content, dwell drift)
├── scoring.ts             # Weighted autopilot score computation
├── state-machine.ts       # Monkey state transitions with hysteresis
├── session.ts             # Event aggregation and EMA smoothing
├── storage.ts             # Persisted session data and user preferences
└── constants.ts           # Thresholds, time windows, and configuration
```

## Features

- 📊 **Live Dashboard** — Real-time autopilot score with emoji state indicator
- 📝 **Activity Log** — Detailed browsing history with drift tracking events
- ⏸️ **Idle Detection** — Automatically pauses tracking when you're AFK
- 🎓 **Educational Filtering** — Recognizes learning content and reduces drift scoring
- 🎯 **Domain Preferences** — Mark sites as intentional or suppress prompts
- 📈 **Focus Timeline** — Visual sparkline showing your focus over time

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
```

## License

MIT
