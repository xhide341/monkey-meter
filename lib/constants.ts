// ── MonkeyMeter configuration constants ──

import type { SignalType, MonkeyState } from "./types";

/** Weight multipliers for each signal type (higher = more indicative of drift) */
export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  short_content: 0.5,
  dwell_drift: 0.6,
};

/** Time windows in milliseconds for rolling score computation */
export const TIME_WINDOWS = {
  "5m": 5 * 60 * 1000,
  "25m": 25 * 60 * 1000,
  "1h": 60 * 60 * 1000,
} as const;

/** Aggregation loop interval in minutes (chrome.alarms minimum is 0.5 in dev) */
export const AGGREGATION_ALARM_MINUTES = 1.0;

/** Exponential Moving Average alpha (0–1); higher = more responsive to recent data */
export const EMA_ALPHA = 0.3;

/** Score thresholds for monkey state transitions */
export const STATE_THRESHOLDS: Record<MonkeyState, number> = {
  focused: 0,
  curious: 25,
  distracted: 45,
  doom_mode: 65,
  chaos: 85,
};

/** Hysteresis margin to prevent rapid state oscillation (score points) */
export const STATE_HYSTERESIS = 5;

/** Score threshold that triggers the overlay prompt */
export const OVERLAY_TRIGGER_THRESHOLD = 55;

/** Minimum interval between overlay prompts (ms) — 5 minutes */
export const OVERLAY_COOLDOWN_MS = 5 * 60 * 1000;

/** Idle detection threshold — number of seconds without user activity to mark as idle */
export const IDLE_DETECTION_THRESHOLD_SECONDS = 60; // 1 minute of no activity

/** Auto-end session threshold — if idle for this long (ms), session ends automatically */
export const AUTO_END_IDLE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Dwell time thresholds (ms):
 * - DWELL_DRIFT_MIN: minimum time on a non-educational site before it counts as drift
 *   (short visits like checking a site and leaving are ignored)
 * - Higher dwell = higher weight, scaled proportionally
 */
export const DWELL_DRIFT_MIN_MS = 30_000; // 30 seconds — below this, no drift signal
export const DWELL_DRIFT_MAX_MS = 600_000; // 10 minutes — weight caps out here

/**
 * Rapid navigation detection: if URL changes N+ times within this window (ms)
 * we consider it drift behavior (e.g. swiping through Shorts, hopping pages)
 * (Still used by content script for SPA-style rapid navigation detection)
 */
export const RAPID_NAV_WINDOW_MS = 30_000;
export const RAPID_NAV_THRESHOLD = 3;

/** Max events to retain in storage (prevents unbounded growth) */
export const MAX_STORED_EVENTS = 2000;

/** Max activity log entries to retain in storage */
export const MAX_LOG_ENTRIES = 200;

/** Domain patterns for short-content detection */
export const SHORT_CONTENT_PATTERNS = [
  /youtube\.com\/shorts/,
  /tiktok\.com/,
  /instagram\.com\/reels/,
];

/** Keywords in page title/description that suggest educational/intentional content */
export const EDUCATIONAL_KEYWORDS = [
  "learn",
  "tutorial",
  "course",
  "study",
  "lecture",
  "lesson",
  "education",
  "training",
  "workshop",
  "guide",
  "how to",
  "documentation",
  "docs",
  "reference",
  "manual",
  "academy",
  "bootcamp",
  "masterclass",
  "certification",
  "exam",
  "quiz",
  "coding",
  "programming",
  "development",
  "engineering",
];

/** Sustained pattern threshold: number of short-content events within 5m to escalate weight */
export const SHORT_CONTENT_SUSTAIN_COUNT = 5;
