// ── Background Service Worker: Dwell-time tracking, aggregation loop, overlay triggers ──
// Tracks how long the user spends on each tab. Drift events are only generated
// for time spent on non-educational/non-intentional sites exceeding 30 seconds.

import {
  trackShortContent,
  trackDwellDrift,
  extractDomain,
} from "@/lib/events";
import { addEventsAndAggregate } from "@/lib/session";
import { computeAllScores, shouldTriggerOverlay } from "@/lib/scoring";
import { computeMonkeyState, getStateDisplay } from "@/lib/state-machine";
import {
  loadSession,
  saveSession,
  isDomainSuppressed,
  suppressDomain,
  markIntentional,
  currentActivityItem,
  startSession as storageStartSession,
  endSession as storageEndSession,
} from "@/lib/storage";
import {
  AGGREGATION_ALARM_MINUTES,
  OVERLAY_COOLDOWN_MS,
  IDLE_DETECTION_THRESHOLD_SECONDS,
  AUTO_END_IDLE_MS,
  DWELL_DRIFT_MIN_MS,
} from "@/lib/constants";
import type { BehavioralEvent, ExtensionMessage, LogEntry } from "@/lib/types";

// ── YouTube URL pattern matchers for smart log messages ──
const YOUTUBE_VIDEO_REGEX = /youtube\.com\/watch/;
const YOUTUBE_SHORTS_REGEX = /youtube\.com\/shorts\//;
const YOUTUBE_DOMAIN = "www.youtube.com";

// ── Active tab dwell time tracker ──
interface ActiveTabInfo {
  tabId: number;
  domain: string;
  url: string;
  startTime: number;
  pausedTime: number; // Track time paused due to idle
}
let activeTab: ActiveTabInfo | null = null;

/** Format dwell time into a human-readable duration like "2m 30s" or "45s" */
function formatDwellTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/** Generate a smart log message based on URL patterns */
function getNavigationLogMessage(
  url: string,
  domain: string,
  dwellTime?: string,
): { message: string; type: LogEntry["type"] } {
  const suffix = dwellTime ? ` for ${dwellTime}` : "";
  try {
    // YouTube-specific detection
    if (domain === YOUTUBE_DOMAIN || domain === "youtube.com") {
      if (YOUTUBE_SHORTS_REGEX.test(url)) {
        return {
          message: `Watched a YouTube Short${suffix}`,
          type: "short_content",
        };
      }
      if (YOUTUBE_VIDEO_REGEX.test(url)) {
        return { message: `Watched a YouTube video${suffix}`, type: "youtube" };
      }
      return { message: `Browsed YouTube${suffix}`, type: "navigation" };
    }

    // TikTok detection
    if (domain.includes("tiktok.com")) {
      return { message: `Scrolled TikTok${suffix}`, type: "short_content" };
    }

    // Instagram Reels detection
    if (domain.includes("instagram.com") && url.includes("/reels")) {
      return {
        message: `Watched Instagram Reels${suffix}`,
        type: "short_content",
      };
    }

    // Reddit detection
    if (domain.includes("reddit.com")) {
      return { message: `Browsed Reddit${suffix}`, type: "navigation" };
    }

    // Twitter/X detection
    if (domain.includes("twitter.com") || domain === "x.com") {
      return { message: `Scrolled X (Twitter)${suffix}`, type: "navigation" };
    }

    // Default: "Visited domain"
    return { message: `Visited ${domain}${suffix}`, type: "navigation" };
  } catch {
    return { message: `Visited ${domain}${suffix}`, type: "navigation" };
  }
}

