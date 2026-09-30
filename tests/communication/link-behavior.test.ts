import { describe, expect, it } from 'vitest';
import { getTransportProfile, tickCommunication, resetCommunicationEngine } from '../../src/communication/commEngine';
import { MAX_QUEUE_BYTES, useCommunicationStore } from '../../src/store/communicationStore';
import { useSimulationStore } from '../../src/store/simulationStore';
import { CommMode, Freshness, LinkState, Priority } from '../../src/types';
import type { TransmissionPacket } from '../../src/types';
import { advance } from '../helpers';
import '../helpers';

function packet(id: string, priority: Priority, byteSize = 10, type = 'energy.batteryLevel'): TransmissionPacket {
  return {
    id,
    kind: 'telemetry',
    direction: 'station-to-hq',
    telemetry: { type, value: Number(id) || id, timestamp: Date.now(), priority, byteSize },
    status: 'queued',
    createdAt: Date.now(),
  };
}

describe('communication and HQ knowledge', () => {
  it('delivers online telemetry to HQ only after transport latency', () => {
    resetCommunicationEngine(2026);
    advance(1);
    useSimulationStore.getState().setEnergy({ batteryLevel: 60 });
    tickCommunication();
    expect(useCommunicationStore.getState().comm.inFlight.length).toBeGreaterThan(0);
    expect(Number(useCommunicationStore.getState().hq.energy.batteryLevel.value)).toBe(92);
    advance(300);
    tickCommunication();
    expect(Number(useCommunicationStore.getState().hq.energy.batteryLevel.value)).toBe(60);
    expect(useCommunicationStore.getState().hq.energy.batteryLevel.age).toBe(300);
    expect(useCommunicationStore.getState().hq.energy.batteryLevel.freshness).toBe(Freshness.FRESH);
    expect(useCommunicationStore.getState().comm.bytesAttempted).toBeGreaterThan(0);
    expect(useCommunicationStore.getState().comm.bytesDelivered).toBeGreaterThan(0);
    expect(useCommunicationStore.getState().comm.transmissionLog.some((item) => item.status === 'sent')).toBe(true);

    useSimulationStore.getState().setEnergy({ batteryLevel: 50 });
    expect(Number(useCommunicationStore.getState().hq.energy.batteryLevel.value)).toBe(60);
  });

  it('keeps HQ unchanged and ages data while offline as station telemetry queues', () => {
    const comm = useCommunicationStore.getState();
    comm.setLinkState(LinkState.OFFLINE);
    advance(1);
    useSimulationStore.getState().setEnergy({ batteryLevel: 60 });
    tickCommunication();
    const queuedAfterFirstTick = useCommunicationStore.getState().comm.queue.length;
    useSimulationStore.getState().setEnergy({ batteryLevel: 50 });
    advance(1_000);
    tickCommunication();
    expect(useSimulationStore.getState().station.energy.batteryLevel).toBe(50);
    expect(Number(useCommunicationStore.getState().hq.energy.batteryLevel.value)).toBe(92);
    expect(useCommunicationStore.getState().comm.queue.length).toBeGreaterThan(queuedAfterFirstTick);
    expect(useCommunicationStore.getState().comm.syncState).toBe('BLOCKED');
    useCommunicationStore.getState().updateHQAges(Date.now() + 20_000);
    expect(useCommunicationStore.getState().hq.energy.batteryLevel.age).toBeGreaterThan(15_000);
    expect(useCommunicationStore.getState().hq.energy.batteryLevel.freshness).toBe(Freshness.STALE);
  });

  it('moves HQ freshness from fresh to aging to stale, then resets on a delivered update', () => {
    const comm = useCommunicationStore.getState();
    expect(comm.hq.energy.batteryLevel.freshness).toBe(Freshness.FRESH);
    comm.updateHQAges(Date.now() + 6_000);
    expect(useCommunicationStore.getState().hq.energy.batteryLevel.freshness).toBe(Freshness.AGING);
    comm.updateHQAges(Date.now() + 16_000);
    expect(useCommunicationStore.getState().hq.energy.batteryLevel.freshness).toBe(Freshness.STALE);
    expect(useCommunicationStore.getState().comm.syncState).toBe('STALE');
    comm.updateHQMetric('energy', 'batteryLevel', 73, Date.now() + 16_001);
    expect(useCommunicationStore.getState().hq.energy.batteryLevel.age).toBe(0);
    expect(useCommunicationStore.getState().hq.energy.batteryLevel.freshness).toBe(Freshness.FRESH);
  });

  it('constrains degraded throughput and sends higher-priority queued packets first', () => {
    const store = useCommunicationStore.getState();
    store.setLinkState(LinkState.DEGRADED);
    store.setBandwidth(100);
    store.addToQueue(packet('low', Priority.LOW, 10));
    store.addToQueue(packet('medium', Priority.MEDIUM, 10));
    store.addToQueue(packet('high', Priority.HIGH, 10));
    store.addToQueue(packet('critical', Priority.CRITICAL, 10));
    expect(useCommunicationStore.getState().comm.queue.map((item) => item.id)).toEqual(['critical', 'high', 'medium', 'low']);
    const profile = getTransportProfile(LinkState.DEGRADED);
    store.processQueue({ now: Date.now(), ...profile, random: () => 0.9 });
    const current = useCommunicationStore.getState().comm;
    expect(current.inFlight.map((item) => item.id)).toEqual(['critical', 'high', 'medium']);
    expect(current.queue.map((item) => item.id)).toEqual(['low']);
    expect(current.latencyMs).toBe(profile.latencyMs);
    expect(current.syncState).toBe('SYNCING');
    expect(current.linkState).toBe(LinkState.DEGRADED);
    expect(current.bytesQueued).toBe(current.queue.reduce((sum, item) => sum + item.telemetry.byteSize, 0));
  });

  it('drops packets deterministically without changing HQ and accounts their bytes', () => {
    const store = useCommunicationStore.getState();
    store.addToQueue(packet('loss', Priority.HIGH, 24));
    store.processQueue({ now: Date.now(), latencyMs: 300, packetLossRate: 1, random: () => 0 });
    const comm = useCommunicationStore.getState().comm;
    expect(comm.transmissionLog[0].status).toBe('dropped');
    expect(comm.bytesDropped).toBe(24);
    expect(comm.bytesAttempted).toBe(24);
    expect(comm.bytesDelivered).toBe(0);
    expect(Number(useCommunicationStore.getState().hq.energy.batteryLevel.value)).toBe(92);
  });

  it('progressively synchronizes queued telemetry after reconnect without copying station truth', () => {
    const store = useCommunicationStore.getState();
    store.setLinkState(LinkState.OFFLINE);
    advance(1);
    useSimulationStore.getState().setEnergy({ batteryLevel: 60 });
    tickCommunication();
    useSimulationStore.getState().setEnergy({ batteryLevel: 55 });
    advance(1_000);
    tickCommunication();
    expect(Number(useCommunicationStore.getState().hq.energy.batteryLevel.value)).toBe(92);
    expect(useCommunicationStore.getState().hq.batteryHistory.map((item) => item.value)).toEqual([92]);

    store.setLinkState(LinkState.ONLINE);
    tickCommunication();
    expect(Number(useCommunicationStore.getState().hq.energy.batteryLevel.value)).toBe(92);
    for (let i = 0; i < 8 && Number(useCommunicationStore.getState().hq.energy.batteryLevel.value) !== 55; i++) {
      advance(300);
      tickCommunication();
    }
    expect(Number(useCommunicationStore.getState().hq.energy.batteryLevel.value)).toBe(55);
    expect(useCommunicationStore.getState().hq.batteryHistory.map((item) => item.value)).toEqual([92, 60, 55]);
  });

  it('keeps communication mode filters in force while offline and restores full telemetry mode', () => {
    const store = useCommunicationStore.getState();
    store.setLinkState(LinkState.OFFLINE);
    store.setCommMode(CommMode.SOS_ONLY);
    useSimulationStore.getState().setEnergy({ batteryLevel: 70 });
    tickCommunication();
    expect(useCommunicationStore.getState().comm.queue.every((item) => item.telemetry.priority === Priority.CRITICAL)).toBe(true);
  });

  it('bounds the queue and evicts low priority before higher priority telemetry', () => {
    const store = useCommunicationStore.getState();
    store.addToQueue(packet('low', Priority.LOW, 30_000, 'environment.temperature'));
    store.addToQueue(packet('high', Priority.HIGH, 30_000, 'energy.powerLoad'));
    store.addToQueue(packet('critical', Priority.CRITICAL, 10_000, 'equipment.gen1'));
    const comm = useCommunicationStore.getState().comm;
    expect(comm.bytesQueued).toBeLessThanOrEqual(MAX_QUEUE_BYTES);
    expect(comm.queue.map((item) => item.id)).toEqual(['critical', 'high']);
    expect(comm.queuePressureDrops).toBe(1);
    expect(comm.bytesDropped).toBe(30_000);
    expect(comm.bytesQueued).toBe(comm.queue.reduce((sum, item) => sum + item.telemetry.byteSize, 0));
    expect(comm.bytesAttempted).toBe(0);
    expect(comm.transmissionLog[0].dropReason).toBe('Dropped due to queue capacity');
  });

  it('compacts only superseded low-priority telemetry for the same metric', () => {
    const store = useCommunicationStore.getState();
    store.addToQueue(packet('old', Priority.LOW, 100, 'environment.temperature'));
    store.addToQueue(packet('new', Priority.LOW, 110, 'environment.temperature'));
    store.addToQueue({ ...packet('brief', Priority.LOW, 100, 'STATION_BRIEF'), kind: 'brief' });
    store.addToQueue({ ...packet('command', Priority.LOW, 100, 'command.TEST'), kind: 'command' });
    store.addToQueue({ ...packet('ack', Priority.LOW, 100, 'ack.command'), kind: 'acknowledgement' });
    store.addToQueue(packet('critical-a', Priority.CRITICAL, 100, 'equipment.gen2'));
    store.addToQueue(packet('critical-b', Priority.CRITICAL, 100, 'equipment.gen2'));
    const comm = useCommunicationStore.getState().comm;
    expect(comm.queue.map((item) => item.id)).toEqual(['critical-a', 'critical-b', 'new', 'brief', 'command', 'ack']);
    expect(comm.queueCompactions).toBe(1);
    expect(comm.queuePressureDrops).toBe(0);
    expect(comm.bytesDropped).toBe(100);
    expect(comm.transmissionLog[0].dropReason).toBe('Superseded by newer queued telemetry');
  });

  it('rejects a new protected packet only when the bounded queue has no evictable telemetry', () => {
    const store = useCommunicationStore.getState();
    store.addToQueue(packet('critical-existing', Priority.CRITICAL, MAX_QUEUE_BYTES, 'equipment.gen1'));
    store.addToQueue(packet('critical-new', Priority.CRITICAL, 1, 'equipment.gen2'));
    const comm = useCommunicationStore.getState().comm;
    expect(comm.bytesQueued).toBe(MAX_QUEUE_BYTES);
    expect(comm.queue.map((item) => item.id)).toEqual(['critical-existing']);
    expect(comm.queuePressureDrops).toBe(1);
    expect(comm.bytesDropped).toBe(1);
  });
});
