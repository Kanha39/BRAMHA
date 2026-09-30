import { create } from 'zustand';
import {
  type CommunicationState,
  type TransmissionPacket,
  type HQState,
  type HQMetric,
  type Command,
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
  processQueue: () => void;
  updateBytesUsed: (bytes: number) => void;
  resetComm: () => void;

  // HQ actions
  updateHQMetric: (category: string, key: string, value: number | string, timestamp: number) => void;
  updateHQAges: (currentTime: number) => void;
  resetHQ: () => void;

  // Command actions
  createCommand: (cmd: Command) => void;
  updateCommandStatus: (id: string, status: CommandStatus) => void;
  
  // Brief actions
  addBrief: (brief: StationBrief) => void;
  updateBriefStatus: (id: string, status: StationBrief['transmissionStatus']) => void;
}

const DAILY_BYTE_BUDGET = 50 * 1024; // 50 KB daily budget for simulation

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
    bytesSent: 0,
    bytesQueued: 0,
    bytesDropped: 0,
    queue: [],
    transmissionLog: [],
  },
  hq: createInitialHQ(),
  commands: [],
  briefs: [],

  setLinkState: (linkState) => set((s) => ({ comm: { ...s.comm, linkState } })),
  
  setCommMode: (commMode) => set((s) => ({ comm: { ...s.comm, commMode } })),
  
  setBandwidth: (bandwidth) => set((s) => ({ comm: { ...s.comm, bandwidth } })),
  
  addToQueue: (packet) => set((s) => {
    const queue = [...s.comm.queue, packet];
    // Sort by priority: CRITICAL=0, HIGH=1, MEDIUM=2, LOW=3
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    queue.sort((a, b) => {
      const pa = priorityOrder[a.telemetry.priority] ?? 3;
      const pb = priorityOrder[b.telemetry.priority] ?? 3;
      return pa - pb;
    });
    const bytesQueued = queue.reduce((sum, p) => sum + p.telemetry.byteSize, 0);
    return { comm: { ...s.comm, queue, bytesQueued } };
  }),
  
  processQueue: () => set((s) => {
    if (s.comm.linkState === LinkState.OFFLINE || s.comm.queue.length === 0) return {};
    
    const effectiveBandwidth = s.comm.linkState === LinkState.DEGRADED 
      ? Math.floor(s.comm.bandwidth * 0.3) 
      : s.comm.bandwidth;
    
    let bytesAvailable = effectiveBandwidth;
    let bytesRemaining = s.comm.dailyByteBudget - s.comm.bytesUsedToday;
    bytesAvailable = Math.min(bytesAvailable, bytesRemaining);
    
    if (bytesAvailable <= 0) return {};
    
    const sent: TransmissionPacket[] = [];
    const remaining: TransmissionPacket[] = [];
    let totalBytesSent = 0;
    
    for (const packet of s.comm.queue) {
      if (bytesAvailable >= packet.telemetry.byteSize) {
        bytesAvailable -= packet.telemetry.byteSize;
        totalBytesSent += packet.telemetry.byteSize;
        sent.push({ ...packet, status: 'sent', sentAt: Date.now() });
      } else {
        remaining.push(packet);
      }
    }
    
    return {
      comm: {
        ...s.comm,
        queue: remaining,
        transmissionLog: [...sent, ...s.comm.transmissionLog].slice(0, 100),
        bytesSent: s.comm.bytesSent + totalBytesSent,
        bytesUsedToday: s.comm.bytesUsedToday + totalBytesSent,
        bytesQueued: remaining.reduce((sum, p) => sum + p.telemetry.byteSize, 0),
      },
    };
  }),
  
  updateBytesUsed: (bytes) => set((s) => ({
    comm: { ...s.comm, bytesUsedToday: s.comm.bytesUsedToday + bytes },
  })),

  resetComm: () => set({
    comm: {
      linkState: LinkState.ONLINE,
      commMode: CommMode.FULL,
      bandwidth: 1024,
      maxBandwidth: 2048,
      dailyByteBudget: DAILY_BYTE_BUDGET,
      bytesUsedToday: 0,
      bytesSent: 0,
      bytesQueued: 0,
      bytesDropped: 0,
      queue: [],
      transmissionLog: [],
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
    hq.lastSyncTimestamp = timestamp;
    return { hq };
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
        const freshness = age < 120000 ? Freshness.FRESH : age < 300000 ? Freshness.AGING : Freshness.STALE;
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
      freshness: autoAge < 120000 ? Freshness.FRESH : autoAge < 300000 ? Freshness.AGING : Freshness.STALE,
    };
    
    hq.overallStaleness = count > 0 ? totalAge / count : 0;
    return { hq };
  }),

  resetHQ: () => set({ hq: createInitialHQ() }),

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

  addBrief: (brief) => set((s) => ({ briefs: [brief, ...s.briefs] })),
  updateBriefStatus: (id, status) => set((s) => ({
    briefs: s.briefs.map((b) => (b.id === id ? { ...b, transmissionStatus: status } : b)),
  })),
}));
