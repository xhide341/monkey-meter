import type {
  AutopilotScore,
  MonkeyState,
  LogEntry,
  CurrentActivity,
} from "@/lib/types";
import { loadSession, currentActivityItem } from "@/lib/storage";

/** Shape of the data returned by fetchSessionData */
export interface SessionInfo {
  scores: AutopilotScore[];
  state: MonkeyState;
  smoothedScore: number;
  sessionStartedAt: number;
  activityLog: LogEntry[];
  lastScoreDelta: number;
  isSessionActive: boolean;
  isSessionPaused: boolean;
  sessionPausedAt: number;
  totalSessionPausedMs: number;
  focusTimeline: number[];
}

/** Fetch session data — tries background message first, falls back to storage */
export async function fetchSessionData(): Promise<SessionInfo> {
  try {
    const response = await browser.runtime.sendMessage({ type: "GET_SCORES" });
    if (response && response.scores) {
      return {
        scores: response.scores,
        state: response.state,
        smoothedScore: response.smoothedScore,
        sessionStartedAt: response.sessionStartedAt,
        activityLog: response.activityLog,
        lastScoreDelta: response.lastScoreDelta,
        isSessionActive: response.isSessionActive ?? false,
        isSessionPaused: response.isSessionPaused ?? false,
        sessionPausedAt: response.sessionPausedAt ?? 0,
        totalSessionPausedMs: response.totalSessionPausedMs ?? 0,
        focusTimeline: response.focusTimeline ?? [],
      };
    }
  } catch {
    // Fallback to storage
  }

  const session = await loadSession();
  return {
    scores: session.scores,
    state: session.currentState,
    smoothedScore: session.smoothedScore,
    sessionStartedAt: session.sessionStartedAt,
    activityLog: session.activityLog,
    lastScoreDelta: session.lastScoreDelta,
    isSessionActive: session.isSessionActive,
    isSessionPaused: session.isSessionPaused ?? false,
    sessionPausedAt: session.sessionPausedAt ?? 0,
    totalSessionPausedMs: session.totalSessionPausedMs ?? 0,
    focusTimeline: session.focusTimeline,
  };
}

/** Fetch current activity from WXT storage */
export async function fetchCurrentActivity(): Promise<CurrentActivity | null> {
  return currentActivityItem.getValue();
}

/** Watch for live current-activity changes. Returns unsubscribe function. */
export function watchCurrentActivity(
  cb: (activity: CurrentActivity | null) => void,
): () => void {
  const unsub = currentActivityItem.watch(cb);
  return unsub;
}

// ── Formatting helpers ──

export function formatSessionTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatLiveTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── URL detection helpers ──

const YOUTUBE_VIDEO_RE = /youtube\.com\/watch/;
const YOUTUBE_SHORTS_RE = /youtube\.com\/shorts\//;

export function getActivityLabel(
  url: string,
  domain: string,
): { label: string; faviconUrl: string } {
  let label = `Browsing ${domain}`;

  if (domain === "www.youtube.com" || domain === "youtube.com") {
    if (YOUTUBE_SHORTS_RE.test(url)) label = "Watching a YouTube Short";
    else if (YOUTUBE_VIDEO_RE.test(url)) label = "Watching a YouTube video";
    else label = "Browsing YouTube";
  } else if (domain.includes("tiktok.com")) {
    label = "Scrolling TikTok";
  } else if (domain.includes("instagram.com") && url.includes("/reels")) {
    label = "Watching Instagram Reels";
  } else if (domain.includes("reddit.com")) {
    label = "Browsing Reddit";
  } else if (domain.includes("facebook.com")) {
    label = "Browsing Facebook";
  } else if (domain.includes("twitter.com") || domain === "x.com") {
    label = "Scrolling X";
  }

  const pageUrl = `https://${domain}`;
  const faviconUrl = `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=16`;
  return { label, faviconUrl };
}

export function getLogIcon(
  type: string,
  domain: string,
): { emoji?: string; faviconUrl?: string } {
  if (type === "dwell_drift") return { emoji: "🐒" };
  if (type === "idle") return { emoji: "⏸️" };
  if (type === "resume") return { emoji: "▶️" };
  if (type === "session_end") return { emoji: "⏹️" };
  if (domain === "system" || !domain) return { emoji: "🌐" };

  const pageUrl = `https://${domain}`;
  return {
    faviconUrl: `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=16`,
  };
}
