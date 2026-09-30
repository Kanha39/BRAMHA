import {
  type TelemetryPoint,
  type TransmissionPacket,
  type Command,
  type CommandDecision,
  Priority,
  CommMode,
  LinkState,
  CommandStatus,
} from '../types';
import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { generateId } from '../utils/helpers';
import { SeededRandom } from '../utils/seededRandom';

const transportRng = new SeededRandom(2026);
const lastQueuedValues = new Map<string, string>();
const lastQueuedAt = new Map<string, number>();
const retriedCommandPackets = new Set<string>();
const retriedAcknowledgementPackets = new Set<string>();

export function resetCommunicationEngine(seed: number = 2026) {
  transportRng.reset(seed);
  lastQueuedValues.clear();
  lastQueuedAt.clear();
  retriedCommandPackets.clear();
  retriedAcknowledgementPackets.clear();
}

/** Queue a fresh snapshot on the next communication tick after a full reconnect. */
export function requestTelemetryRefresh() {
  lastQueuedValues.clear();
  lastQueuedAt.clear();
}

export function getTransportProfile(linkState: LinkState) {
  switch (linkState) {
    case LinkState.DEGRADED:
      return { latencyMs: 2500, packetLossRate: 0.1 };
    case LinkState.OFFLINE:
      return { latencyMs: 0, packetLossRate: 1 };
    case LinkState.ONLINE:
    default:
      return { latencyMs: 300, packetLossRate: 0.01 };
  }
}

// Telemetry priority mapping
const METRIC_PRIORITIES: Record<string, Priority> = {
  // Critical
  'equipment.gen1': Priority.CRITICAL,
  'equipment.gen2': Priority.CRITICAL,
  
  // High
  'energy.powerGeneration': Priority.HIGH,
  'energy.powerLoad': Priority.HIGH,
  'energy.batteryLevel': Priority.HIGH,
  'environment.windSpeed': Priority.HIGH,
  
  // Medium
  'fuel.fuelPercentage': Priority.MEDIUM,
  'fuel.consumptionRate': Priority.MEDIUM,
  'environment.temperature': Priority.MEDIUM,
  'supplies.foodDays': Priority.MEDIUM,
  'supplies.medicineDays': Priority.MEDIUM,
  'daysOfAutonomy': Priority.MEDIUM,
  
  // Low
  'environment.humidity': Priority.LOW,
  'environment.weatherCondition': Priority.LOW,
  'equipment.hvac': Priority.LOW,
  'equipment.snowmelter': Priority.LOW,
};

// Estimate byte sizes for different telemetry types
function estimateBytes(type: string, value: unknown): number {
  const base = 20; // header overhead
  const valueSize = typeof value === 'string' ? (value as string).length * 2 : 8;
  return base + type.length + valueSize;
}

