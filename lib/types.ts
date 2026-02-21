// ── Type definitions for MonkeyMeter behavioral tracking ──

/** Signal types detected from browser behavior */
export type SignalType = "short_content" | "dwell_drift";

/** A single tracked behavioral event */
export interface BehavioralEvent {
  id: string;
  type: SignalType;
  timestamp: number;
  /** Weight: 0–1, higher = more indicative of autopilot drift */
  weight: number;
  /** Domain where the event occurred */
  domain: string;
  /** Optional metadata for debugging */
  meta?: Record<string, unknown>;
}

/** Computed autopilot score for a time window */
export interface AutopilotScore {
  /** Time window label */
  window: "5m" | "25m" | "1h";
  /** Score percentage (0–100) */
  score: number;
  /** Number of events contributing to this score */
  eventCount: number;
  /** Trend direction compared to previous computation */
  trend: "up" | "down" | "stable";
  /** Timestamp of last computation */
  computedAt: number;
}

/** Monkey state labels with increasing drift severity */
export type MonkeyState =
  | "focused"
  | "curious"
  | "distracted"
  | "doom_mode"
  | "chaos";

/** Current activity data persisted to storage for the popup's "Currently" card */
export interface CurrentActivity {
  domain: string;
  url: string;
  startTime: number;
}

/** Log entry type categories for the activity log */
export type LogEntryType =
  | "navigation"
  | "short_content"
  | "youtube"
  | "dwell_drift"
  | "idle"
  | "resume"
  | "session_end";

/** A human-readable activity log entry shown in the popup */
export interface LogEntry {
  message: string;
  timestamp: number;
  type: LogEntryType;
  /** Domain where the activity occurred */
  domain: string;
  /** Points this activity contributed to the autopilot score (if any) */
  weight?: number;
}

/** User preferences stored alongside session data */
export interface UserPreferences {
  /** Domains the user has opted to suppress overlay prompts for */
  suppressedDomains: string[];
  /** Whether overlay prompts are enabled globally */
  overlayEnabled: boolean;
  /** Active intentional sessions per domain (timestamp of when they started) */
  intentionalSessions: Record<string, number>;
}

/** Full session data persisted in storage */
export interface SessionData {
  events: BehavioralEvent[];
  scores: AutopilotScore[];
  currentState: MonkeyState;
  preferences: UserPreferences;
  /** EMA-smoothed score used for state machine input */
  smoothedScore: number;
  lastUpdated: number;
  /** Timestamp when the session started (user clicked Start) */
  sessionStartedAt: number;
  /** Whether the user has an active tracking session */
  isSessionActive: boolean;
  /** Whether the active session is currently paused (scoring frozen, activity still tracked) */
  isSessionPaused: boolean;
  /** Timestamp when session was paused (0 if not paused) */
  sessionPausedAt: number;
  /** Total accumulated paused time in ms (across multiple pause/resume cycles) */
  totalSessionPausedMs: number;
  /** Human-readable activity log for the Activity Log tab */
  activityLog: LogEntry[];
  /** Last score change delta for live points display (e.g. +3, -2) */
  lastScoreDelta: number;
  /** Timeline of focus scores (0-100) recorded every 30s for the growing sparkline */
  focusTimeline: number[];
}

/** Overlay response actions */
export type OverlayResponse = "intentional" | "monkey_mode" | "dont_ask_again";

/** Message types between background and content scripts */
export type ExtensionMessage =
  | { type: "SHOW_OVERLAY"; score: number }
  | { type: "OVERLAY_RESPONSE"; response: OverlayResponse; domain: string }
  | { type: "RAPID_NAVIGATION"; domain: string; navCount: number }
  | { type: "PAGE_EDUCATIONAL"; domain: string; title: string }
  | { type: "GET_SCORES" }
  | { type: "SCORES_UPDATE"; scores: AutopilotScore[]; state: MonkeyState }
  | { type: "START_SESSION" }
  | { type: "END_SESSION" }
  | { type: "PAUSE_SESSION" }
  | { type: "RESUME_SESSION" };
