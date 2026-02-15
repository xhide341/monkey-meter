// ── Popup Logic: Read session from WXT storage, render UI, tab switching ──
// Handles session start/end controls and reads focusTimeline from storage for the sparkline

import type {
  AutopilotScore,
  MonkeyState,
  LogEntry,
  CurrentActivity,
} from "@/lib/types";
import { getStateDisplay } from "@/lib/state-machine";
import { loadSession, currentActivityItem } from "@/lib/storage";

// ── Timer interval handles ──
let timerInterval: ReturnType<typeof setInterval> | null = null;
let activityTimerInterval: ReturnType<typeof setInterval> | null = null;

/** Read scores and session data from shared WXT storage */
async function fetchSessionData(): Promise<{
  scores: AutopilotScore[];
  state: MonkeyState;
  smoothedScore: number;
  sessionStartedAt: number;
  activityLog: LogEntry[];
  lastScoreDelta: number;
  isSessionActive: boolean;
  focusTimeline: number[];
}> {
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
    focusTimeline: session.focusTimeline,
  };
}

// ── Tab switching logic ──
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    // Clone and replace to remove any stale listeners from previous init() calls
    const fresh = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(fresh, btn);

    fresh.addEventListener("click", () => {
      const target = fresh.dataset.tab;

      // Deactivate all tabs
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => {
        c.classList.remove("active");
        // Clear any lingering inline display styles so CSS rules take over
        (c as HTMLElement).style.display = "";
      });

      // Activate selected tab
      fresh.classList.add("active");
      document.getElementById(`tab-${target}`)?.classList.add("active");
    });
  });
}

/** Format session elapsed time: M:SS under an hour, H:MM:SS at an hour+ */
function formatSessionTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format a timestamp into an absolute local time: "8:45 PM" */
function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Pick the best platform icon using Chrome's favicon API for all sites */
function getLogIcon(entry: LogEntry): string {
  const { type, domain } = entry;

  // Special case for system messages (no domain)
  if (type === "dwell_drift") return "🐒";
  if (type === "idle") return "⏸️";
  if (type === "resume") return "▶️";
  if (type === "session_end") return "⏹️";
  if (domain === "system" || !domain) return "🌐";

  // Use Chrome's built-in favicon API for all sites
  const pageUrl = `https://${domain}`;
  return `<img src="chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=16" alt="${domain}" class="favicon-img" />`;
}

// ── Session screen toggling ──
// Uses class-based visibility so CSS tab switching (.active) isn't broken by inline styles

/** Show the start screen, hide tabs and dashboard */
function showStartScreen() {
  document.getElementById("start-screen")!.style.display = "flex";
  document.getElementById("tab-bar")!.style.display = "none";

  // Remove .active and clear inline display from all tab contents
  document.querySelectorAll(".tab-content").forEach((el) => {
    el.classList.remove("active");
    (el as HTMLElement).style.display = "";
  });
}

/** Show the active session UI (tabs + dashboard) */
function showActiveSession() {
  document.getElementById("start-screen")!.style.display = "none";
  document.getElementById("tab-bar")!.style.display = "";

  // Clear inline display from all tab contents and reset to CSS class-based toggling
  const activeTabBtn = document.querySelector(".tab-btn.active") as HTMLElement;
  const target = activeTabBtn?.dataset.tab ?? "dashboard";
  document.querySelectorAll(".tab-content").forEach((el) => {
    el.classList.remove("active");
    (el as HTMLElement).style.display = "";
  });
  document.getElementById(`tab-${target}`)?.classList.add("active");
}

