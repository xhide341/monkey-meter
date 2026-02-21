interface StartScreenProps {
  onStart: () => void;
  busy: boolean;
}

export default function StartScreen({ onStart, busy }: StartScreenProps) {
  return (
    <div className="start-screen" style={{ display: "flex" }}>
      <div className="start-content">
        <h2 className="start-title">Ready to focus?</h2>
        <p className="start-description">
          Start a session to track your browsing focus and see how much the
          monkey is in control.
        </p>
        <button className="start-btn" onClick={onStart} disabled={busy}>
          <span className="start-btn-icon">▶</span>
          {busy ? "Starting..." : "Start Session"}
        </button>
      </div>
    </div>
  );
}
