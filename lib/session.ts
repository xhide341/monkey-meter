// ── Session Aggregation: Rolling time-window aggregation with EMA smoothing ──

import type { BehavioralEvent, SessionData } from './types';
import { TIME_WINDOWS, EMA_ALPHA, SHORT_CONTENT_SUSTAIN_COUNT } from './constants';
import { loadSession, saveSession } from './storage';

/**
 * Add new events to the session and run aggregation.
 * Events older than 1h are pruned. Short-content events are escalated if sustained.
 */
export async function addEventsAndAggregate(newEvents: BehavioralEvent[]): Promise<SessionData> {
    const session = await loadSession();
    const now = Date.now();

    // Merge new events
    session.events.push(...newEvents);

    // Prune events older than the largest window (1h)
    const cutoff1h = now - TIME_WINDOWS['1h'];
    session.events = session.events.filter((e) => e.timestamp > cutoff1h);

    // Escalate short-content weight if there's a sustained pattern within 1h
    escalateShortContentIfSustained(session, now);

    saveSession(session);
    return session;
}

/**
 * If ≥ SHORT_CONTENT_SUSTAIN_COUNT short_content events exist in the last 5m,
 * boost their weights to match autoplay_chain level (sustained binge indicator).
 */
function escalateShortContentIfSustained(session: SessionData, now: number): void {
    const cutoff5m = now - TIME_WINDOWS['5m'];
    const recentShorts = session.events.filter(
        (e) => e.type === 'short_content' && e.timestamp > cutoff5m
    );

    if (recentShorts.length >= SHORT_CONTENT_SUSTAIN_COUNT) {
        for (const event of recentShorts) {
            event.weight = Math.min(1, event.weight + 0.3);
        }
    }
}

/**
 * Retrieve events within a specific time window.
 */
export function getEventsInWindow(
    events: BehavioralEvent[],
    windowKey: '5m' | '25m' | '1h'
): BehavioralEvent[] {
    const cutoff = Date.now() - TIME_WINDOWS[windowKey];
    return events.filter((e) => e.timestamp > cutoff);
}

/**
 * Compute an Exponential Moving Average to smooth score transitions.
 * Prevents transient spikes from causing jarring state changes.
 */
export function computeEMA(previousSmoothed: number, newValue: number): number {
    return EMA_ALPHA * newValue + (1 - EMA_ALPHA) * previousSmoothed;
}
