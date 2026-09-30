import { describe, expect, it } from 'vitest';
import { tickCommunication } from '../../src/communication/commEngine';
import { useCommunicationStore } from '../../src/store/communicationStore';
import { useSimulationStore } from '../../src/store/simulationStore';
import { Freshness, LinkState } from '../../src/types';
import { buildBatteryForecast } from '../../src/utils/forecast';
import { advance } from '../helpers';
import '../helpers';

describe('HQ battery forecast', () => {
  it('starts with high confidence and a narrow band on fresh, stable telemetry', () => {
    const hq = useCommunicationStore.getState().hq;
    const forecast = buildBatteryForecast(hq.batteryHistory, hq.energy.batteryLevel, LinkState.ONLINE, Date.now());
    const end = forecast.points.at(-1)!;
    expect(forecast.overallConfidence).toBeGreaterThanOrEqual(85);
    expect(end.upperBound - end.lowerBound).toBeLessThan(5);
  });

  it('reduces confidence and widens uncertainty as delivered data ages', () => {
    const hq = useCommunicationStore.getState().hq;
    const fresh = buildBatteryForecast(hq.batteryHistory, { ...hq.energy.batteryLevel, age: 1_000, freshness: Freshness.FRESH }, LinkState.ONLINE, Date.now());
    const stale = buildBatteryForecast(hq.batteryHistory, { ...hq.energy.batteryLevel, age: 40_000, freshness: Freshness.STALE }, LinkState.OFFLINE, Date.now());
    expect(stale.overallConfidence).toBeLessThan(fresh.overallConfidence);
    expect(stale.points.at(-1)!.upperBound - stale.points.at(-1)!.lowerBound)
      .toBeGreaterThan(fresh.points.at(-1)!.upperBound - fresh.points.at(-1)!.lowerBound);
  });

  it('uses the last HQ-known battery during an outage, then improves with delivered observations', () => {
    const comm = useCommunicationStore.getState();
    comm.setLinkState(LinkState.OFFLINE);
    advance(1);
    useSimulationStore.getState().setEnergy({ batteryLevel: 45 });
    tickCommunication();
    advance(40_000);
    comm.updateHQAges(Date.now());
    const staleHQ = useCommunicationStore.getState().hq;
    const staleForecast = buildBatteryForecast(staleHQ.batteryHistory, staleHQ.energy.batteryLevel, LinkState.OFFLINE, Date.now());
    expect(Number(staleHQ.energy.batteryLevel.value)).toBe(92);
    expect(staleHQ.batteryHistory.at(-1)?.value).toBe(92);
    expect(staleForecast.points.at(-1)?.forecast).toBe(92);

    comm.setLinkState(LinkState.ONLINE);
    tickCommunication();
    for (let i = 0; i < 8 && Number(useCommunicationStore.getState().hq.energy.batteryLevel.value) !== 45; i++) {
      advance(300);
      tickCommunication();
    }
    const syncedHQ = useCommunicationStore.getState().hq;
    const syncedForecast = buildBatteryForecast(syncedHQ.batteryHistory, syncedHQ.energy.batteryLevel, LinkState.ONLINE, Date.now());
    expect(Number(syncedHQ.energy.batteryLevel.value)).toBe(45);
    expect(syncedHQ.batteryHistory.at(-1)?.value).toBe(45);
    expect(syncedForecast.overallConfidence).toBeGreaterThan(staleForecast.overallConfidence);
  });
});