// Create telemetry points from current station state
function generateTelemetry(): TelemetryPoint[] {
  const { station } = useSimulationStore.getState();
  const now = Date.now();
  const points: TelemetryPoint[] = [];

  // Environment
  points.push({ type: 'environment.temperature', value: station.environment.temperature, timestamp: now, priority: METRIC_PRIORITIES['environment.temperature'], byteSize: estimateBytes('environment.temperature', station.environment.temperature) });
  points.push({ type: 'environment.windSpeed', value: station.environment.windSpeed, timestamp: now, priority: METRIC_PRIORITIES['environment.windSpeed'], byteSize: estimateBytes('environment.windSpeed', station.environment.windSpeed) });
  points.push({ type: 'environment.humidity', value: station.environment.humidity, timestamp: now, priority: METRIC_PRIORITIES['environment.humidity'], byteSize: estimateBytes('environment.humidity', station.environment.humidity) });
  points.push({ type: 'environment.weatherCondition', value: station.environment.weatherCondition, timestamp: now, priority: METRIC_PRIORITIES['environment.weatherCondition'], byteSize: estimateBytes('environment.weatherCondition', station.environment.weatherCondition) });

  // Energy
  points.push({ type: 'energy.powerGeneration', value: station.energy.powerGeneration, timestamp: now, priority: METRIC_PRIORITIES['energy.powerGeneration'], byteSize: estimateBytes('energy.powerGeneration', station.energy.powerGeneration) });
  points.push({ type: 'energy.powerLoad', value: station.energy.powerLoad, timestamp: now, priority: METRIC_PRIORITIES['energy.powerLoad'], byteSize: estimateBytes('energy.powerLoad', station.energy.powerLoad) });
  points.push({ type: 'energy.batteryLevel', value: station.energy.batteryLevel, timestamp: now, priority: METRIC_PRIORITIES['energy.batteryLevel'], byteSize: estimateBytes('energy.batteryLevel', station.energy.batteryLevel) });

  // Fuel
  points.push({ type: 'fuel.fuelPercentage', value: station.fuel.fuelPercentage, timestamp: now, priority: METRIC_PRIORITIES['fuel.fuelPercentage'], byteSize: estimateBytes('fuel.fuelPercentage', station.fuel.fuelPercentage) });
  points.push({ type: 'fuel.consumptionRate', value: station.fuel.consumptionRate, timestamp: now, priority: METRIC_PRIORITIES['fuel.consumptionRate'], byteSize: estimateBytes('fuel.consumptionRate', station.fuel.consumptionRate) });

  // Equipment
  for (const equip of station.equipment) {
    const key = `equipment.${equip.id}`;
    points.push({ type: key, value: equip.status, timestamp: now, priority: METRIC_PRIORITIES[key] || Priority.LOW, byteSize: estimateBytes(key, equip.status) });
  }

  // Supplies
  points.push({ type: 'supplies.foodDays', value: station.supplies.foodDays, timestamp: now, priority: METRIC_PRIORITIES['supplies.foodDays'], byteSize: estimateBytes('supplies.foodDays', station.supplies.foodDays) });
  points.push({ type: 'supplies.medicineDays', value: station.supplies.medicineDays, timestamp: now, priority: METRIC_PRIORITIES['supplies.medicineDays'], byteSize: estimateBytes('supplies.medicineDays', station.supplies.medicineDays) });

  // Autonomy
  points.push({ type: 'daysOfAutonomy', value: station.daysOfAutonomy, timestamp: now, priority: METRIC_PRIORITIES['daysOfAutonomy'], byteSize: estimateBytes('daysOfAutonomy', station.daysOfAutonomy) });

  return points;
}

// Filter telemetry based on communication mode
function filterByMode(points: TelemetryPoint[], mode: CommMode): TelemetryPoint[] {
  switch (mode) {
    case CommMode.FULL:
      return points;
    case CommMode.COMPACT:
      return points.filter((p) => p.priority !== Priority.LOW);
    case CommMode.ALERTS_ONLY:
      return points.filter((p) => p.priority === Priority.CRITICAL || p.priority === Priority.HIGH);
    case CommMode.SOS_ONLY:
      return points.filter((p) => p.priority === Priority.CRITICAL);
  }
}

function queuePacket(packet: TransmissionPacket) {
  useCommunicationStore.getState().addToQueue(packet);
}

export function enqueueCommand(command: Command) {
  queuePacket({
    id: generateId(),
    kind: 'command',
    direction: 'hq-to-station',
    commandId: command.id,
    telemetry: {
      type: `command.${command.type}`,
      value: command.id,
      timestamp: Date.now(),
      priority: command.priority,
      byteSize: estimateBytes(`command.${command.type}`, command.description),
    },
    status: 'queued',
    createdAt: Date.now(),
  });
}

export function enqueueCommandAcknowledgement(commandId: string, decision: CommandDecision) {
  const timestamp = Date.now();
  queuePacket({
    id: generateId(),
    kind: 'acknowledgement',
    direction: 'station-to-hq',
    commandId,
    commandAcknowledgement: { commandId, decision, timestamp },
    telemetry: {
      type: 'ack.command',
      value: decision,
      timestamp,
      priority: Priority.HIGH,
      byteSize: estimateBytes('ack.command', `${commandId}:${decision}:${timestamp}`),
    },
    status: 'queued',
    createdAt: timestamp,
  });
}

function shouldQueueTelemetry(telemetry: TelemetryPoint) {
  const value = String(telemetry.value);
  const previous = lastQueuedValues.get(telemetry.type);
  const previousAt = lastQueuedAt.get(telemetry.type) ?? 0;
  const isHeartbeatDue = telemetry.priority === Priority.CRITICAL && telemetry.timestamp - previousAt >= 10000;
  if (previous === value && !isHeartbeatDue) return false;
  lastQueuedValues.set(telemetry.type, value);
  lastQueuedAt.set(telemetry.type, telemetry.timestamp);
  return true;
}

