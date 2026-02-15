// ── UI State Machine: Monkey avatar state transitions with hysteresis ──

import type { MonkeyState, SessionData } from './types';
import { STATE_THRESHOLDS, STATE_HYSTERESIS } from './constants';

/** Ordered states from most focused to most drifted */
const STATE_ORDER: MonkeyState[] = [
    'focused',
    'curious',
    'distracted',
    'doom_mode',
    'chaos',
];

/**
 * Determine the target monkey state based on the smoothed score.
 * Uses hysteresis: a state transition only occurs if the score crosses
 * the threshold by at least STATE_HYSTERESIS points, preventing rapid oscillation.
 */
export function computeMonkeyState(session: SessionData): MonkeyState {
    const score = session.smoothedScore;
    const currentState = session.currentState;
    const currentIndex = STATE_ORDER.indexOf(currentState);

    // Find the highest state whose threshold the score exceeds
    let targetIndex = 0;
    for (let i = STATE_ORDER.length - 1; i >= 0; i--) {
        if (score >= STATE_THRESHOLDS[STATE_ORDER[i]]) {
            targetIndex = i;
            break;
        }
    }

    // Apply hysteresis: only transition if delta exceeds margin
    if (targetIndex > currentIndex) {
        // Escalating — require score to be above threshold + hysteresis
        const escalationThreshold = STATE_THRESHOLDS[STATE_ORDER[targetIndex]] + STATE_HYSTERESIS;
        if (score >= escalationThreshold) {
            return STATE_ORDER[targetIndex];
        }
        return currentState;
    }

    if (targetIndex < currentIndex) {
        // De-escalating — require score to be below threshold - hysteresis
        const deescThreshold = STATE_THRESHOLDS[currentState] - STATE_HYSTERESIS;
        if (score < deescThreshold) {
            return STATE_ORDER[targetIndex];
        }
        return currentState;
    }

    return currentState;
}

/** Get display metadata for each monkey state */
export function getStateDisplay(state: MonkeyState): {
    label: string;
    emoji: string;
    color: string;
} {
    const displays: Record<MonkeyState, { label: string; emoji: string; color: string }> = {
        focused: { label: 'Focused', emoji: '🧘', color: '#4ade80' },
        curious: { label: 'Curious', emoji: '🐒', color: '#facc15' },
        distracted: { label: 'Distracted', emoji: '🙈', color: '#fb923c' },
        doom_mode: { label: 'Doom Mode', emoji: '🙊', color: '#f87171' },
        chaos: { label: 'Chaos', emoji: '🐵💥', color: '#ef4444' },
    };
    return displays[state];
}
