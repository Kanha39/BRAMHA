import { describe, expect, it } from 'vitest';
import { enqueueCommand, enqueueCommandAcknowledgement, tickCommunication } from '../../src/communication/commEngine';
import { resetScenario } from '../../src/simulation/scenarioEngine';
import { useCommunicationStore } from '../../src/store/communicationStore';
import { useSimulationStore } from '../../src/store/simulationStore';
import { useUIStore } from '../../src/store/uiStore';
import { CommandStatus, Priority } from '../../src/types';
import '../helpers';

describe('workflow reset', () => {
  it('clears queued and in-flight traffic, HQ forecast history, commands and demo state', () => {
    const command = {
      id: 'reset-cmd', type: 'TEST', description: 'test reset', priority: Priority.HIGH,
      status: CommandStatus.PENDING, createdAt: Date.now(), expiresAt: Date.now() + 10_000,
    } as const;
    useCommunicationStore.getState().createCommand(command);
    enqueueCommand(command);
    tickCommunication();
    enqueueCommandAcknowledgement(command.id, 'APPROVED');
    useUIStore.getState().setDemo({ running: true, step: 8, currentPhase: 'Running' });
    resetScenario();

    const { comm, hq, commands } = useCommunicationStore.getState();
    expect(comm.queue).toHaveLength(0);
    expect(comm.inFlight).toHaveLength(0);
    expect(commands).toHaveLength(0);
    expect(hq.batteryHistory).toHaveLength(1);
    expect(useSimulationStore.getState().history.battery).toHaveLength(0);
    expect(useUIStore.getState().demo.running).toBe(false);
    expect(useUIStore.getState().demo.currentPhase).toBe('Idle');
  });
});