function applyDeliveredPacket(packet: TransmissionPacket) {
  const commStore = useCommunicationStore.getState();
  const simStore = useSimulationStore.getState();

  if (packet.kind === 'command' && packet.commandId) {
    commStore.updateCommandStatus(packet.commandId, CommandStatus.RECEIVED);
    simStore.addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ command received at station', source: 'station' });
    return;
  }

  if (packet.kind === 'acknowledgement' && packet.commandAcknowledgement) {
    const { commandId, decision } = packet.commandAcknowledgement;
    commStore.acknowledgeCommand(commandId, decision);
    simStore.addAuditEvent({ id: generateId(), timestamp: Date.now(), event: `HQ received ${decision} command acknowledgement`, details: `Command ${commandId}`, source: 'communication' });
    return;
  }

  if (packet.kind === 'brief') {
    commStore.updateBriefStatus(String(packet.telemetry.value), 'sent');
    return;
  }

  const { type, value, timestamp } = packet.telemetry;
  const parts = type.split('.');
  if (parts.length === 2) {
    const [category, key] = parts;
    commStore.updateHQMetric(category, key, value, timestamp);
  } else if (type === 'daysOfAutonomy') {
    commStore.updateHQMetric('daysOfAutonomy', '', value, timestamp);
  }
}

// Main communication tick - called each simulation step
export function tickCommunication() {
  const commStore = useCommunicationStore.getState();
  const { comm } = commStore;
  const profile = getTransportProfile(comm.linkState);

  // Generate telemetry
  const allTelemetry = generateTelemetry();
  
  // Filter by comm mode
  const filtered = filterByMode(allTelemetry, comm.commMode);

  // Queue filtered telemetry as packets
  for (const telemetry of filtered) {
    if (shouldQueueTelemetry(telemetry)) {
      queuePacket({
        id: generateId(),
        kind: 'telemetry',
        direction: 'station-to-hq',
        telemetry,
        status: 'queued',
        createdAt: Date.now(),
      });
    }
  }

  // Process queue and complete only packets whose simulated latency has elapsed.
  commStore.processQueue({
    now: Date.now(),
    latencyMs: profile.latencyMs,
    packetLossRate: profile.packetLossRate,
    random: () => transportRng.next(),
  });

  const delivered = useCommunicationStore.getState().drainDeliveredPackets();
  for (const packet of delivered) {
    applyDeliveredPacket(packet);
  }

  // Commands are retried after a simulated loss until the station receives one.
  const commandState = useCommunicationStore.getState().commands;
  for (const packet of useCommunicationStore.getState().comm.transmissionLog) {
    if (packet.kind !== 'command' || packet.status !== 'dropped' || !packet.commandId || retriedCommandPackets.has(packet.id)) continue;
    const command = commandState.find((item) => item.id === packet.commandId);
    if (command && command.status !== CommandStatus.RECEIVED && command.status !== CommandStatus.APPROVED && command.status !== CommandStatus.VETOED) {
      retriedCommandPackets.add(packet.id);
      queuePacket({ ...packet, id: generateId(), status: 'queued', createdAt: Date.now(), sentAt: undefined, deliveredAt: undefined, deliveryAt: undefined, dropReason: undefined });
    }
  }

  for (const packet of useCommunicationStore.getState().comm.transmissionLog) {
    if (packet.kind !== 'acknowledgement' || packet.status !== 'dropped' || !packet.commandId || retriedAcknowledgementPackets.has(packet.id)) continue;
    const command = commandState.find((item) => item.id === packet.commandId);
    if (command && !command.acknowledgedAt) {
      retriedAcknowledgementPackets.add(packet.id);
      queuePacket({ ...packet, id: generateId(), status: 'queued', createdAt: Date.now(), sentAt: undefined, deliveredAt: undefined, deliveryAt: undefined, dropReason: undefined });
    }
  }

  // Mark command attempts as sent without implying station receipt.
  const currentCommands = useCommunicationStore.getState().commands;
  for (const packet of useCommunicationStore.getState().comm.transmissionLog) {
    if (packet.kind === 'command' && packet.commandId && packet.sentAt) {
      const command = currentCommands.find((item) => item.id === packet.commandId);
      if (command?.status === CommandStatus.PENDING) commStore.updateCommandStatus(packet.commandId, CommandStatus.SENT);
    }
  }

  // Update HQ metric ages
  commStore.updateHQAges(Date.now());
}

// Calculate bytes saved vs full mode
export function calculateBytesSaved(): { saved: number; percentage: number } {
  const { comm } = useCommunicationStore.getState();
  const allTelemetry = generateTelemetry();
  const fullBytes = allTelemetry.reduce((sum, t) => sum + t.byteSize, 0);
  const filtered = filterByMode(allTelemetry, comm.commMode);
  const filteredBytes = filtered.reduce((sum, t) => sum + t.byteSize, 0);
  const saved = fullBytes - filteredBytes;
  const percentage = fullBytes > 0 ? Math.round((saved / fullBytes) * 100) : 0;
  return { saved, percentage };
}