/** Render the dashboard tab: avatar, single score, session timer */
function renderDashboard(
  scores: AutopilotScore[],
  state: MonkeyState,
  smoothedScore: number,
  sessionStartedAt: number,
  focusTimeline: number[],
) {
  const display = getStateDisplay(state);

  // Avatar section
  const avatarEmoji = document.getElementById("avatar-emoji")!;
  const avatarRing = document.getElementById("avatar-ring")!;
  const stateLabel = document.getElementById("state-label")!;

  avatarEmoji.textContent = display.emoji;
  avatarRing.style.borderColor = display.color;
  avatarRing.style.boxShadow = `0 0 20px ${display.color}40, 0 0 40px ${display.color}20`;
  stateLabel.textContent = display.label;
  stateLabel.style.color = display.color;

  // Apply animation intensity based on state
  const animClass = `avatar-${state}`;
  avatarRing.className = `avatar-ring ${animClass}`;

  // Focus score: invert drift score so 100% = fully focused, 0% = max distraction
  const focusScore = Math.max(
    0,
    Math.min(100, 100 - Math.round(smoothedScore)),
  );
  const scoreEl = document.getElementById("session-score")!;
  scoreEl.textContent = `${focusScore}%`;

  // Color the score — high focus = green, low focus = red
  if (focusScore >= 80) {
    scoreEl.style.color = "#4ade80";
  } else if (focusScore >= 60) {
    scoreEl.style.color = "#facc15";
  } else if (focusScore >= 35) {
    scoreEl.style.color = "#fb923c";
  } else {
    scoreEl.style.color = "#f87171";
  }

  // Contextual summary message below the score
  const summaryEl = document.getElementById("score-summary")!;
  if (focusScore >= 90) {
    summaryEl.textContent = "You're fully locked in! 🎯";
  } else if (focusScore >= 70) {
    summaryEl.textContent = "Mostly focused, slight drift";
  } else if (focusScore >= 50) {
    summaryEl.textContent = "Starting to wander off...";
  } else if (focusScore >= 30) {
    summaryEl.textContent = "Significant drift detected ⚠️";
  } else {
    summaryEl.textContent = "The monkey is in control 🐒";
  }

  // Session timer — ticks every second for real-time display
  updateTimer(sessionStartedAt);
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => updateTimer(sessionStartedAt), 1_000);

  // Render sparkline from persisted focusTimeline (survives popup reopens)
  renderSparkline(focusTimeline);
}

/** Update the session timer display with real-time M:SS or H:MM:SS */
function updateTimer(sessionStartedAt: number) {
  const timerEl = document.getElementById("session-timer")!;
  const elapsed = Date.now() - sessionStartedAt;
  timerEl.textContent = `⏱ ${formatSessionTimer(elapsed)}`;
}

/** Render the activity log tab with human-readable entries and per-entry weight */
function renderActivityLog(activityLog: LogEntry[]) {
  const container = document.getElementById("log-container")!;
  const emptyEl = document.getElementById("log-empty")!;

  // Clear existing entries (except the empty placeholder)
  const existingEntries = container.querySelectorAll(".log-entry");
  existingEntries.forEach((el) => el.remove());

  if (!activityLog || activityLog.length === 0) {
    emptyEl.style.display = "block";
    return;
  }

  emptyEl.style.display = "none";

  // Render entries in reverse chronological order (newest first)
  const sorted = [...activityLog].reverse();

  for (const entry of sorted) {
    const row = document.createElement("div");
    row.className = "log-entry";

    // Drift events get a highlighted style
    if (entry.type !== "navigation") {
      row.classList.add("log-entry--drift");
    }

    // Build weight badge HTML — only show if the entry contributed points
    let weightHtml = "";
    if (entry.weight && entry.weight > 0) {
      const weightText = `+${entry.weight.toFixed(1)}`;
      weightHtml = `<span class="log-weight">${weightText}</span>`;
    }

    row.innerHTML = `
      <span class="log-icon">${getLogIcon(entry)}</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
      <span class="log-meta">
        ${weightHtml}
        <span class="log-time">${formatAbsoluteTime(entry.timestamp)}</span>
      </span>
    `;

    container.appendChild(row);
  }
}

