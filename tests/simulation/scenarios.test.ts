import { describe, expect, it, vi } from 'vitest';
import { useSimulationStore } from '../../src/store/simulationStore';
import { useCommunicationStore } from '../../src/store/communicationStore';
import { activateScenario } from '../../src/simulation/scenarioEngine';
import { resetSimulationRNG, tickStation } from '../../src/simulation/stationSimulator';
import { AlertLevel, EquipmentStatus, LinkState, ScenarioType, WeatherCondition } from '../../src/types';
import { START_TIME } from '../helpers';
import '../helpers';

describe('station scenarios', () => {
  it('keeps normal operating values valid and generators operational', () => {
    activateScenario(ScenarioType.NORMAL);
    for (let i = 0; i < 25; i++) tickStation();
    const { station } = useSimulationStore.getState();
    expect(station.energy.batteryLevel).toBeGreaterThanOrEqual(0);
    expect(station.energy.batteryLevel).toBeLessThanOrEqual(100);
    expect(station.energy.powerGeneration).toBeGreaterThan(0);
    expect(station.energy.powerLoad).toBeGreaterThan(0);
    expect(station.daysOfAutonomy).toBeGreaterThan(0);
    expect(station.equipment.find((item) => item.id === 'gen1')?.status).toBe(EquipmentStatus.OPERATIONAL);
    expect(station.equipment.find((item) => item.id === 'gen2')?.status).toBe(EquipmentStatus.OPERATIONAL);
  });

  it('ramps blizzard wind, cold, load and fuel use and raises weather alerts when warranted', () => {
    activateScenario(ScenarioType.BLIZZARD);
    const before = useSimulationStore.getState().station;
    vi.setSystemTime(Date.now() + 30_000);
    resetSimulationRNG(321);
    for (let i = 0; i < 25; i++) tickStation();
    const { station, alerts } = useSimulationStore.getState();
    expect(station.environment.windSpeed).toBeGreaterThan(before.environment.windSpeed);
    expect(station.environment.temperature).toBeLessThan(before.environment.temperature);
    expect(station.energy.powerLoad).toBeGreaterThan(before.energy.powerLoad);
    expect(station.fuel.consumptionRate).toBeGreaterThan(before.fuel.consumptionRate);
    expect(station.environment.weatherCondition).toBe(WeatherCondition.BLIZZARD);
    expect(alerts.some((alert) => alert.level === AlertLevel.AMBER || alert.level === AlertLevel.RED)).toBe(true);
  });

  it('moves Generator 2 through warning to failure and reduces generation and reserve', () => {
    activateScenario(ScenarioType.GENERATOR_FAILURE);
    const before = useSimulationStore.getState().station;
    vi.setSystemTime(Date.now() + 4_000);
    tickStation();
    expect(useSimulationStore.getState().station.equipment.find((item) => item.id === 'gen2')?.status).toBe(EquipmentStatus.WARNING);

    vi.setSystemTime(Date.now() + 2_000);
    tickStation();
    expect(useSimulationStore.getState().station.equipment.find((item) => item.id === 'gen2')?.status).toBe(EquipmentStatus.FAILED);
    for (let i = 0; i < 50; i++) tickStation();
    const after = useSimulationStore.getState().station;
    expect(after.energy.powerGeneration).toBeLessThan(before.energy.powerGeneration);
    expect(after.daysOfAutonomy).toBeLessThanOrEqual(before.daysOfAutonomy);
    expect(after.energy.batteryLevel).toBeGreaterThanOrEqual(0);
    expect(useSimulationStore.getState().alerts.some((alert) => alert.title.includes('Generator 2 Failure'))).toBe(true);
  });

  it('repeats the same scenario outcomes with the same seed and controlled clock', () => {
    const run = () => {
      activateScenario(ScenarioType.BLIZZARD);
      vi.setSystemTime(START_TIME + 30_000);
      resetSimulationRNG(77);
      for (let i = 0; i < 12; i++) tickStation();
      const { station } = useSimulationStore.getState();
      return [station.environment.temperature, station.environment.windSpeed, station.energy.powerLoad, station.fuel.consumptionRate];
    };
    const first = run();
    activateScenario(ScenarioType.NORMAL);
    useSimulationStore.getState().resetSimulation();
    vi.setSystemTime(START_TIME);
    expect(run()).toEqual(first);
  });

  it('keeps manual blizzard activation separate from the communication link', () => {
    useCommunicationStore.getState().setLinkState(LinkState.ONLINE);
    activateScenario(ScenarioType.BLIZZARD);
    expect(useCommunicationStore.getState().comm.linkState).toBe(LinkState.ONLINE);
    expect(useSimulationStore.getState().scenario.description).toContain('communication degradation is controlled separately');
  });
});
