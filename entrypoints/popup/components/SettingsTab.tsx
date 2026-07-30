interface SettingsTabProps {
  enablePopupNudges: boolean;
  showActivityLogPoints: boolean;
  showSessionTrend: boolean;
  showCurrentActivity: boolean;
  onEnablePopupNudgesChange: (enabled: boolean) => void;
  onShowActivityLogPointsChange: (visible: boolean) => void;
  onShowSessionTrendChange: (visible: boolean) => void;
  onShowCurrentActivityChange: (visible: boolean) => void;
}

export default function SettingsTab({
  enablePopupNudges,
  showActivityLogPoints,
  showSessionTrend,
  showCurrentActivity,
  onEnablePopupNudgesChange,
  onShowActivityLogPointsChange,
  onShowSessionTrendChange,
  onShowCurrentActivityChange,
}: SettingsTabProps) {
  return (
    <section className="settings-container">
      <div className="settings-card">
        <h2 className="settings-title">Display Preferences</h2>

        <div className="settings-toggle">
          <div className="settings-toggle-text">
            <label
              className="settings-toggle-label"
              htmlFor="toggle-enable-nudges"
            >
              Enable popup nudges
            </label>
            <span className="settings-toggle-help">
              Enable in-page Capuchin nudge overlays.
            </span>
          </div>
          <input
            id="toggle-enable-nudges"
            type="checkbox"
            checked={enablePopupNudges}
            onChange={(event) =>
              onEnablePopupNudgesChange(event.target.checked)
            }
          />
        </div>

        <div className="settings-toggle">
          <div className="settings-toggle-text">
            <label
              className="settings-toggle-label"
              htmlFor="toggle-log-points"
            >
              Show point scoring
            </label>
            <span className="settings-toggle-help">
              Display point badges in Activity Log entries.
            </span>
          </div>
          <input
            id="toggle-log-points"
            type="checkbox"
            checked={showActivityLogPoints}
            onChange={(event) =>
              onShowActivityLogPointsChange(event.target.checked)
            }
          />
        </div>

        <div className="settings-toggle">
          <div className="settings-toggle-text">
            <label
              className="settings-toggle-label"
              htmlFor="toggle-session-trend"
            >
              Show session trend
            </label>
            <span className="settings-toggle-help">
              Show the trend sparkline card on Dashboard.
            </span>
          </div>
          <input
            id="toggle-session-trend"
            type="checkbox"
            checked={showSessionTrend}
            onChange={(event) => onShowSessionTrendChange(event.target.checked)}
          />
        </div>

        <div className="settings-toggle">
          <div className="settings-toggle-text">
            <label
              className="settings-toggle-label"
              htmlFor="toggle-current-activity"
            >
              Show current activity
            </label>
            <span className="settings-toggle-help">
              Show the live activity card on Dashboard.
            </span>
          </div>
          <input
            id="toggle-current-activity"
            type="checkbox"
            checked={showCurrentActivity}
            onChange={(event) =>
              onShowCurrentActivityChange(event.target.checked)
            }
          />
        </div>
      </div>
    </section>
  );
}
