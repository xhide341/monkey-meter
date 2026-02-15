// ── Scoring Engine: Weighted Autopilot Score computation over multiple windows ──

import type { BehavioralEvent, AutopilotScore, SessionData } from './types';
import { OVERLAY_TRIGGER_THRESHOLD } from './constants';
import { getEventsInWindow, computeEMA } from './session';
import { saveSession } from './storage';

/**
 * Compute the raw autopilot score for a set of events.
 * Uses event-count-based scoring scaled per window, not density-per-hour.
 *
 * Each window has a different "expected event cap" — the number of weighted
 * events that would represent 100% autopilot. This prevents short windows
 * from amplifying a single event into a high score.
 *
 * Window caps calibrated roughly to:
 *   5m  → 5 weighted events  (heavy rapid browsing in 5 min)
 *   25m → 15 weighted events (sustained drift over 25 min)
 *   1h  → 30 weighted events (prolonged autopilot session)
 */
const WINDOW_EVENT_CAPS: Record<string, number> = {
    '5m': 5,
    '25m': 15,
    '1h': 30,
};

function computeRawScore(events: BehavioralEvent[], windowKey: string): number {
    if (events.length === 0) return 0;

    const totalWeight = events.reduce((sum, e) => sum + e.weight, 0);
    const cap = WINDOW_EVENT_CAPS[windowKey] ?? 10;

    // Score = (total weight / cap) × 100, clamped to 0–100
    const raw = (totalWeight / cap) * 100;

    console.log(
        `[MM Scoring] window=${windowKey} events=${events.length} totalWeight=${totalWeight.toFixed(2)} cap=${cap} raw=${raw.toFixed(1)}%`
    );

    return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Determine trend direction by comparing current score to previous score.
 */
function determineTrend(
    current: number,
    previous: number
): 'up' | 'down' | 'stable' {
    const delta = current - previous;
    if (delta > 3) return 'up';
    if (delta < -3) return 'down';
    return 'stable';
}

/**
 * Run the full scoring pipeline:
 * 1. Compute raw scores for each time window
 * 2. Compare against previous scores for trend
 * 3. Apply EMA smoothing to 5m score for state machine input
 * 4. Persist updated scores to session
 */
export async function computeAllScores(session: SessionData): Promise<SessionData> {
    const windows: Array<'5m' | '25m' | '1h'> = ['5m', '25m', '1h'];

    const previousScores = new Map(session.scores.map((s) => [s.window, s.score]));

    const updatedScores: AutopilotScore[] = windows.map((w) => {
        const events = getEventsInWindow(session.events, w);
        const rawScore = computeRawScore(events, w);
        const prev = previousScores.get(w) ?? 0;

        return {
            window: w,
            score: rawScore,
            eventCount: events.length,
            trend: determineTrend(rawScore, prev),
            computedAt: Date.now(),
        };
    });

    session.scores = updatedScores;

    // Apply EMA smoothing to the 5m score (primary input for state machine — most responsive)
    const fiveMinScore = updatedScores.find((s) => s.window === '5m')!.score;
    const previousSmoothed = session.smoothedScore;
    session.smoothedScore = computeEMA(previousSmoothed, fiveMinScore);

    // Track score delta for live points display in the popup
    session.lastScoreDelta = Math.round(session.smoothedScore) - Math.round(previousSmoothed);

    console.log(
        `[MM Scoring] smoothedScore=${session.smoothedScore.toFixed(1)} (5m raw=${fiveMinScore}) delta=${session.lastScoreDelta}`
    );

    saveSession(session);
    return session;
}

/** Check if the current smoothed score exceeds the overlay trigger threshold */
export function shouldTriggerOverlay(session: SessionData): boolean {
    return session.smoothedScore >= OVERLAY_TRIGGER_THRESHOLD;
}
