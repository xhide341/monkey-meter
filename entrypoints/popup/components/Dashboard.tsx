import { useState, useEffect, useRef } from "react";
import type { SessionInfo } from "../helpers";
import type { CurrentActivity } from "@/lib/types";
import { getStateDisplay } from "@/lib/state-machine";
import {
  formatSessionTimer,
  formatLiveTimer,
  getActivityLabel,
} from "../helpers";
import Sparkline from "./Sparkline";
import ControlButton from "./ControlButton";

interface DashboardProps {
  session: SessionInfo;
  activity: CurrentActivity | null;
  showSessionTrend: boolean;
  showCurrentActivity: boolean;
  busy: boolean;
  onPauseToggle: () => void;
  onEnd: () => void;
}

export default function Dashboard({
  session,
  activity,
  showSessionTrend,
  showCurrentActivity,
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
          {/* <div
            className={`avatar-container avatar-ring avatar-${state}`}
            style={{ borderColor: display.color }}
          >
            <div className="avatar-emoji">{display.emoji}</div>
          </div> */}

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
        <ControlButton
          className={`control-btn pause-btn${isSessionPaused ? " is-paused" : ""}`}
          onClick={onPauseToggle}
        >
          {isSessionPaused ? (
            <svg
              className="control-btn-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 17.3336V6.66698C5 5.78742 5 5.34715 5.18509 5.08691C5.34664 4.85977 5.59564 4.71064 5.87207 4.67499C6.18868 4.63415 6.57701 4.84126 7.35254 5.25487L17.3525 10.5882L17.3562 10.5898C18.2132 11.0469 18.642 11.2756 18.7826 11.5803C18.9053 11.8462 18.9053 12.1531 18.7826 12.4189C18.6418 12.7241 18.212 12.9537 17.3525 13.4121L7.35254 18.7454C6.57645 19.1593 6.1888 19.3657 5.87207 19.3248C5.59564 19.2891 5.34664 19.1401 5.18509 18.9129C5 18.6527 5 18.2132 5 17.3336Z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg
              className="control-btn-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 5.5V18.5C15 18.9647 15 19.197 15.0384 19.3902C15.1962 20.1836 15.816 20.8041 16.6094 20.9619C16.8026 21.0003 17.0349 21.0003 17.4996 21.0003C17.9642 21.0003 18.1974 21.0003 18.3906 20.9619C19.184 20.8041 19.8041 20.1836 19.9619 19.3902C20 19.1987 20 18.9687 20 18.5122V5.48777C20 5.03125 20 4.80087 19.9619 4.60938C19.8041 3.81599 19.1836 3.19624 18.3902 3.03843C18.197 3 17.9647 3 17.5 3C17.0353 3 16.8026 3 16.6094 3.03843C15.816 3.19624 15.1962 3.81599 15.0384 4.60938C15 4.80257 15 5.03534 15 5.5Z"
                fill="currentColor"
              />
              <path
                d="M4 5.5V18.5C4 18.9647 4 19.197 4.03843 19.3902C4.19624 20.1836 4.81599 20.8041 5.60938 20.9619C5.80257 21.0003 6.0349 21.0003 6.49956 21.0003C6.96421 21.0003 7.19743 21.0003 7.39062 20.9619C8.18401 20.8041 8.8041 20.1836 8.96191 19.3902C9 19.1987 9 18.9687 9 18.5122V5.48777C9 5.03125 9 4.80087 8.96191 4.60938C8.8041 3.81599 8.18356 3.19624 7.39018 3.03843C7.19698 3 6.96465 3 6.5 3C6.03535 3 5.80257 3 5.60938 3.03843C4.81599 3.19624 4.19624 3.81599 4.03843 4.60938C4 4.80257 4 5.03534 4 5.5Z"
                fill="currentColor"
              />
            </svg>
          )}
          {/* <span>{isSessionPaused ? "Resume" : "Pause"}</span> */}
        </ControlButton>
        <ControlButton className="control-btn end-btn" onClick={onEnd}>
          <svg
            className="control-btn-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 8.2002V15.8002C5 16.9203 5 17.4796 5.21799 17.9074C5.40973 18.2837 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8036C16.9215 19 17.4805 19 17.9079 18.7822C18.2842 18.5905 18.5905 18.2837 18.7822 17.9074C19 17.48 19 16.921 19 15.8031V8.19691C19 7.07899 19 6.5192 18.7822 6.0918C18.5905 5.71547 18.2842 5.40973 17.9079 5.21799C17.4801 5 16.9203 5 15.8002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002Z"
              fill="currentColor"
            />
          </svg>
          {/* <span>End</span> */}
        </ControlButton>
      </div>

      {showCurrentActivity && (
        <>
          {/* Current Activity Card */}
          <CurrentActivityCard activity={activity} />
        </>
      )}

      {showSessionTrend && (
        <>
          {/* Sparkline Card */}
          <section className="dashboard-card chart-card">
            <div className="card-label">Session Trend</div>
            <Sparkline data={focusTimeline} />
          </section>
        </>
      )}
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

function CurrentActivityCard({
  activity,
}: {
  activity: CurrentActivity | null;
}) {
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
          <span className="activity-icon">💤</span>
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
