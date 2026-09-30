import { SeededRandom } from '../utils/seededRandom';
import {
  ScenarioType,
  WeatherCondition,
  EquipmentStatus,
  AlertLevel,
  Priority,
  type Alert,
  type AuditEvent,
  type DecisionRecommendation,
} from '../types';
import { useSimulationStore } from '../store/simulationStore';
import { clamp, generateId, calculateAutonomy } from '../utils/helpers';

const rng = new SeededRandom(42);

function getStore() {
  return useSimulationStore.getState();
}

export function resetSimulationRNG(seed: number = 42) {
  rng.reset(seed);
}

export function tickStation() {
  const store = getStore();
  const { station, scenario, tick } = store;

  // Base drift
  let tempDrift = rng.gaussian(0, 0.3);
  let windDrift = rng.gaussian(0, 0.5);
  let fuelDrain = 0.01 + rng.next() * 0.005;
  let powerLoadDrift = rng.gaussian(0, 0.5);
  let batteryChange = 0;
  
  // Copy current values
  let temp = station.environment.temperature;
  let wind = station.environment.windSpeed;
  let humidity = station.environment.humidity;
  let weather = station.environment.weatherCondition;
  let powerGen = station.energy.powerGeneration;
  let powerLoad = station.energy.powerLoad;
  let battery = station.energy.batteryLevel;
  let fuelPct = station.fuel.fuelPercentage;
  let fuelRate = station.fuel.consumptionRate;

  // === SCENARIO EFFECTS ===
  
  if (scenario.type === ScenarioType.BLIZZARD) {
    const elapsed = scenario.startedAt ? (Date.now() - scenario.startedAt) / 1000 : 0;
    const rampUp = Math.min(elapsed / 30, 1); // Ramp up over 30 seconds
    
    tempDrift -= 0.5 * rampUp;
    windDrift += 1.5 * rampUp;
    powerLoadDrift += 1.0 * rampUp;
    fuelDrain += 0.02 * rampUp;
    weather = elapsed > 5 ? WeatherCondition.BLIZZARD : WeatherCondition.SNOW;
    humidity = clamp(humidity + rng.gaussian(0.5, 0.3) * rampUp, 40, 95);
  }
  
  if (scenario.type === ScenarioType.GENERATOR_FAILURE) {
    const elapsed = scenario.startedAt ? (Date.now() - scenario.startedAt) / 1000 : 0;
    
    if (elapsed > 5) {
      // Generator 2 fails
      const gen2 = station.equipment.find((e) => e.id === 'gen2');
      if (gen2 && gen2.status !== EquipmentStatus.FAILED) {
        store.updateEquipment('gen2', { status: EquipmentStatus.FAILED, load: 0 });
        addAlertIfNeeded('Generator 2 Failure', 'Generator 2 has failed. Power generation reduced.', AlertLevel.RED, 'generator');
        addAudit('Generator 2 failure detected', 'station');
      }
      powerGen = clamp(powerGen - 0.5, 35, 50); // Reduced to ~one generator
    }
    
    if (elapsed > 3 && elapsed <= 5) {
      const gen2 = station.equipment.find((e) => e.id === 'gen2');
      if (gen2 && gen2.status === EquipmentStatus.OPERATIONAL) {
        store.updateEquipment('gen2', { status: EquipmentStatus.WARNING });
        addAlertIfNeeded('Generator 2 Warning', 'Generator 2 showing abnormal readings.', AlertLevel.AMBER, 'generator');
        addAudit('Generator 2 warning detected', 'station');
      }
    }
  }

  if (scenario.type === ScenarioType.COMM_OUTAGE) {
    // Station operates normally, but communication is handled by comm engine
    // Just add slight randomness
    tempDrift += rng.gaussian(0, 0.1);
  }

  // === APPLY DRIFTS ===
  
  temp = clamp(temp + tempDrift, -65, 10);
  wind = clamp(wind + windDrift, 0, 200);
  powerLoad = clamp(powerLoad + powerLoadDrift, 30, 120);
  
  // Fuel consumption
  fuelRate = clamp(fuelRate + rng.gaussian(0, 0.2) + (scenario.type === ScenarioType.BLIZZARD ? 0.3 : 0), 5, 30);
  fuelPct = clamp(fuelPct - fuelDrain, 0, 100);
  
  // Battery: charges if generation > load, discharges otherwise
  const powerBalance = powerGen - powerLoad;
  if (powerBalance > 0) {
    batteryChange = Math.min(powerBalance * 0.05, 0.2);
  } else {
    batteryChange = powerBalance * 0.1; // Discharge faster
  }
  battery = clamp(battery + batteryChange, 0, 100);

  // Calculate autonomy
  const daysOfAutonomy = calculateAutonomy(
    fuelPct, fuelRate, station.supplies.foodDays, station.supplies.medicineDays,
    battery, powerGen, powerLoad
  );

  // === UPDATE STORE ===
  
  store.setEnvironment({ temperature: Math.round(temp * 10) / 10, windSpeed: Math.round(wind * 10) / 10, humidity: Math.round(humidity), weatherCondition: weather });
  store.setEnergy({ powerGeneration: Math.round(powerGen * 10) / 10, powerLoad: Math.round(powerLoad * 10) / 10, batteryLevel: Math.round(battery * 10) / 10 });
  store.setFuel({ fuelPercentage: Math.round(fuelPct * 100) / 100, consumptionRate: Math.round(fuelRate * 10) / 10 });
  store.updateStation({ daysOfAutonomy });

  // === ADD HISTORY POINTS ===
  
  const now = Date.now();
  store.addHistoryPoint('temperature', { timestamp: now, value: temp });
  store.addHistoryPoint('power', { timestamp: now, value: powerLoad });
  store.addHistoryPoint('fuel', { timestamp: now, value: fuelPct });
  store.addHistoryPoint('battery', { timestamp: now, value: battery });
  store.addHistoryPoint('wind', { timestamp: now, value: wind });

  // === CHECK ALERTS ===
  
  if (wind > 80) {
    addAlertIfNeeded('High Wind Warning', `Wind speed: ${Math.round(wind)} km/h`, AlertLevel.RED, 'environment');
  } else if (wind > 50) {
    addAlertIfNeeded('Elevated Wind', `Wind speed: ${Math.round(wind)} km/h`, AlertLevel.AMBER, 'environment');
  }
  
  if (battery < 20) {
    addAlertIfNeeded('Low Battery', `Battery level: ${Math.round(battery)}%`, AlertLevel.RED, 'energy');
  } else if (battery < 40) {
    addAlertIfNeeded('Battery Warning', `Battery level: ${Math.round(battery)}%`, AlertLevel.AMBER, 'energy');
  }
  
  if (powerLoad > powerGen * 1.1) {
    addAlertIfNeeded('Power Deficit', `Load ${Math.round(powerLoad)}kW exceeds generation ${Math.round(powerGen)}kW`, AlertLevel.RED, 'energy');
  }
  
  if (fuelPct < 20) {
    addAlertIfNeeded('Low Fuel', `Fuel level: ${fuelPct.toFixed(1)}%`, AlertLevel.RED, 'fuel');
  } else if (fuelPct < 40) {
    addAlertIfNeeded('Fuel Warning', `Fuel level: ${fuelPct.toFixed(1)}%`, AlertLevel.AMBER, 'fuel');
  }
  
  if (daysOfAutonomy < 14) {
    addAlertIfNeeded('Critical Autonomy', `Only ${daysOfAutonomy} days of autonomy remaining`, AlertLevel.RED, 'autonomy');
  } else if (daysOfAutonomy < 30) {
    addAlertIfNeeded('Low Autonomy', `${daysOfAutonomy} days of autonomy remaining`, AlertLevel.AMBER, 'autonomy');
  }

  // === DECISION SUPPORT ===
  
  if (scenario.type === ScenarioType.GENERATOR_FAILURE) {
    const elapsed = scenario.startedAt ? (Date.now() - scenario.startedAt) / 1000 : 0;
    if (elapsed > 8) {
      generateRecommendation(daysOfAutonomy);
    }
  }
  
  if (scenario.type === ScenarioType.BLIZZARD) {
    const elapsed = scenario.startedAt ? (Date.now() - scenario.startedAt) / 1000 : 0;
    if (elapsed > 15 && powerLoad > powerGen * 0.9) {
      generateRecommendation(daysOfAutonomy);
    }
  }

  store.incrementTick();
}

