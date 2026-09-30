import { Freshness, AlertLevel, Priority, type HQMetric } from '../types';

// Format timestamp to HH:MM:SS
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

// Format timestamp to HH:MM
export function formatTimeShort(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

// Format age in ms to human readable
export function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h old`;
}

// Calculate freshness from age in ms
export function calculateFreshness(ageMs: number): Freshness {
  if (ageMs < 2 * 60 * 1000) return Freshness.FRESH;
  if (ageMs < 5 * 60 * 1000) return Freshness.AGING;
  return Freshness.STALE;
}

// Get CSS color class for freshness
export function freshnessColor(freshness: Freshness): string {
  switch (freshness) {
    case Freshness.FRESH: return 'text-green-400';
    case Freshness.AGING: return 'text-yellow-400';
    case Freshness.STALE: return 'text-red-400';
  }
}

// Get CSS color class for alert level
export function alertLevelColor(level: AlertLevel): string {
  switch (level) {
    case AlertLevel.GREEN: return 'text-green-400';
    case AlertLevel.AMBER: return 'text-amber-400';
    case AlertLevel.RED: return 'text-red-400';
  }
}

// Get CSS bg class for alert level
export function alertLevelBg(level: AlertLevel): string {
  switch (level) {
    case AlertLevel.GREEN: return 'bg-green-500/20 border-green-500/40';
    case AlertLevel.AMBER: return 'bg-amber-500/20 border-amber-500/40';
    case AlertLevel.RED: return 'bg-red-500/20 border-red-500/40';
  }
}

// Get CSS color for priority
export function priorityColor(priority: Priority): string {
  switch (priority) {
    case Priority.CRITICAL: return 'text-red-400';
    case Priority.HIGH: return 'text-orange-400';
    case Priority.MEDIUM: return 'text-yellow-400';
    case Priority.LOW: return 'text-slate-400';
  }
}

// Clamp a number between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Generate a simple UUID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Estimate byte size of a telemetry point
export function estimateByteSize(data: unknown): number {
  return new Blob([JSON.stringify(data)]).size;
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Calculate days of autonomy from resources
export function calculateAutonomy(
  fuelPercentage: number,
  fuelConsumptionRate: number,
  foodDays: number,
  medicineDays: number,
  batteryLevel: number,
  powerGeneration: number,
  powerLoad: number
): number {
  // Fuel days: assume 10000L total capacity
  const fuelLiters = (fuelPercentage / 100) * 10000;
  const fuelDays = fuelConsumptionRate > 0 ? fuelLiters / (fuelConsumptionRate * 24) : 999;
  
  // Power days: if generation < load, battery will drain
  let powerDays = 999;
  if (powerLoad > powerGeneration) {
    const deficit = powerLoad - powerGeneration; // kW
    // Battery capacity ~500 kWh, batteryLevel is percentage
    const batteryKwh = (batteryLevel / 100) * 500;
    powerDays = batteryKwh / (deficit * 24);
  }

  return Math.max(0, Math.floor(Math.min(fuelDays, foodDays, medicineDays, powerDays)));
}

// Create an HQ metric
export function createHQMetric(value: number | string, timestamp: number): HQMetric {
  return {
    value,
    lastUpdated: timestamp,
    age: 0,
    freshness: Freshness.FRESH,
  };
}

// Update HQ metric ages
export function updateMetricAge(metric: HQMetric, currentTime: number): HQMetric {
  const age = currentTime - metric.lastUpdated;
  return {
    ...metric,
    age,
    freshness: calculateFreshness(age),
  };
}
