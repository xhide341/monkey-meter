export default function AboutTab() {
  return (
    <div className="about-container">
      {/* What is MonkeyMeter */}
      <div className="about-card">
        <div className="about-card-header">
          <h3 className="about-card-title">What is MonkeyMeter?</h3>
        </div>
        <p className="about-card-text">
          MonkeyMeter is a <strong>mindful browsing companion</strong> that
          gently tracks your focus patterns. It detects autopilot doom-scrolling
          and nudges you back to intentional browsing — without blocking
          anything.
        </p>
        <p className="about-card-text">
          Think of it as a <em>speedometer for your attention</em>.
        </p>
      </div>

      {/* Inspiration */}
      <div className="about-card">
        <div className="about-card-header">
          <h3 className="about-card-title">Inspiration</h3>
        </div>
        <p className="about-card-text">
          Inspired by{" "}
          <a
            className="about-inline-link"
            href="https://www.youtube.com/watch?v=arj7oStGLkU"
            target="_blank"
            rel="noreferrer"
          >
            Tim Urban's legendary TED talk
          </a>{" "}
          about the instant gratification monkey. It brilliantly explains how, in moments of distraction, our inner monkey takes over the wheel in our brain and steers us away from our actual goals.
        </p>
      </div>

      {/* How It Works */}
      <div className="about-card">
        <div className="about-card-header">
          <h3 className="about-card-title">How It Works</h3>
        </div>
        <div className="about-card-list">
          <div className="about-list-item">
            <span className="about-list-number">1</span>
            <div className="about-list-content">
              <strong>Signal Detection</strong>
              <span>
                Monitors tab switches and time-on-page to
                detect mindless patterns.
              </span>
            </div>
          </div>
          <div className="about-list-item">
            <span className="about-list-number">2</span>
            <div className="about-list-content">
              <strong>Score Calculation</strong>
              <span>
                Uses an exponential moving average (EMA) across 5-min, 25-min,
                and 1-hour windows to compute your &quot;autopilot score&quot;.
              </span>
            </div>
          </div>
          <div className="about-list-item">
            <span className="about-list-number">3</span>
            <div className="about-list-content">
              <strong>State Machine</strong>
              <span>
                Your score maps to a monkey state — from 🧘 Focused to 🙈 Chaos
                — with smooth transitions and hysteresis to avoid flapping.
              </span>
            </div>
          </div>
          <div className="about-list-item">
            <span className="about-list-number">4</span>
            <div className="about-list-content">
              <strong>Gentle Nudges</strong>
              <span>
                When drift is detected, a non-blocking overlay lets you choose:
                continue intentionally, embrace monkey mode, or dismiss.
              </span>
            </div>
          </div>
        </div>
      </div>



      {/* Privacy */}
      <div className="about-card">
        <div className="about-card-header">
          <h3 className="about-card-title">Privacy</h3>
        </div>
        <p className="about-card-text">
          <strong>100% local.</strong> All data stays in your browser. No
          accounts, no servers, no analytics.{" "}
          <a
            className="about-inline-link"
            href="https://github.com/xhide341/monkey-meter"
            target="_blank"
            rel="noreferrer"
          >
            View the source code →
          </a>
        </p>
      </div>
    </div>
  );
}
