import { useState, useEffect, useCallback } from "react";
import type { SessionInfo } from "./helpers";
import type { CurrentActivity } from "@/lib/types";
import {
  fetchSessionData,
  fetchCurrentActivity,
  watchCurrentActivity,
} from "./helpers";
import Header from "./components/Header";
import TabBar from "./components/TabBar";
import StartScreen from "./components/StartScreen";
import Dashboard from "./components/Dashboard";
import ActivityLog from "./components/ActivityLog";
import AboutTab from "./components/AboutTab";
import SettingsTab from "./components/SettingsTab";
import Footer from "./components/Footer";

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [activity, setActivity] = useState<CurrentActivity | null>(null);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "activity" | "settings" | "about"
  >("dashboard");
  const [busy, setBusy] = useState(false);

  /** Fetch all session data and current activity from background */
  const refresh = useCallback(async () => {
    const data = await fetchSessionData();
    setSession(data);
    const act = await fetchCurrentActivity();
    setActivity(act);
  }, []);

  // Initial load + watch for live activity changes
  useEffect(() => {
    refresh();
    const unsub = watchCurrentActivity((newActivity) => {
      setActivity(newActivity);
    });
    return unsub;
  }, [refresh]);

  // ── Actions ──
  const startSession = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await browser.runtime.sendMessage({ type: "START_SESSION" });
      await refresh();
    } catch (err) {
      console.error("[MM Popup] Failed to start session:", err);
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await browser.runtime.sendMessage({ type: "END_SESSION" });
      await refresh();
    } catch (err) {
      console.error("[MM Popup] Failed to end session:", err);
    } finally {
      setBusy(false);
    }
  };

  const togglePause = async () => {
    if (busy || !session) return;
    setBusy(true);
    try {
      const msgType = session.isSessionPaused
        ? "RESUME_SESSION"
        : "PAUSE_SESSION";
      await browser.runtime.sendMessage({ type: msgType });
      await refresh();
    } catch (err) {
      console.error("[MM Popup] Failed to pause/resume:", err);
    } finally {
      setBusy(false);
    }
  };

  const toggleActivityLogPoints = async (visible: boolean) => {
    if (!session) return;

    setSession((prev) =>
      prev ? { ...prev, showActivityLogPoints: visible } : prev,
    );

    try {
      await browser.runtime.sendMessage({
        type: "SET_LOG_POINT_VISIBILITY",
        visible,
      });
    } catch (err) {
      console.error("[MM Popup] Failed to update log-point visibility:", err);
      await refresh();
    }
  };

  const toggleEnablePopupNudges = async (enabled: boolean) => {
    if (!session) return;

    setSession((prev) => (prev ? { ...prev, overlayEnabled: enabled } : prev));

    try {
      await browser.runtime.sendMessage({
        type: "SET_OVERLAY_ENABLED",
        enabled,
      });
    } catch (err) {
      console.error("[MM Popup] Failed to update overlay nudge setting:", err);
      await refresh();
    }
  };

  const toggleSessionTrend = async (visible: boolean) => {
    if (!session) return;

    setSession((prev) =>
      prev ? { ...prev, showSessionTrend: visible } : prev,
    );

    try {
      await browser.runtime.sendMessage({
        type: "SET_SESSION_TREND_VISIBILITY",
        visible,
      });
    } catch (err) {
      console.error(
        "[MM Popup] Failed to update session-trend visibility:",
        err,
      );
      await refresh();
    }
  };

  const toggleCurrentActivity = async (visible: boolean) => {
    if (!session) return;

    setSession((prev) =>
      prev ? { ...prev, showCurrentActivity: visible } : prev,
    );

    try {
      await browser.runtime.sendMessage({
        type: "SET_CURRENT_ACTIVITY_VISIBILITY",
        visible,
      });
    } catch (err) {
      console.error(
        "[MM Popup] Failed to update current-activity visibility:",
        err,
      );
      await refresh();
    }
  };

  // ── Render ──

  const isActive = session?.isSessionActive ?? false;
  const showFooter = !isActive || activeTab !== "dashboard";

  return (
    <div className={`popup-container ${isActive ? "active-session" : ""}`}>
      <Header />

      {isActive && <TabBar activeTab={activeTab} onTabChange={setActiveTab} />}

      {!isActive && <StartScreen onStart={startSession} busy={busy} />}

      {isActive && session && (
        <>
          {activeTab === "dashboard" && (
            <div className="tab-content active">
              <Dashboard
                session={session}
                activity={activity}
                showSessionTrend={session.showSessionTrend}
                showCurrentActivity={session.showCurrentActivity}
                busy={busy}
                onPauseToggle={togglePause}
                onEnd={endSession}
              />
            </div>
          )}
          {activeTab === "activity" && (
            <div className="tab-content tab-content-activity active">
              <ActivityLog
                entries={session.activityLog}
                showPoints={session.showActivityLogPoints}
              />
            </div>
          )}
          {activeTab === "settings" && (
            <div className="tab-content active">
              <SettingsTab
                enablePopupNudges={session.overlayEnabled}
                showActivityLogPoints={session.showActivityLogPoints}
                showSessionTrend={session.showSessionTrend}
                showCurrentActivity={session.showCurrentActivity}
                onEnablePopupNudgesChange={toggleEnablePopupNudges}
                onShowActivityLogPointsChange={toggleActivityLogPoints}
                onShowSessionTrendChange={toggleSessionTrend}
                onShowCurrentActivityChange={toggleCurrentActivity}
              />
            </div>
          )}
          {activeTab === "about" && (
            <div className="tab-content active">
              <AboutTab />
            </div>
          )}
        </>
      )}

      {showFooter && <Footer />}
    </div>
  );
}
