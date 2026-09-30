import { beforeEach, afterEach, vi } from 'vitest';
import { resetScenario } from '../src/simulation/scenarioEngine';
import { resetCommunicationEngine } from '../src/communication/commEngine';

export const START_TIME = 1_700_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START_TIME);
  resetScenario();
  resetCommunicationEngine(2026);
});

afterEach(() => {
  vi.useRealTimers();
});

export function advance(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}
