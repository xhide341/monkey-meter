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
import Footer from "./components/Footer";

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [activity, setActivity] = useState<CurrentActivity | null>(null);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "activity" | "about"
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

  // ── Render ──

  const isActive = session?.isSessionActive ?? false;

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
                busy={busy}
                onPauseToggle={togglePause}
                onEnd={endSession}
              />
            </div>
          )}
          {activeTab === "activity" && (
            <div className="tab-content active">
              <ActivityLog entries={session.activityLog} />
            </div>
          )}
          {activeTab === "about" && (
            <div className="tab-content active">
              <AboutTab />
            </div>
          )}
        </>
      )}

      <Footer />
    </div>
  );
}
