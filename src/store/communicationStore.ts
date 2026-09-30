import { create } from 'zustand';
import {
  type CommunicationState,
  type TransmissionPacket,
  type HQState,
  type HQMetric,
  type Command,
  type CommandDecision,
  type StationBrief,
  LinkState,
  CommMode,
  Freshness,
  CommandStatus,
} from '../types';
import { createHQMetric } from '../utils/helpers';

interface CommunicationStore {
  comm: CommunicationState;
  hq: HQState;
  commands: Command[];
  briefs: StationBrief[];

  // Communication actions
  setLinkState: (state: LinkState) => void;
  setCommMode: (mode: CommMode) => void;
  setBandwidth: (bw: number) => void;
  addToQueue: (packet: TransmissionPacket) => void;
  processQueue: (options: { now: number; latencyMs: number; packetLossRate: number; random: () => number }) => void;
  drainDeliveredPackets: () => TransmissionPacket[];
  resetComm: () => void;

  // HQ actions
  updateHQMetric: (category: string, key: string, value: number | string, timestamp: number) => void;
  updateHQAges: (currentTime: number) => void;
  resetHQ: () => void;

  // Command actions
  createCommand: (cmd: Command) => void;
  updateCommandStatus: (id: string, status: CommandStatus) => void;
  acknowledgeCommand: (id: string, decision: CommandDecision) => void;

  // Brief actions
  addBrief: (brief: StationBrief) => void;
  updateBriefStatus: (id: string, status: StationBrief['transmissionStatus']) => void;
}

const DAILY_BYTE_BUDGET = 50 * 1024; // 50 KB daily budget for simulation
export const MAX_QUEUE_BYTES = 64 * 1024;

const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

function queueBytes(queue: TransmissionPacket[]) {
  return queue.reduce((total, packet) => total + packet.telemetry.byteSize, 0);
}

function sortQueue(queue: TransmissionPacket[]) {
  return [...queue].sort((a, b) => PRIORITY_RANK[a.telemetry.priority] - PRIORITY_RANK[b.telemetry.priority]);
}

function syncStateFor(linkState: LinkState, queue: TransmissionPacket[], inFlight: TransmissionPacket[], hq: HQState) {
  if (linkState === LinkState.OFFLINE) return 'BLOCKED' as const;
  if (queue.length > 0 || inFlight.length > 0) return 'SYNCING' as const;
  const records = [hq.environment, hq.energy, hq.fuel, hq.equipment, hq.supplies];
  const hasStaleData = [...records.flatMap((record) => Object.values(record)), hq.daysOfAutonomy]
    .some((metric) => metric.freshness === Freshness.STALE);
  return hasStaleData ? 'STALE' as const : 'SYNCED' as const;
}

function isCompactable(packet: TransmissionPacket) {
  return packet.kind === 'telemetry' && packet.telemetry.priority === 'LOW';
}

function fitQueue(existing: TransmissionPacket[], incoming: TransmissionPacket) {
  let queue = [...existing];
  const dropped: TransmissionPacket[] = [];
  let compactedCount = 0;

  if (isCompactable(incoming)) {
    const previousIndex = queue.findIndex((packet) => isCompactable(packet) && packet.telemetry.type === incoming.telemetry.type);
    if (previousIndex >= 0) {
      const [previous] = queue.splice(previousIndex, 1);
      dropped.push({ ...previous, status: 'dropped', dropReason: 'Superseded by newer queued telemetry' });
      compactedCount++;
    }
  }

  queue.push(incoming);
  let pressureDropCount = 0;
  while (queueBytes(queue) > MAX_QUEUE_BYTES) {
    const candidate = queue
      .map((packet, index) => ({ packet, index }))
      .filter(({ packet }) => packet.kind === 'telemetry' && packet.telemetry.priority !== 'CRITICAL')
      .sort((a, b) => PRIORITY_RANK[b.packet.telemetry.priority] - PRIORITY_RANK[a.packet.telemetry.priority]
        || a.packet.createdAt - b.packet.createdAt)[0];

    if (!candidate) break;
    const [removed] = queue.splice(candidate.index, 1);
    dropped.push({ ...removed, status: 'dropped', dropReason: 'Dropped due to queue capacity' });
    pressureDropCount++;
  }

  // Keep the queue bounded even when it contains only protected packets. In that case,
  // preserve earlier queued work and reject the newly arriving packet.
  if (queueBytes(queue) > MAX_QUEUE_BYTES) {
    const incomingIndex = queue.findIndex((packet) => packet.id === incoming.id);
    if (incomingIndex >= 0) {
      const [rejected] = queue.splice(incomingIndex, 1);
      dropped.push({ ...rejected, status: 'dropped', dropReason: 'Dropped because protected queue is full' });
      pressureDropCount++;
    }
  }

  return { queue: sortQueue(queue), dropped, pressureDropCount, compactedCount };
}