function generateRecommendation(currentAutonomy: number) {
  const store = getStore();
  const projectedAfter = Math.min(currentAutonomy + 15, currentAutonomy * 1.3);
  
  store.addRecommendation({
    id: generateId(),
    situation: 'Power reserve declining due to reduced generation capacity.',
    impact: 'Battery draining. Projected autonomy decreasing.',
    recommendedAction: 'Reduce non-essential load to extend station autonomy.',
    confidence: store.scenario.type === ScenarioType.GENERATOR_FAILURE ? 85 : 72,
    projectedAutonomyBefore: currentAutonomy,
    projectedAutonomyAfter: Math.floor(projectedAfter),
    relatedAlertIds: store.alerts.filter((a) => a.level === AlertLevel.RED).map((a) => a.id),
    timestamp: Date.now(),
  });
}

function addAlertIfNeeded(title: string, message: string, level: AlertLevel, source: string) {
  const store = getStore();
  store.addAlert({
    id: generateId(),
    level,
    title,
    message,
    timestamp: Date.now(),
    acknowledged: false,
    source,
  });
}

function addAudit(event: string, source: 'station' | 'hq' | 'system' | 'communication') {
  const store = getStore();
  store.addAuditEvent({
    id: generateId(),
    timestamp: Date.now(),
    event,
    source,
  });
}

// Apply command effect: reduce non-essential load
export function applyLoadReduction() {
  const store = getStore();
  const { station } = store;
  
  // Reduce power load by ~20%
  store.setEnergy({ powerLoad: Math.round(station.energy.powerLoad * 0.8 * 10) / 10 });
  
  // Reduce fuel consumption
  store.setFuel({ consumptionRate: Math.round(station.fuel.consumptionRate * 0.85 * 10) / 10 });
  
  // Update module statuses
  store.updateModuleStatus('storage', EquipmentStatus.OFFLINE);
  store.updateEquipment('snowmelter', { status: EquipmentStatus.OFFLINE, load: 0 });
  
  addAudit('Non-essential load reduction applied', 'station');
  addAlertIfNeeded('Load Reduced', 'Non-essential systems powered down per HQ command.', AlertLevel.GREEN, 'system');
}
