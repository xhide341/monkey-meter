// ── Storage Layer: WXT storage.defineItem-based typed storage ──

import type {
  SessionData,
  BehavioralEvent,
  AutopilotScore,
  MonkeyState,
  CurrentActivity,
} from "./types";
import { MAX_STORED_EVENTS, MAX_LOG_ENTRIES } from "./constants";

/** Default session data for first-time initialization */
function defaultSession(): SessionData {
  return {
    events: [],
    scores: [
      {
        window: "5m",
        score: 0,
        eventCount: 0,
        trend: "stable",
        computedAt: Date.now(),
      },
      {
        window: "25m",
        score: 0,
        eventCount: 0,
        trend: "stable",
        computedAt: Date.now(),
      },
      {
        window: "1h",
        score: 0,
        eventCount: 0,
        trend: "stable",
        computedAt: Date.now(),
      },
    ],
    currentState: "focused",
    preferences: {
      suppressedDomains: [],
      overlayEnabled: true,
      intentionalSessions: {},
    },
    smoothedScore: 0,
    lastUpdated: Date.now(),
    sessionStartedAt: 0,
    isSessionActive: false,
    isSessionPaused: false,
    sessionPausedAt: 0,
    totalSessionPausedMs: 0,
    activityLog: [],
    lastScoreDelta: 0,
    focusTimeline: [],
  };
}

// ── WXT storage items with typed defaults ──

/** Primary session data storage item */
export const sessionItem = storage.defineItem<SessionData>(
  "local:monkeyMeterSession",
  {
    fallback: defaultSession(),
  },
);

/** Current activity — written by background on tab change, read by popup for "Currently" card */
export const currentActivityItem = storage.defineItem<CurrentActivity | null>(
  "local:currentActivity",
  {
    fallback: null,
  },
);

/** Load full session data */
export async function loadSession(): Promise<SessionData> {
  return await sessionItem.getValue();
}

/**
 * Save session data to storage.
 * Automatically prunes historical events and activity logs that exceed
 * the maximum cap before persisting to prevent unbounded growth.
 */
export async function saveSession(data: SessionData): Promise<void> {
  const updated = { ...data, lastUpdated: Date.now() };

  if (updated.events.length > MAX_STORED_EVENTS) {
    updated.events = updated.events.slice(-MAX_STORED_EVENTS);
  }

  if (updated.activityLog && updated.activityLog.length > MAX_LOG_ENTRIES) {
    updated.activityLog = updated.activityLog.slice(-MAX_LOG_ENTRIES);
  }

  await sessionItem.setValue(updated);
}

/** Start a new tracking session — clears old data and activates tracking */
export async function startSession(): Promise<SessionData> {
  const session = defaultSession();
  session.isSessionActive = true;
  session.sessionStartedAt = Date.now();
  await sessionItem.setValue(session);
  return session;
}

/** End the current session — deactivates tracking, preserves final data snapshot */
export async function endSession(): Promise<SessionData> {
  const session = await loadSession();
  session.isSessionActive = false;
  session.isSessionPaused = false;
  session.sessionPausedAt = 0;
  await saveSession(session);
  return session;
}

/** Pause the current session — marks pause timestamp in storage for popup timer */
export async function pauseSession(): Promise<SessionData> {
  const session = await loadSession();
  if (!session.isSessionActive || session.isSessionPaused) return session;
  session.isSessionPaused = true;
  session.sessionPausedAt = Date.now();
  await saveSession(session);
  return session;
}

/** Resume a paused session — accumulates paused time, clears pause state */
export async function resumeSession(): Promise<SessionData> {
  const session = await loadSession();
  if (!session.isSessionActive || !session.isSessionPaused) return session;
  const pausedDuration = Date.now() - session.sessionPausedAt;
  session.totalSessionPausedMs += pausedDuration;
  session.isSessionPaused = false;
  session.sessionPausedAt = 0;
  await saveSession(session);
  return session;
}

/** Add a domain to the "Don't Ask Again" suppression list */
export async function suppressDomain(domain: string): Promise<void> {
  const session = await loadSession();
  if (!session.preferences.suppressedDomains.includes(domain)) {
    session.preferences.suppressedDomains.push(domain);
    await saveSession(session);
  }
}

/** Check if a domain is suppressed */
export async function isDomainSuppressed(domain: string): Promise<boolean> {
  const session = await loadSession();
  return session.preferences.suppressedDomains.includes(domain);
}

/** Mark a domain as "intentional" for the current session (1h expiry) */
export async function markIntentional(domain: string): Promise<void> {
  const session = await loadSession();
  session.preferences.intentionalSessions[domain] = Date.now() + 60 * 60 * 1000;
  await saveSession(session);
}

/** 
 * Check if a domain is currently marked intentional.
 * Validates against expiry time and automatically cleans up expired sessions.
 */
export async function isIntentional(domain: string): Promise<boolean> {
  const session = await loadSession();
  const expiry = session.preferences.intentionalSessions[domain];
  if (!expiry) return false;
  if (Date.now() > expiry) {
    delete session.preferences.intentionalSessions[domain];
    await saveSession(session);
    return false;
  }
  return true;
}