function createInitialHQ(): HQState {
  const now = Date.now();
  return {
    lastSyncTimestamp: now,
    environment: {
      temperature: createHQMetric(-25, now),
      windSpeed: createHQMetric(15, now),
      humidity: createHQMetric(45, now),
      weatherCondition: createHQMetric('CLEAR', now),
    },
    energy: {
      powerGeneration: createHQMetric(80, now),
      powerLoad: createHQMetric(65, now),
      batteryLevel: createHQMetric(92, now),
    },
    fuel: {
      fuelPercentage: createHQMetric(85, now),
      consumptionRate: createHQMetric(12, now),
    },
    equipment: {
      gen1: createHQMetric('OPERATIONAL', now),
      gen2: createHQMetric('OPERATIONAL', now),
      hvac: createHQMetric('OPERATIONAL', now),
      snowmelter: createHQMetric('OPERATIONAL', now),
    },
    supplies: {
      foodDays: createHQMetric(120, now),
      medicineDays: createHQMetric(180, now),
    },
    daysOfAutonomy: createHQMetric(85, now),
    overallStaleness: 0,
    batteryHistory: [{ timestamp: now, value: 92 }],
  };
}

export const useCommunicationStore = create<CommunicationStore>((set, get) => ({
  comm: {
    linkState: LinkState.ONLINE,
    commMode: CommMode.FULL,
    bandwidth: 1024,
    maxBandwidth: 2048,
    dailyByteBudget: DAILY_BYTE_BUDGET,
    bytesUsedToday: 0,
    bytesAttempted: 0,
    bytesDelivered: 0,
    bytesQueued: 0,
    bytesDropped: 0,
    queuePressureDrops: 0,
    queueCompactions: 0,
    queue: [],
    inFlight: [],
    deliveredPackets: [],
    transmissionLog: [],
    latencyMs: 0,
    packetLossRate: 0,
    syncState: 'SYNCED',
  },
  hq: createInitialHQ(),
  commands: [],
  briefs: [],

  setLinkState: (linkState) => set((s) => {
    const returnedToQueue = linkState === LinkState.OFFLINE
      ? s.comm.inFlight.map((packet) => ({ ...packet, status: 'queued' as const, sentAt: undefined, deliveryAt: undefined }))
      : [];
    let queue = [...s.comm.queue];
    const dropped: TransmissionPacket[] = [];
    let pressureDropCount = 0;
    let compactedCount = 0;
    for (const packet of returnedToQueue) {
      const result = fitQueue(queue, packet);
      queue = result.queue;
      dropped.push(...result.dropped);
      pressureDropCount += result.pressureDropCount;
      compactedCount += result.compactedCount;
    }
    const droppedById = new Map(dropped.map((packet) => [packet.id, packet]));
    const existingPackets = new Map(s.comm.transmissionLog.map((packet) => [packet.id, packet]));
    const transmissionLog = [
      ...dropped.filter((packet) => !existingPackets.has(packet.id)),
      ...s.comm.transmissionLog.map((packet) => {
        if (!returnedToQueue.some((item) => item.id === packet.id)) return packet;
        return droppedById.get(packet.id)
          ?? { ...packet, status: 'queued' as const, sentAt: undefined, deliveryAt: undefined };
      }),
    ].slice(0, 100);
    return {
      comm: {
        ...s.comm,
        linkState,
        queue,
        inFlight: linkState === LinkState.OFFLINE ? [] : s.comm.inFlight,
        bytesQueued: queueBytes(queue),
        bytesDropped: s.comm.bytesDropped + dropped.reduce((sum, packet) => sum + packet.telemetry.byteSize, 0),
        queuePressureDrops: s.comm.queuePressureDrops + pressureDropCount,
        queueCompactions: s.comm.queueCompactions + compactedCount,
        transmissionLog,
        syncState: syncStateFor(linkState, queue, linkState === LinkState.OFFLINE ? [] : s.comm.inFlight, s.hq),
      },
    };
  }),
  
  setCommMode: (commMode) => set((s) => ({ comm: { ...s.comm, commMode } })),
  
  setBandwidth: (bandwidth) => set((s) => ({ comm: { ...s.comm, bandwidth } })),
  
  addToQueue: (packet) => set((s) => {
    const result = fitQueue(s.comm.queue, packet);
    const bytesDropped = result.dropped.reduce((sum, item) => sum + item.telemetry.byteSize, 0);
    const transmissionLog = result.dropped.length > 0
      ? [...result.dropped, ...s.comm.transmissionLog].slice(0, 100)
      : s.comm.transmissionLog;
    return {
      comm: {
        ...s.comm,
        queue: result.queue,
        bytesQueued: queueBytes(result.queue),
        bytesDropped: s.comm.bytesDropped + bytesDropped,
        queuePressureDrops: s.comm.queuePressureDrops + result.pressureDropCount,
        queueCompactions: s.comm.queueCompactions + result.compactedCount,
        transmissionLog,
        syncState: syncStateFor(s.comm.linkState, result.queue, s.comm.inFlight, s.hq),
      },
    };
  }),
  
  processQueue: ({ now, latencyMs, packetLossRate, random }) => set((s) => {
    const completed = s.comm.inFlight
      .filter((packet) => (packet.deliveryAt ?? Infinity) <= now)
      .map((packet) => ({ ...packet, status: 'sent' as const, deliveredAt: now }));
    const remainingInFlight = s.comm.inFlight.filter((packet) => (packet.deliveryAt ?? Infinity) > now);
    const completedIds = new Set(completed.map((packet) => packet.id));
    let transmissionLog = s.comm.transmissionLog.map((packet) => (
      completedIds.has(packet.id) ? completed.find((item) => item.id === packet.id) ?? packet : packet
    ));

    if (s.comm.linkState === LinkState.OFFLINE || s.comm.queue.length === 0) {
      const inFlight = remainingInFlight;
      return {
        comm: {
          ...s.comm,
          inFlight,
          bytesDelivered: s.comm.bytesDelivered + completed.reduce((sum, packet) => sum + packet.telemetry.byteSize, 0),
          deliveredPackets: completed,
          transmissionLog,
          latencyMs,
          packetLossRate,
          syncState: syncStateFor(s.comm.linkState, s.comm.queue, inFlight, s.hq),
        },
      };
    }
    
    const effectiveBandwidth = s.comm.linkState === LinkState.DEGRADED 
      ? Math.floor(s.comm.bandwidth * 0.3) 
      : s.comm.bandwidth;
    
    let bytesAvailable = effectiveBandwidth;
    let bytesRemaining = s.comm.dailyByteBudget - s.comm.bytesUsedToday;
    bytesAvailable = Math.min(bytesAvailable, bytesRemaining);
    
    if (bytesAvailable <= 0) {
      return {
        comm: {
          ...s.comm,
          inFlight: remainingInFlight,
          bytesDelivered: s.comm.bytesDelivered + completed.reduce((sum, packet) => sum + packet.telemetry.byteSize, 0),
          deliveredPackets: completed,
          transmissionLog,
          latencyMs,
          packetLossRate,
          syncState: syncStateFor(s.comm.linkState, s.comm.queue, remainingInFlight, s.hq),
        },
      };
    }
    
    const sent: TransmissionPacket[] = [];
    const remaining: TransmissionPacket[] = [];
    let attemptedBytes = 0;
    
    for (const packet of s.comm.queue) {
      if (bytesAvailable >= packet.telemetry.byteSize) {
        bytesAvailable -= packet.telemetry.byteSize;
        const lost = random() < packetLossRate;
        if (lost) {
          sent.push({ ...packet, status: 'dropped', sentAt: now, deliveredAt: now, dropReason: 'Simulated packet loss' });
          attemptedBytes += packet.telemetry.byteSize;
        } else {
          sent.push({ ...packet, status: 'transmitting', sentAt: now, deliveryAt: now + latencyMs });
          attemptedBytes += packet.telemetry.byteSize;
        }
      } else {
        remaining.push(packet);
      }
    }

    const dropped = sent.filter((packet) => packet.status === 'dropped');
    const starting = sent.filter((packet) => packet.status === 'transmitting');
    transmissionLog = [...starting, ...dropped, ...transmissionLog].slice(0, 100);
    
    return {
      comm: {
        ...s.comm,
        queue: remaining,
        inFlight: [...remainingInFlight, ...starting],
        deliveredPackets: completed,
        transmissionLog,
        bytesAttempted: s.comm.bytesAttempted + attemptedBytes,
        bytesDelivered: s.comm.bytesDelivered + completed.reduce((sum, packet) => sum + packet.telemetry.byteSize, 0),
        bytesUsedToday: s.comm.bytesUsedToday + attemptedBytes,
        bytesDropped: s.comm.bytesDropped + dropped.reduce((sum, packet) => sum + packet.telemetry.byteSize, 0),
        bytesQueued: remaining.reduce((sum, p) => sum + p.telemetry.byteSize, 0),
        latencyMs,
        packetLossRate,
        syncState: syncStateFor(s.comm.linkState, remaining, [...remainingInFlight, ...starting], s.hq),
      },
    };
  }),

  drainDeliveredPackets: () => {
    const delivered = get().comm.deliveredPackets;
    if (delivered.length > 0) set((s) => ({ comm: { ...s.comm, deliveredPackets: [] } }));
    return delivered;
  },

  resetComm: () => set({
    comm: {
      linkState: LinkState.ONLINE,
      commMode: CommMode.FULL,
      bandwidth: 1024,
      maxBandwidth: 2048,
      dailyByteBudget: DAILY_BYTE_BUDGET,
      bytesUsedToday: 0,
      bytesAttempted: 0,
      bytesDelivered: 0,
      bytesQueued: 0,
      bytesDropped: 0,
      queuePressureDrops: 0,
      queueCompactions: 0,
      queue: [],
      inFlight: [],
      deliveredPackets: [],
      transmissionLog: [],
      latencyMs: 0,
      packetLossRate: 0,
      syncState: 'SYNCED',
    },
    hq: createInitialHQ(),
    commands: [],
    briefs: [],
  }),

  updateHQMetric: (category, key, value, timestamp) => set((s) => {
    const hq = { ...s.hq };
    const cat = category as keyof Omit<HQState, 'lastSyncTimestamp' | 'overallStaleness' | 'daysOfAutonomy'>;
    if (cat === 'daysOfAutonomy' as any) {
      hq.daysOfAutonomy = { value, lastUpdated: timestamp, age: 0, freshness: Freshness.FRESH };
    } else if (hq[cat] && typeof hq[cat] === 'object') {
      (hq[cat] as Record<string, HQMetric>)[key] = { value, lastUpdated: timestamp, age: 0, freshness: Freshness.FRESH };
    }
    if (category === 'energy' && key === 'batteryLevel' && typeof value === 'number') {
      const observations = hq.batteryHistory;
      const last = observations[observations.length - 1];
      if (!last || timestamp > last.timestamp) {
        hq.batteryHistory = [...observations, { timestamp, value }].slice(-60);
      }
    }
    hq.lastSyncTimestamp = timestamp;
    return { hq, comm: { ...s.comm, syncState: syncStateFor(s.comm.linkState, s.comm.queue, s.comm.inFlight, hq) } };
  }),

  updateHQAges: (currentTime) => set((s) => {
    const hq = { ...s.hq };
    let totalAge = 0;
    let count = 0;
    
    const updateRecord = (record: Record<string, HQMetric>): Record<string, HQMetric> => {
      const updated: Record<string, HQMetric> = {};
      for (const [k, v] of Object.entries(record)) {
        const age = currentTime - v.lastUpdated;
        totalAge += age;
        count++;
        const freshness = age < 5000 ? Freshness.FRESH : age < 15000 ? Freshness.AGING : Freshness.STALE;
        updated[k] = { ...v, age, freshness };
      }
      return updated;
    };
    
    hq.environment = updateRecord(hq.environment);
    hq.energy = updateRecord(hq.energy);
    hq.fuel = updateRecord(hq.fuel);
    hq.equipment = updateRecord(hq.equipment);
    hq.supplies = updateRecord(hq.supplies);
    
    // Update autonomy metric age too
    const autoAge = currentTime - hq.daysOfAutonomy.lastUpdated;
    totalAge += autoAge;
    count++;
    hq.daysOfAutonomy = {
      ...hq.daysOfAutonomy,
      age: autoAge,
      freshness: autoAge < 5000 ? Freshness.FRESH : autoAge < 15000 ? Freshness.AGING : Freshness.STALE,
    };
    
    hq.overallStaleness = count > 0 ? totalAge / count : 0;
    return { hq, comm: { ...s.comm, syncState: syncStateFor(s.comm.linkState, s.comm.queue, s.comm.inFlight, hq) } };
  }),

  resetHQ: () => set((s) => {
    const hq = createInitialHQ();
    return { hq, comm: { ...s.comm, syncState: syncStateFor(s.comm.linkState, s.comm.queue, s.comm.inFlight, hq) } };
  }),

  createCommand: (cmd) => set((s) => ({ commands: [cmd, ...s.commands] })),
  
  updateCommandStatus: (id, status) => set((s) => ({
    commands: s.commands.map((c) => {
      if (c.id !== id) return c;
      const updates: Partial<Command> = { status };
      if (status === CommandStatus.SENT) updates.sentAt = Date.now();
      if (status === CommandStatus.RECEIVED) updates.receivedAt = Date.now();
      if (status === CommandStatus.APPROVED || status === CommandStatus.VETOED) {
        updates.resolvedAt = Date.now();
      }
      return { ...c, ...updates };
    }),
  })),

  acknowledgeCommand: (id, decision) => set((s) => ({
    commands: s.commands.map((command) => command.id === id ? { ...command, acknowledgedAt: Date.now(), acknowledgedDecision: decision } : command),
  })),

  addBrief: (brief) => set((s) => ({ briefs: [brief, ...s.briefs] })),
  updateBriefStatus: (id, status) => set((s) => ({
    briefs: s.briefs.map((b) => (b.id === id ? { ...b, transmissionStatus: status } : b)),
  })),
}));
