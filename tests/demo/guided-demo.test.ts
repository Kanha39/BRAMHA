import { describe, expect, it, vi } from 'vitest';
import { tickCommunication } from '../../src/communication/commEngine';
import { startDemo, stopDemo } from '../../src/simulation/demoRunner';
import { tickStation } from '../../src/simulation/stationSimulator';
import { useCommunicationStore } from '../../src/store/communicationStore';
import { useSimulationStore } from '../../src/store/simulationStore';
import { useUIStore } from '../../src/store/uiStore';
import { CommandStatus } from '../../src/types';
import '../helpers';

describe('guided demo state transitions', () => {
  it('waits for command receipt, applies only after receipt, and completes after ACK and sync', () => {
    const loop = setInterval(() => {
      if (useSimulationStore.getState().running) {
        tickStation();
        tickCommunication();
      }
    }, 1_000);
    let queuesAtCompletion: { queue: number; inFlight: number } | undefined;
    const unsubscribe = useUIStore.subscribe((state) => {
      if (state.demo.currentPhase === 'Demo Complete') {
        const comm = useCommunicationStore.getState().comm;
        queuesAtCompletion = { queue: comm.queue.length, inFlight: comm.inFlight.length };
      }
    });
    startDemo();

    vi.advanceTimersByTime(65_000);
    const command = useCommunicationStore.getState().commands[0];
    expect(command).toBeDefined();
    expect([CommandStatus.PENDING, CommandStatus.SENT]).toContain(command.status);
    const loadBeforeReceipt = useSimulationStore.getState().station.energy.powerLoad;
    expect(useUIStore.getState().demo.currentPhase).toMatch(/HQ Issues Command|Waiting for command delivery/);
    expect(loadBeforeReceipt).toBeGreaterThan(0);

    for (let i = 0; i < 80 && useCommunicationStore.getState().commands[0]?.status !== CommandStatus.RECEIVED; i++) {
      vi.advanceTimersByTime(100);
    }
    expect(useCommunicationStore.getState().commands[0].status).toBe(CommandStatus.RECEIVED);
    const loadAtReceipt = useSimulationStore.getState().station.energy.powerLoad;
    expect(loadAtReceipt).toBeGreaterThan(loadBeforeReceipt * 0.7);

    for (let i = 0; i < 1_000 && useUIStore.getState().demo.running; i++) {
      vi.advanceTimersByTime(100);
    }
    clearInterval(loop);
    unsubscribe();
    expect(useCommunicationStore.getState().commands[0].status).toBe(CommandStatus.APPROVED);
    expect(useCommunicationStore.getState().commands[0].acknowledgedAt).toBeDefined();
    expect(useSimulationStore.getState().station.energy.powerLoad).toBeLessThan(loadAtReceipt);
    expect(queuesAtCompletion).toEqual({ queue: 0, inFlight: 0 });
    expect(useUIStore.getState().demo.currentPhase).toBe('Demo Complete');
  });

  it('cancels old callbacks on stop and restart', () => {
    startDemo();
    vi.advanceTimersByTime(0);
    expect(useSimulationStore.getState().scenario.name).toBe('Normal Operations');
    vi.advanceTimersByTime(8_000);
    expect(useSimulationStore.getState().scenario.name).toBe('Blizzard');
    expect(useCommunicationStore.getState().comm.linkState).toBe('ONLINE');
    vi.advanceTimersByTime(17_000);
    expect(useCommunicationStore.getState().comm.linkState).toBe('DEGRADED');
    stopDemo();
    const auditCount = useSimulationStore.getState().auditLog.length;
    vi.advanceTimersByTime(90_000);
    expect(useSimulationStore.getState().auditLog).toHaveLength(auditCount);
    expect(useUIStore.getState().demo.running).toBe(false);

    startDemo();
    vi.advanceTimersByTime(0);
    expect(useUIStore.getState().demo.running).toBe(true);
    expect(useSimulationStore.getState().scenario.name).toBe('Normal Operations');
    stopDemo();
  });
});
