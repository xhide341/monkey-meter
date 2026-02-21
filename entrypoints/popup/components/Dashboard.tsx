import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionInfo } from "../helpers";
import type { CurrentActivity } from "@/lib/types";
import { getStateDisplay } from "@/lib/state-machine";
import {
  formatSessionTimer,
  formatLiveTimer,
  getActivityLabel,
} from "../helpers";
import Sparkline from "./Sparkline";

interface DashboardProps {
  session: SessionInfo;
  activity: CurrentActivity | null;
  busy: boolean;
  onPauseToggle: () => void;
  onEnd: () => void;
}

export default function Dashboard({
  session,
  activity,
  busy,
  onPauseToggle,
  onEnd,
}: DashboardProps) {
  const {
    state,
    smoothedScore,
    sessionStartedAt,
    focusTimeline,
    isSessionPaused,
    sessionPausedAt,
    totalSessionPausedMs,
  } = session;

  const display = getStateDisplay(state);

  // Focus score: invert drift so 100% = fully focused
  const focusScore = Math.max(
    0,
    Math.min(100, 100 - Math.round(smoothedScore)),
  );

  // Score color
  let scoreColor = "#4ade80";
  if (focusScore < 35) scoreColor = "#f87171";
  else if (focusScore < 60) scoreColor = "#fb923c";
  else if (focusScore < 80) scoreColor = "#facc15";

  // Summary message
  let summary = "You're fully locked in! 🎯";
  if (focusScore < 30) summary = "The monkey is in control 🐒";
  else if (focusScore < 50) summary = "Starting to wander off...";
  else if (focusScore < 70) summary = "Mostly focused, slight drift";
  else if (focusScore < 90) summary = "Mostly focused, slight drift";

  return (
    <>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div
            className={`avatar-container avatar-ring avatar-${state}`}
            style={{ borderColor: display.color }}
          >
            <div className="avatar-emoji">{display.emoji}</div>
          </div>

          <div className="hero-score-value" style={{ color: scoreColor }}>
            {focusScore}%
          </div>

          <div className="state-badge" style={{ color: display.color }}>
            {display.label}
          </div>

          <SessionTimer
            paused={isSessionPaused}
            pausedAt={sessionPausedAt}
            startedAt={sessionStartedAt}
            totalPausedMs={totalSessionPausedMs}
          />

          <p className="hero-message">{summary}</p>
        </div>
      </section>

      {/* Session Controls */}
      <div className="session-controls">
        <button
          className={`control-btn pause-btn${isSessionPaused ? " is-paused" : ""}`}
          onClick={onPauseToggle}
          disabled={busy}
        >
          <span className="control-btn-icon">
            {isSessionPaused ? "▶" : "⏸"}
          </span>
          <span>{isSessionPaused ? "Resume" : "Pause"}</span>
        </button>
        <button className="control-btn end-btn" onClick={onEnd} disabled={busy}>
          <span className="control-btn-icon">⏹</span>
          <span>End</span>
        </button>
      </div>

      {/* Current Activity Card */}
      <CurrentActivityCard activity={activity} />

      {/* Sparkline Card */}
      <section className="dashboard-card chart-card">
        <div className="card-label">Session Trend</div>
        <Sparkline data={focusTimeline} />
      </section>
    </>
  );
}

// ── Session Timer (ticks every second or shows frozen time) ──

function SessionTimer({
  paused,
  pausedAt,
  startedAt,
  totalPausedMs,
}: {
  paused: boolean;
  pausedAt: number;
  startedAt: number;
  totalPausedMs: number;
}) {
  const [display, setDisplay] = useState("0:00");

  useEffect(() => {
    if (paused && pausedAt > 0) {
      // Frozen
      const frozen = pausedAt - startedAt - totalPausedMs;
      setDisplay(formatSessionTimer(Math.max(0, frozen)));
      return;
    }

    // Ticking
    const tick = () => {
      const elapsed = Date.now() - startedAt - totalPausedMs;
      setDisplay(formatSessionTimer(Math.max(0, elapsed)));
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [paused, pausedAt, startedAt, totalPausedMs]);

  return <div className="hero-timer-value">{display}</div>;
}

// ── Current Activity Card ──

function CurrentActivityCard({ activity }: { activity: CurrentActivity | null }) {
  const [timer, setTimer] = useState("0:00");
  const fallbackStartTime = useRef(Date.now());
  const prevActivityRef = useRef(activity);

  useEffect(() => {
    if (!activity && prevActivityRef.current) {
      fallbackStartTime.current = Date.now();
    }
    prevActivityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    const tick = () => {
      if (activity) {
        setTimer(formatLiveTimer(Date.now() - activity.startTime));
      } else {
        setTimer(formatLiveTimer(Date.now() - fallbackStartTime.current));
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [activity?.startTime]);

  if (!activity) {
    return (
      <section
        className="dashboard-card activity-card"
        style={{ display: "flex" }}
      >
        <div className="card-label">Current Activity</div>
        <div className="activity-content">
          <span className="activity-icon">
            💤
          </span>
          <div className="activity-details">
            <span className="activity-name">Invalid URL</span>
            <span className="activity-time">{timer}</span>
          </div>
        </div>
      </section>
    );
  }

  const { label, faviconUrl } = getActivityLabel(activity.url, activity.domain);

  return (
    <section
      className="dashboard-card activity-card"
      style={{ display: "flex" }}
    >
      <div className="card-label">Current Activity</div>
      <div className="activity-content">
        <span className="activity-icon">
          <img src={faviconUrl} alt={activity.domain} className="favicon-img" />
        </span>
        <div className="activity-details">
          <span className="activity-name">{label}</span>
          <span className="activity-time">{timer}</span>
        </div>
      </div>
    </section>
  );
}
