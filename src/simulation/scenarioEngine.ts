import { ScenarioType, LinkState, EquipmentStatus, WeatherCondition } from '../types';
import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { generateId } from '../utils/helpers';
import { resetSimulationRNG } from './stationSimulator';

export function activateScenario(type: ScenarioType) {
  const simStore = useSimulationStore.getState();
  const commStore = useCommunicationStore.getState();
  const now = Date.now();

  // Reset RNG for repeatable behavior
  resetSimulationRNG(42 + Object.values(ScenarioType).indexOf(type));

  const scenarios: Record<ScenarioType, { name: string; description: string }> = {
    [ScenarioType.NORMAL]: { name: 'Normal Operations', description: 'Station operating under normal conditions.' },
    [ScenarioType.BLIZZARD]: { name: 'Blizzard', description: 'Severe blizzard conditions approaching the station.' },
    [ScenarioType.GENERATOR_FAILURE]: { name: 'Generator Failure', description: 'Generator 2 experiencing critical failure.' },
    [ScenarioType.COMM_OUTAGE]: { name: 'Communication Outage', description: 'Communication link lost with headquarters.' },
  };

  simStore.setScenario({
    type,
    ...scenarios[type],
    startedAt: now,
    active: true,
  });

  simStore.addAuditEvent({
    id: generateId(),
    timestamp: now,
    event: `Scenario activated: ${scenarios[type].name}`,
    source: 'system',
  });

  // Apply immediate scenario effects
  switch (type) {
    case ScenarioType.NORMAL:
      // Reset everything to normal
      simStore.setEnvironment({ temperature: -25, windSpeed: 15, humidity: 45, weatherCondition: WeatherCondition.CLEAR });
      simStore.setEnergy({ powerGeneration: 80, powerLoad: 65, batteryLevel: 92 });
      simStore.setFuel({ fuelPercentage: 85, consumptionRate: 12 });
      simStore.updateEquipment('gen1', { status: EquipmentStatus.OPERATIONAL, load: 45 });
      simStore.updateEquipment('gen2', { status: EquipmentStatus.OPERATIONAL, load: 35 });
      simStore.updateEquipment('hvac', { status: EquipmentStatus.OPERATIONAL, load: 15 });
      simStore.updateEquipment('snowmelter', { status: EquipmentStatus.OPERATIONAL, load: 8 });
      commStore.setLinkState(LinkState.ONLINE);
      break;
      
    case ScenarioType.BLIZZARD:
      // Blizzard effects ramp up over time in tickStation
      simStore.setEnvironment({ weatherCondition: WeatherCondition.SNOW });
      break;
      
    case ScenarioType.GENERATOR_FAILURE:
      // Generator warning/failure happens progressively in tickStation
      break;
      
    case ScenarioType.COMM_OUTAGE:
      // Communication goes offline
      commStore.setLinkState(LinkState.OFFLINE);
      simStore.addAuditEvent({
        id: generateId(),
        timestamp: now,
        event: 'Communication link lost',
        source: 'communication',
      });
      break;
  }
}

export function resetScenario() {
  const simStore = useSimulationStore.getState();
  const commStore = useCommunicationStore.getState();
  
  simStore.resetSimulation();
  commStore.resetComm();
  resetSimulationRNG(42);
}
