// ── Event Tracking: Signal collectors for drift detection ──

import type { BehavioralEvent, SignalType } from './types';
import {
    SIGNAL_WEIGHTS,
    SHORT_CONTENT_PATTERNS,
    DWELL_DRIFT_MIN_MS,
    DWELL_DRIFT_MAX_MS,
} from './constants';

/** Generate a unique event ID */
function uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Extract domain from a URL string */
export function extractDomain(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return 'unknown';
    }
}

/** Check if a URL matches short-content patterns (Shorts, TikTok, Reels) */
export function isShortContent(url: string): boolean {
    return SHORT_CONTENT_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Create a behavioral event from a raw signal.
 */
function createEvent(
    type: SignalType,
    domain: string,
    meta?: Record<string, unknown>
): BehavioralEvent {
    const weight = SIGNAL_WEIGHTS[type];
    return { id: uid(), type, timestamp: Date.now(), weight, domain, meta };
}

/** Track short-content consumption (Shorts, Reels, etc.) */
export function trackShortContent(domain: string, url: string): BehavioralEvent | null {
    if (isShortContent(url)) {
        return createEvent('short_content', domain, { url });
    }
    return null;
}

/**
 * Create a dwell-drift event when the user spends time on a non-educational site.
 * Short visits below DWELL_DRIFT_MIN_MS return null (no drift).
 * Weight scales proportionally with dwell time: 30s → base weight, 10m → max weight (1.0).
 */
export function trackDwellDrift(domain: string, dwellMs: number): BehavioralEvent | null {
    if (dwellMs < DWELL_DRIFT_MIN_MS) return null;

    const event = createEvent('dwell_drift', domain, { dwellMs });

    const dwellRange = DWELL_DRIFT_MAX_MS - DWELL_DRIFT_MIN_MS;
    const clampedDwell = Math.min(dwellMs - DWELL_DRIFT_MIN_MS, dwellRange);
    const scaleFactor = clampedDwell / dwellRange;
    event.weight = Math.min(1.0, event.weight + scaleFactor * (1.0 - event.weight));

    return event;
}
