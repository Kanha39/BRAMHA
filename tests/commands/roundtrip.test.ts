import { describe, expect, it } from 'vitest';
import { enqueueCommand, enqueueCommandAcknowledgement, tickCommunication } from '../../src/communication/commEngine';
import { applyFuelConservation, applyLoadReduction } from '../../src/simulation/stationSimulator';
import { useCommunicationStore } from '../../src/store/communicationStore';
import { useSimulationStore } from '../../src/store/simulationStore';
import { CommandStatus, LinkState, Priority } from '../../src/types';
import type { Command } from '../../src/types';
import { advance } from '../helpers';
import '../helpers';

function createCommand(id: string): Command {
  return {
    id,
    type: 'REDUCE_NONESSENTIAL_LOAD',
    description: 'Reduce non-essential load',
    priority: Priority.HIGH,
    status: CommandStatus.PENDING,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  };
}

function deliverCommand(id: string) {
  useCommunicationStore.getState().createCommand(createCommand(id));
  enqueueCommand(useCommunicationStore.getState().commands[0]);
  tickCommunication();
  advance(300);
  tickCommunication();
}

describe('command round trips through the link', () => {
  it('leaves station state unchanged until receipt and explicit approval, then returns an ACK', () => {
    useSimulationStore.getState().setEnergy({ powerLoad: 100 });
    const command = createCommand('approve-1');
    useCommunicationStore.getState().createCommand(command);
    enqueueCommand(command);
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(100);

    tickCommunication();
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(100);
    advance(300);
    tickCommunication();
    expect(useCommunicationStore.getState().commands[0].status).toBe(CommandStatus.RECEIVED);
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(100);

    useCommunicationStore.getState().updateCommandStatus(command.id, CommandStatus.APPROVED);
    applyLoadReduction();
    enqueueCommandAcknowledgement(command.id, 'APPROVED');
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(80);
    expect(useCommunicationStore.getState().commands[0].acknowledgedAt).toBeUndefined();
    tickCommunication();
    expect(useCommunicationStore.getState().commands[0].acknowledgedAt).toBeUndefined();
    advance(300);
    tickCommunication();
    expect(useCommunicationStore.getState().commands[0].acknowledgedAt).toBeDefined();
    expect(useCommunicationStore.getState().commands[0].acknowledgedDecision).toBe('APPROVED');
    const ack = useCommunicationStore.getState().comm.transmissionLog.find((packet) => packet.kind === 'acknowledgement');
    expect(ack?.commandAcknowledgement).toMatchObject({ commandId: command.id, decision: 'APPROVED', timestamp: ack?.telemetry.timestamp });
  });

  it('does not apply a veto and returns its acknowledgement over the link', () => {
    useSimulationStore.getState().setEnergy({ powerLoad: 100 });
    deliverCommand('veto-1');
    const command = useCommunicationStore.getState().commands[0];
    expect(command.status).toBe(CommandStatus.RECEIVED);
    useCommunicationStore.getState().updateCommandStatus(command.id, CommandStatus.VETOED);
    enqueueCommandAcknowledgement(command.id, 'VETOED');
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(100);
    expect(useCommunicationStore.getState().commands[0].acknowledgedAt).toBeUndefined();
    tickCommunication();
    advance(300);
    tickCommunication();
    expect(useCommunicationStore.getState().commands[0].status).toBe(CommandStatus.VETOED);
    expect(useCommunicationStore.getState().commands[0].acknowledgedAt).toBeDefined();
    expect(useCommunicationStore.getState().commands[0].acknowledgedDecision).toBe('VETOED');
    const ack = useCommunicationStore.getState().comm.transmissionLog.find((packet) => packet.kind === 'acknowledgement');
    expect(ack?.commandAcknowledgement).toMatchObject({ commandId: command.id, decision: 'VETOED', timestamp: ack?.telemetry.timestamp });
  });

  it('applies the supported emergency fuel conservation command effect', () => {
    useSimulationStore.getState().setEnergy({ powerLoad: 100 });
    useSimulationStore.getState().setFuel({ consumptionRate: 20 });
    deliverCommand('fuel-conservation-1');
    const command = useCommunicationStore.getState().commands[0];
    expect(command.status).toBe(CommandStatus.RECEIVED);
    useCommunicationStore.getState().updateCommandStatus(command.id, CommandStatus.APPROVED);
    applyFuelConservation();
    enqueueCommandAcknowledgement(command.id, 'APPROVED');
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(90);
    expect(useSimulationStore.getState().station.fuel.consumptionRate).toBe(14);
  });

  it('holds commands created offline until reconnect and delivers them through packet transport', () => {
    useCommunicationStore.getState().setLinkState(LinkState.OFFLINE);
    useSimulationStore.getState().setEnergy({ powerLoad: 100 });
    const command = createCommand('offline-1');
    useCommunicationStore.getState().createCommand(command);
    enqueueCommand(command);
    tickCommunication();
    expect(useCommunicationStore.getState().commands[0].status).toBe(CommandStatus.PENDING);
    expect(useCommunicationStore.getState().comm.queue.some((item) => item.kind === 'command')).toBe(true);
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(100);

    useCommunicationStore.getState().setLinkState(LinkState.ONLINE);
    tickCommunication();
    expect(useCommunicationStore.getState().commands[0].status).toBe(CommandStatus.SENT);
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(100);
    advance(300);
    tickCommunication();
    expect(useCommunicationStore.getState().commands[0].status).toBe(CommandStatus.RECEIVED);
    expect(useSimulationStore.getState().station.energy.powerLoad).toBe(100);
  });

  it('retries a deterministically dropped command packet and only receives it after redelivery', () => {
    const command = createCommand('retry-1');
    useCommunicationStore.getState().createCommand(command);
    enqueueCommand(command);
    useCommunicationStore.getState().processQueue({
      now: Date.now(), latencyMs: 300, packetLossRate: 1, random: () => 0,
    });
    expect(useCommunicationStore.getState().comm.transmissionLog[0].status).toBe('dropped');

    tickCommunication();
    expect(useCommunicationStore.getState().comm.queue.some((item) => item.kind === 'command')).toBe(true);
    expect(useCommunicationStore.getState().commands[0].status).not.toBe(CommandStatus.RECEIVED);

    advance(300);
    tickCommunication();
    advance(300);
    tickCommunication();
    expect(useCommunicationStore.getState().commands[0].status).toBe(CommandStatus.RECEIVED);
  });
});
