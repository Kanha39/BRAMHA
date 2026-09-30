import {
  type TelemetryPoint,
  type TransmissionPacket,
  Priority,
  CommMode,
  LinkState,
} from '../types';
import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { generateId } from '../utils/helpers';

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

// Main communication tick - called each simulation step
export function tickCommunication() {
  const commStore = useCommunicationStore.getState();
  const { comm } = commStore;

  // Generate telemetry
  const allTelemetry = generateTelemetry();
  
  // Filter by comm mode
  const filtered = filterByMode(allTelemetry, comm.commMode);

  // Queue filtered telemetry as packets
  for (const telemetry of filtered) {
    const packet: TransmissionPacket = {
      id: generateId(),
      telemetry,
      status: 'queued',
      createdAt: Date.now(),
    };
    commStore.addToQueue(packet);
  }

  // Process queue (transmit what we can)
  commStore.processQueue();

  // Update HQ state from successfully sent packets
  const { comm: updatedComm } = useCommunicationStore.getState();
  const recentlySent = updatedComm.transmissionLog.filter(
    (p) => p.status === 'sent' && p.sentAt && Date.now() - p.sentAt < 2000
  );

  for (const packet of recentlySent) {
    const { type, value, timestamp } = packet.telemetry;
    
    // Map telemetry type to HQ state category and key
    const parts = type.split('.');
    if (parts.length === 2) {
      const [category, key] = parts;
      commStore.updateHQMetric(category, key, value, timestamp);
    } else if (type === 'daysOfAutonomy') {
      commStore.updateHQMetric('daysOfAutonomy', '', value, timestamp);
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