export default defineBackground(() => {
  // Pending events buffer — batched into storage on each aggregation cycle
  let pendingEvents: BehavioralEvent[] = [];
  let lastOverlayTime = 0;

  // Track idle and visibility state
  let isUserIdle = false; // True if browser detects system is idle
  let lastPauseTime = 0; // When did we last pause tracking

  // Domains classified as educational by content script metadata analysis
  const educationalDomains = new Set<string>();

  // Tracks domains already prompted with overlay this session to avoid spamming
  const overlayPromptedDomains = new Set<string>();

  console.log("[MM Background] Service worker initialized");

  // ── Restore session state on service worker restart ──
  (async () => {
    const session = await loadSession();

    // Restore educational domains from intentional sessions (prevents false drift on restart)
    const now = Date.now();
    for (const [domain, expiry] of Object.entries(
      session.preferences.intentionalSessions,
    )) {
      if (expiry > now) {
        educationalDomains.add(domain);
      }
    }
    console.log(
      `[MM Background] Restored ${educationalDomains.size} educational domains`,
    );

    // Only initialize tab tracking if session is active
    if (!session.isSessionActive) {
      console.log("[MM Background] No active session — tracking is paused");
      await browser.action.setBadgeText({ text: "" });
      return;
    }

    // ── Initialize activeTab from current browser state (survives SW restarts) ──
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (
        tab?.id &&
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("about:") &&
        !tab.url.startsWith("chrome-extension://") &&
        !tab.url.startsWith("edge://")
      ) {
        const domain = extractDomain(tab.url);
        const startTime = Date.now();
        activeTab = {
          tabId: tab.id,
          domain,
          url: tab.url,
          startTime,
          pausedTime: 0,
        };
        await currentActivityItem.setValue({ domain, url: tab.url, startTime });
        console.log(`[MM Background] Initialized activeTab: ${domain}`);
      }
    } catch {
      // Tab query failed — activeTab will be set on the next tab switch
    }
  })();

  // ── Monitor browser idle state ──
  // Query idle state every 30 seconds to detect when user is AFK
  browser.idle.setDetectionInterval(IDLE_DETECTION_THRESHOLD_SECONDS);

  browser.idle.onStateChanged.addListener(async (newState) => {
    const wasIdle = isUserIdle;
    isUserIdle = newState === "idle" || newState === "locked";

    console.log(`[MM Idle] State changed: ${newState} (idle=${isUserIdle})`);

    // Skip idle handling if no active session
    const session = await loadSession();
    if (!session.isSessionActive) return;

    // If transitioning from active to idle, mark pause time
    if (!wasIdle && isUserIdle && activeTab) {
      lastPauseTime = Date.now();
      console.log(`[MM Idle] User went idle, pausing drift tracking`);
      await pushLog(
        "idle",
        "Idle detected — pausing drift tracking",
        activeTab.domain,
      );
    }

    // If transitioning from idle to active, check for auto-end threshold
    if (wasIdle && !isUserIdle && lastPauseTime > 0) {
      const pausedDuration = Date.now() - lastPauseTime;

      // Auto-end session if idle exceeded 1 hour
      if (pausedDuration >= AUTO_END_IDLE_MS) {
        console.log(
          `[MM Idle] Idle for ${formatDwellTime(pausedDuration)} — auto-ending session`,
        );
        await pushLog(
          "session_end",
          `Session auto-ended after ${formatDwellTime(pausedDuration)} idle`,
          activeTab?.domain ?? "system",
        );
        await handleEndSession();
        return;
      }

      // Normal resume — add paused time
      if (activeTab) {
        activeTab.pausedTime += pausedDuration;
        console.log(
          `[MM Idle] User returned, adding ${formatDwellTime(pausedDuration)} to paused time`,
        );
        await pushLog(
          "resume",
          `Activity resumed after ${formatDwellTime(pausedDuration)} idle`,
          activeTab.domain,
        );
      }
      lastPauseTime = 0;
    }
  });

  // ── Helper: flush a log entry to storage immediately (no batching delay) ──
  async function pushLog(
    type: LogEntry["type"],
    message: string,
    domain: string,
    weight?: number,
  ) {
    const entry: LogEntry = { type, message, timestamp: Date.now(), domain };
    if (weight !== undefined && weight > 0) {
      entry.weight = weight;
    }
    const session = await loadSession();
    session.activityLog.push(entry);
    await saveSession(session);
  }

  /**
   * Finalize and log the previous active tab's dwell time.
   * If the tab was on a non-educational domain for 30s+, generate a drift event.
   * Subtracts time when user was idle.
   */
  async function finalizeActiveTab() {
    if (!activeTab) return;

    const totalMs = Date.now() - activeTab.startTime;
    let pausedMs = activeTab.pausedTime;

    // If currently idle, add the current pause duration
    if (isUserIdle && lastPauseTime > 0) {
      pausedMs += Date.now() - lastPauseTime;
    }

    // Calculate actual active dwell time (total - paused)
    const dwellMs = Math.max(0, totalMs - pausedMs);
    const dwellFormatted = formatDwellTime(dwellMs);
    const { domain, url } = activeTab;

    // Skip very short visits (under 2 seconds — likely just browser chrome or about: pages)
    if (dwellMs < 2000) {
      activeTab = null;
      await currentActivityItem.setValue(null);
      return;
    }

    console.log(
      `[MM Finalize] ${domain}: total=${formatDwellTime(totalMs)}, paused=${formatDwellTime(pausedMs)}, active=${dwellFormatted}`,
    );

    // Generate smart log with dwell duration
    const logInfo = getNavigationLogMessage(url, domain, dwellFormatted);

    // Check if this domain qualifies for drift scoring
    // Only non-educational, non-intentional domains generate drift events
    const isEducational = educationalDomains.has(domain);
    const dwellEvent = !isEducational ? trackDwellDrift(domain, dwellMs) : null;

    if (dwellEvent) {
      console.log(
        `[MM Event] dwell_drift on ${domain} (${dwellFormatted}), weight=${dwellEvent.weight.toFixed(2)}`,
      );
      pendingEvents.push(dwellEvent);
      // Log with weight so UI can show the drift points
      await pushLog(logInfo.type, logInfo.message, domain, dwellEvent.weight);
    } else {
      // Log without weight (informational only — educational or short visit)
      await pushLog(logInfo.type, logInfo.message, domain);
    }

    activeTab = null;
    await currentActivityItem.setValue(null);
  }

  // ── Tab event listeners (guarded by session active state) ──

  // When a tab gains focus, finalize the previous tab's dwell and start tracking the new one
  browser.tabs.onActivated.addListener(async (activeInfo) => {
    // Skip all tracking if no active session
    const session = await loadSession();
    if (!session.isSessionActive) return;

    try {
      // Finalize previous tab's dwell time
      await finalizeActiveTab();

      const tab = await browser.tabs.get(activeInfo.tabId);
      if (!tab.url) return;

      const domain = extractDomain(tab.url);

      // Skip internal browser pages
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("edge://")
      ) {
        return;
      }

      // Start tracking dwell time on the new tab
      const startTime = Date.now();
      activeTab = {
        tabId: activeInfo.tabId,
        domain,
        url: tab.url,
        startTime,
        pausedTime: 0,
      };
      // Persist to storage so popup can read it directly
      await currentActivityItem.setValue({ domain, url: tab.url, startTime });

      // Short-content signal (Shorts, Reels, etc.) — still triggers immediately
      const shortEvent = trackShortContent(domain, tab.url);
      if (shortEvent) {
        console.log(`[MM Event] short_content on ${domain}`);
        pendingEvents.push(shortEvent);
      }
    } catch {
      // Tab may have been closed between activation and get
    }
  });

  // Track page navigations within a tab (e.g., clicking links, SPA navigation)
  // Updates the active tab's URL so the dwell log reflects the latest page
  browser.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    // Skip all tracking if no active session
    const sess = await loadSession();
    if (!sess.isSessionActive) return;

    // Update current activity immediately when URL changes (don't wait for "complete")
    if (changeInfo.url && tab.id !== undefined) {
      const domain = extractDomain(changeInfo.url);

      // Skip internal browser pages
      if (
        changeInfo.url.startsWith("chrome://") ||
        changeInfo.url.startsWith("about:") ||
        changeInfo.url.startsWith("chrome-extension://") ||
        changeInfo.url.startsWith("edge://")
      ) {
        return;
      }

      // If this is the active tab, update URL immediately for instant popup display
      if (activeTab && activeTab.tabId === tab.id) {
        // If it's a different domain, finalize the old dwell and start fresh
        if (activeTab.domain !== domain) {
          await finalizeActiveTab();
          const startTime = Date.now();
          activeTab = {
            tabId: tab.id,
            domain,
            url: changeInfo.url,
            startTime,
            pausedTime: 0,
          };
          await currentActivityItem.setValue({
            domain,
            url: changeInfo.url,
            startTime,
          });
        } else {
          // Same domain, just update the URL (don't restart timer)
          activeTab.url = changeInfo.url;
          await currentActivityItem.setValue({
            domain,
            url: changeInfo.url,
            startTime: activeTab.startTime,
          });
        }
      }
    }

    // Handle page completion for overlay and event tracking
    if (changeInfo.status === "complete" && tab.url && tab.id !== undefined) {
      const domain = extractDomain(tab.url);

      // Skip internal browser pages
      if (
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("edge://")
      ) {
        return;
      }

      // Overlay for unclassified domains (first visit per session) - reduced delay
      if (
        !educationalDomains.has(domain) &&
        !overlayPromptedDomains.has(domain)
      ) {
        overlayPromptedDomains.add(domain);
        setTimeout(async () => {
          if (tab.id) {
            await maybeShowOverlayForClassification(tab.id, domain);
          }
        }, 500); // Reduced from 2000ms to 500ms
      }

      // Short-content behavioral event
      const shortEvent = trackShortContent(domain, tab.url);
      if (shortEvent) {
        console.log(`[MM Event] short_content (nav) on ${domain}`);
        pendingEvents.push(shortEvent);
      }
    }
  });

  // ── Content script message handlers ──

  browser.runtime.onMessage.addListener(async (message: ExtensionMessage) => {
    switch (message.type) {
      case "START_SESSION": {
        console.log("[MM Session] Starting new session");
        await handleStartSession();
        return { ok: true };
      }

      case "END_SESSION": {
        console.log("[MM Session] Ending session (user requested)");
        await handleEndSession();
        return { ok: true };
      }

      case "RAPID_NAVIGATION": {
        // Content script still detects rapid SPA navigation — log it but don't score
        console.log(
          `[MM Content] Rapid SPA navigation on ${message.domain} (${message.navCount} pages)`,
        );
        return { ok: true };
      }

      case "OVERLAY_RESPONSE": {
        console.log(
          `[MM Overlay] Response: ${message.response} for ${message.domain}`,
        );
        if (message.response === "dont_ask_again") {
          await suppressDomain(message.domain);
        } else if (message.response === "intentional") {
          await markIntentional(message.domain);
          educationalDomains.add(message.domain);
        }
        return { ok: true };
      }

      case "GET_SCORES": {
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

      case "PAGE_EDUCATIONAL": {
        educationalDomains.add(message.domain);
        console.log(
          `[MM Educational] Registered "${message.domain}" as educational (title: "${message.title}")`,
        );
        return { ok: true };
      }

      default:
        return { ok: false };
    }
  });

  // ── Aggregation loop via browser.alarms ──

  browser.alarms.create("monkeyMeterAggregation", {
    periodInMinutes: AGGREGATION_ALARM_MINUTES,
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "monkeyMeterAggregation") return;

    // Skip aggregation if no active session
    const sessionCheck = await loadSession();
    if (!sessionCheck.isSessionActive) return;

    // ── Inject interim dwell event for the currently active tab ──
    // This ensures the score updates live while the user is still on a drifting site,
    // rather than waiting for them to switch away.
    // Only counts active dwell time (excludes idle/hidden periods)
    if (activeTab) {
      const totalMs = Date.now() - activeTab.startTime;
      let pausedMs = activeTab.pausedTime;

      // If currently idle, add the current pause duration
      if (isUserIdle && lastPauseTime > 0) {
        pausedMs += Date.now() - lastPauseTime;
      }

      // Calculate actual active dwell time
      const dwellMs = Math.max(0, totalMs - pausedMs);
      const isEducational = educationalDomains.has(activeTab.domain);

      if (!isEducational && dwellMs >= DWELL_DRIFT_MIN_MS) {
        // Only if at least 30s of active time
        const interimEvent = trackDwellDrift(activeTab.domain, dwellMs);
        if (interimEvent) {
          console.log(
            `[MM Alarm] Interim dwell_drift on ${activeTab.domain} (active=${formatDwellTime(dwellMs)}, paused=${formatDwellTime(pausedMs)}), weight=${interimEvent.weight.toFixed(2)}`,
          );
          pendingEvents.push(interimEvent);
        }
      }
    }

    // Drain pending behavioral events into storage (logs are flushed immediately by pushLog)
    const events = [...pendingEvents];
    pendingEvents = [];

    console.log(`[MM Alarm] Tick — ${events.length} pending events to process`);

    if (events.length > 0) {
      await addEventsAndAggregate(events);
    }

    // Compute rolling scores
    let session = await loadSession();
    session = await computeAllScores(session);

    // Update monkey state with hysteresis
    const newState = computeMonkeyState(session);
    session.currentState = newState;

    // Push inverted focus score to timeline for the growing sparkline (cap at 120 entries = 1 hour)
    const focusScore = Math.max(
      0,
      Math.min(100, 100 - Math.round(session.smoothedScore)),
    );
    session.focusTimeline.push(focusScore);
    if (session.focusTimeline.length > 120) {
      session.focusTimeline = session.focusTimeline.slice(-120);
    }

    await saveSession(session);

    // Update badge with smoothed score (consistent with popup dashboard)
    const badgeFocusScore = Math.max(
      0,
      Math.min(100, 100 - Math.round(session.smoothedScore)),
    );
    const badgeText = `${badgeFocusScore}`;
    const display = getStateDisplay(newState);

    console.log(
      `[MM State] ${newState} | badge=${badgeText} | smoothed=${session.smoothedScore.toFixed(1)} | totalEvents=${session.events.length}`,
    );

    await browser.action.setBadgeText({ text: badgeText });
    await browser.action.setBadgeBackgroundColor({ color: display.color });

    // Check if we should trigger the overlay on the active tab (score-based)
    if (shouldTriggerOverlay(session)) {
      console.log(
        `[MM Overlay] Threshold met (${session.smoothedScore.toFixed(1)} >= 55), attempting overlay...`,
      );
      await maybeShowOverlay(session.smoothedScore);
    }
  });

  /** Show overlay for domain classification on first visit to unclassified domain */
  async function maybeShowOverlayForClassification(
    tabId: number,
    domain: string,
  ) {
    const now = Date.now();
    if (now - lastOverlayTime < OVERLAY_COOLDOWN_MS) return;

    const suppressed = await isDomainSuppressed(domain);
    if (suppressed) return;

    lastOverlayTime = now;
    const session = await loadSession();
    console.log(
      `[MM Overlay] Classification prompt for ${domain} (score=${session.smoothedScore.toFixed(1)})`,
    );

    try {
      await browser.tabs.sendMessage(tabId, {
        type: "SHOW_OVERLAY",
        score: session.smoothedScore,
      } satisfies ExtensionMessage);
    } catch (err) {
      console.warn(
        "[MM Overlay] Failed to send classification overlay (attempt 1), retrying...",
        err,
      );
      // Retry once after a short delay (content script might be loading)
      setTimeout(async () => {
        try {
          await browser.tabs.sendMessage(tabId, {
            type: "SHOW_OVERLAY",
            score: session.smoothedScore,
          } satisfies ExtensionMessage);
        } catch (retryErr) {
          console.error(
            "[MM Overlay] Failed to send classification overlay (attempt 2):",
            retryErr,
          );
        }
      }, 1000);
    }
  }

  /** Send overlay trigger to the active tab's content script (score-based, with cooldown) */
  async function maybeShowOverlay(score: number) {
    const now = Date.now();
    if (now - lastOverlayTime < OVERLAY_COOLDOWN_MS) {
      console.log(`[MM Overlay] Skipped — cooldown active`);
      return;
    }

    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id || !tab.url) return;

      const domain = extractDomain(tab.url);
      const suppressed = await isDomainSuppressed(domain);
      if (suppressed) return;

      lastOverlayTime = now;
      console.log(
        `[MM Overlay] Sending SHOW_OVERLAY to tab ${tab.id} (${domain}), score=${score.toFixed(1)}`,
      );

      await browser.tabs.sendMessage(tab.id, {
        type: "SHOW_OVERLAY",
        score,
      } satisfies ExtensionMessage);
    } catch (err) {
      console.error("[MM Overlay] Failed to send:", err);
    }
  }

  // ── Session lifecycle handlers ──

  /** Start a new tracking session — resets data, activates tracking, begins tab monitoring */
  async function handleStartSession() {
    const session = await storageStartSession();
    pendingEvents = [];
    lastOverlayTime = 0;
    overlayPromptedDomains.clear();
    activeTab = null;
    isUserIdle = false;
    lastPauseTime = 0;

    // Initialize activeTab from the currently focused tab
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (
        tab?.id &&
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("about:") &&
        !tab.url.startsWith("chrome-extension://") &&
        !tab.url.startsWith("edge://")
      ) {
        const domain = extractDomain(tab.url);
        const startTime = Date.now();
        activeTab = {
          tabId: tab.id,
          domain,
          url: tab.url,
          startTime,
          pausedTime: 0,
        };
        await currentActivityItem.setValue({ domain, url: tab.url, startTime });
      }
    } catch {
      // Tab query failed — will pick up on next tab switch
    }

    // Set badge to indicate session is running
    await browser.action.setBadgeText({ text: "0" });
    await browser.action.setBadgeBackgroundColor({ color: "#4ade80" });

    console.log("[MM Session] Session started successfully");
  }

  /** End the current session — finalizes tracking and clears badge */
  async function handleEndSession() {
    await finalizeActiveTab();
    await storageEndSession();
    await currentActivityItem.setValue(null);

    // Reset in-memory state
    pendingEvents = [];
    activeTab = null;
    lastPauseTime = 0;

    // Clear badge to indicate no active session
    await browser.action.setBadgeText({ text: "" });

    console.log("[MM Session] Session ended");
  }
});
