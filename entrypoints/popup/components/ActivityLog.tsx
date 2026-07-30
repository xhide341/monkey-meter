import { useEffect, useRef } from "react";
import type { LogEntry } from "@/lib/types";
import { getLogIcon, formatAbsoluteTime } from "../helpers";

interface ActivityLogProps {
  entries: LogEntry[];
  showPoints?: boolean;
}

export default function ActivityLog({
  entries,
  showPoints = true,
}: ActivityLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderLogMessage = (entry: LogEntry) => {
    const domain = entry.domain?.trim();
    if (!domain || domain === "system") return entry.message;

    const messageLower = entry.message.toLowerCase();
    const domainLower = domain.toLowerCase();
    const domainStart = messageLower.indexOf(domainLower);

    if (domainStart === -1) return entry.message;

    const domainEnd = domainStart + domain.length;
    return (
      <>
        {entry.message.slice(0, domainStart)}
        <span className="log-domain-highlight">
          {entry.message.slice(domainStart, domainEnd)}
        </span>
        {entry.message.slice(domainEnd)}
      </>
    );
  };

  // Auto-scroll to bottom on mount / new entries
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  if (!entries || entries.length === 0) {
    return (
      <div className="log-container">
        <div className="log-empty">No activity yet — start browsing!</div>
      </div>
    );
  }

  return (
    <div className="log-container" ref={containerRef}>
      {entries.map((entry, i) => {
        const icon = getLogIcon(entry.type, entry.domain);
        const isDrift = entry.type === "dwell_drift";

        return (
          <div
            key={`${entry.timestamp}-${i}`}
            className={`log-entry${isDrift ? " log-entry--drift" : ""}`}
          >
            <div className="log-icon">
              {icon.faviconUrl ? (
                <img
                  className="favicon-img"
                  src={icon.faviconUrl}
                  alt=""
                  width={16}
                  height={16}
                />
              ) : (
                <span>{icon.emoji}</span>
              )}
            </div>

            <span className="log-message">{renderLogMessage(entry)}</span>

            <div className="log-meta">
              <span className="log-time">
                {formatAbsoluteTime(entry.timestamp)}
              </span>
              {showPoints && entry.weight != null && entry.weight > 0 && (
                <span className="log-weight">
                  +{Number.parseFloat(entry.weight.toFixed(2))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