/** Escape HTML to prevent XSS from domain/URL strings */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Draw the session sparkline from persisted focusTimeline data */
function renderSparkline(data: number[]) {
  const canvas = document.getElementById("sparkline") as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const padding = 4;

  ctx.clearRect(0, 0, w, h);

  if (data.length < 2) {
    // Flat line when not enough data
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, h / 2);
    ctx.lineTo(w - padding, h / 2);
    ctx.stroke();
    return;
  }

  const max = Math.max(...data, 100);
  const stepX = (w - 2 * padding) / (data.length - 1);

  // Gradient fill under the line
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "rgba(251, 146, 60, 0.3)");
  gradient.addColorStop(1, "rgba(251, 146, 60, 0)");

  ctx.beginPath();
  ctx.moveTo(padding, h - padding);
  for (let i = 0; i < data.length; i++) {
    const x = padding + i * stepX;
    const y = h - padding - (data[i] / max) * (h - 2 * padding);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(padding + (data.length - 1) * stepX, h - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line stroke
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = padding + i * stepX;
    const y = h - padding - (data[i] / max) * (h - 2 * padding);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#fb923c";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // Dot on the latest point
  const lastX = padding + (data.length - 1) * stepX;
  const lastY = h - padding - (data[data.length - 1] / max) * (h - 2 * padding);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#fb923c";
  ctx.fill();
}

// ── URL detection helpers for smart activity labels ──
const YOUTUBE_VIDEO_RE = /youtube\.com\/watch/;
const YOUTUBE_SHORTS_RE = /youtube\.com\/shorts\//;

/** Get a friendly label + icon HTML for the current URL (SVG placeholders) */
function getActivityLabel(
  url: string,
  domain: string,
): { label: string; icon: string } {
  // Generate smart labels based on URL patterns
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

  // Use Chrome's built-in favicon API for all sites
  const pageUrl = `https://${domain}`;
  const faviconUrl = `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=16`;
  return {
    label,
    icon: `<img src="${faviconUrl}" alt="${domain}" class="favicon-img" />`,
  };
}

/** Format milliseconds into M:SS or H:MM:SS for the live counter */
function formatLiveTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Render or hide the "Currently" card based on storage data */
function renderCurrentActivity(activity: CurrentActivity | null) {
  const section = document.getElementById("current-activity")!;
  if (activityTimerInterval) {
    clearInterval(activityTimerInterval);
    activityTimerInterval = null;
  }

  if (!activity) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  const { label, icon } = getActivityLabel(activity.url, activity.domain);
  document.getElementById("current-activity-icon")!.innerHTML = icon;
  document.getElementById("current-activity-message")!.textContent = label;

  // Live counting timer — ticks every second locally
  const timerEl = document.getElementById("current-activity-timer")!;
  const tick = () => {
    timerEl.textContent = formatLiveTimer(Date.now() - activity.startTime);
  };
  tick();
  activityTimerInterval = setInterval(tick, 1000);
}

// ── Session control button handlers ──

/** Wire up Start Session button */
function initSessionControls() {
  const startBtn = document.getElementById("start-session-btn")!;
  const endBtn = document.getElementById("end-session-btn")!;

  startBtn.addEventListener("click", async () => {
    // Disable button to prevent double-clicks
    startBtn.setAttribute("disabled", "true");
    startBtn.textContent = "Starting...";

    try {
      await browser.runtime.sendMessage({ type: "START_SESSION" });
      // Re-render the entire popup with fresh session data
      await init();
    } catch (err) {
      console.error("[MM Popup] Failed to start session:", err);
      startBtn.removeAttribute("disabled");
      startBtn.innerHTML =
        '<span class="start-btn-icon">▶</span> Start Session';
    }
  });

  endBtn.addEventListener("click", async () => {
    endBtn.setAttribute("disabled", "true");
    endBtn.textContent = "Ending...";

    try {
      await browser.runtime.sendMessage({ type: "END_SESSION" });
      await init();
    } catch (err) {
      console.error("[MM Popup] Failed to end session:", err);
      endBtn.removeAttribute("disabled");
      endBtn.textContent = "⏹ End Session";
    }
  });
}

// ── Initialize popup ──
async function init() {
  initTabs();
  initSessionControls();

  try {
    const {
      scores,
      state,
      smoothedScore,
      sessionStartedAt,
      activityLog,
      isSessionActive,
      focusTimeline,
    } = await fetchSessionData();

    // Toggle between start screen and active dashboard
    if (!isSessionActive) {
      showStartScreen();
      return;
    }

    showActiveSession();
    renderDashboard(
      scores,
      state,
      smoothedScore,
      sessionStartedAt,
      focusTimeline,
    );
    renderActivityLog(activityLog);

    // Read current activity directly from storage (no messaging needed)
    const activity = await currentActivityItem.getValue();
    renderCurrentActivity(activity);

    // Watch for live changes (e.g. user switches tabs while popup is open)
    currentActivityItem.watch((newActivity) => {
      renderCurrentActivity(newActivity);
    });
  } catch (err) {
    console.error("[MonkeyMeter Popup] Failed to fetch session data:", err);
  }
}

init();
