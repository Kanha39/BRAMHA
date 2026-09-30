import { create } from 'zustand';
import {
  type StationState,
  type Environment,
  type EnergyState,
  type FuelState,
  type Equipment,
  type SupplyState,
  type StationModule,
  type Scenario,
  type Alert,
  type AuditEvent,
  type DecisionRecommendation,
  type TimeSeriesPoint,
  type Requisition,
  type InventoryItem,
  ScenarioType,
  WeatherCondition,
  EquipmentStatus,
  AlertLevel,
} from '../types';

interface SimulationStore {
  // Station state
  station: StationState;
  
  // Scenario
  scenario: Scenario;
  
  // Alerts
  alerts: Alert[];
  
  // Audit log
  auditLog: AuditEvent[];
  
  // Decision support
  recommendations: DecisionRecommendation[];
  
  // Time series history (for charts)
  history: {
    temperature: TimeSeriesPoint[];
    power: TimeSeriesPoint[];
    fuel: TimeSeriesPoint[];
    battery: TimeSeriesPoint[];
    wind: TimeSeriesPoint[];
  };
  
  // Inventory
  inventory: InventoryItem[];
  requisitions: Requisition[];
  
  // Simulation tick counter
  tick: number;
  
  // Simulation running
  running: boolean;
  
  // Actions
  updateStation: (state: Partial<StationState>) => void;
  setEnvironment: (env: Partial<Environment>) => void;
  setEnergy: (energy: Partial<EnergyState>) => void;
  setFuel: (fuel: Partial<FuelState>) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => void;
  setSupplies: (supplies: Partial<SupplyState>) => void;
  setScenario: (scenario: Scenario) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  addAuditEvent: (event: AuditEvent) => void;
  addRecommendation: (rec: DecisionRecommendation) => void;
  clearRecommendations: () => void;
  addHistoryPoint: (metric: keyof SimulationStore['history'], point: TimeSeriesPoint) => void;
  setRunning: (running: boolean) => void;
  incrementTick: () => void;
  resetSimulation: () => void;
  updateModuleStatus: (id: string, status: EquipmentStatus) => void;
  addRequisition: (req: Requisition) => void;
  updateRequisition: (id: string, status: Requisition['status']) => void;
}

const MAX_HISTORY_POINTS = 120; // 2 minutes of data at 1s intervals
const MAX_ALERTS = 50;
const MAX_AUDIT = 100;

const initialModules: StationModule[] = [
  { id: 'control', name: 'Control Room', status: EquipmentStatus.OPERATIONAL, temperature: 22, powerDraw: 5, occupancy: 3 },
  { id: 'living', name: 'Living Quarters', status: EquipmentStatus.OPERATIONAL, temperature: 21, powerDraw: 8, occupancy: 12 },
  { id: 'medical', name: 'Medical Bay', status: EquipmentStatus.OPERATIONAL, temperature: 23, powerDraw: 4, occupancy: 1 },
  { id: 'generator', name: 'Generator Room', status: EquipmentStatus.OPERATIONAL, temperature: 35, powerDraw: 2, occupancy: 0 },
  { id: 'fuel', name: 'Fuel Storage', status: EquipmentStatus.OPERATIONAL, temperature: -10, powerDraw: 1 },
  { id: 'comms', name: 'Communications', status: EquipmentStatus.OPERATIONAL, temperature: 24, powerDraw: 6, occupancy: 2 },
  { id: 'hvac', name: 'HVAC System', status: EquipmentStatus.OPERATIONAL, temperature: 18, powerDraw: 15 },
  { id: 'storage', name: 'Storage', status: EquipmentStatus.OPERATIONAL, temperature: -5, powerDraw: 1 },
];

const initialEquipment: Equipment[] = [
  { id: 'gen1', name: 'Generator 1', status: EquipmentStatus.OPERATIONAL, load: 45 },
  { id: 'gen2', name: 'Generator 2', status: EquipmentStatus.OPERATIONAL, load: 35 },
  { id: 'hvac', name: 'HVAC System', status: EquipmentStatus.OPERATIONAL, load: 15 },
  { id: 'snowmelter', name: 'Snow Melter', status: EquipmentStatus.OPERATIONAL, load: 8 },
];

const initialInventory: InventoryItem[] = [
  { id: 'food1', name: 'Ration Packs', quantity: 500, unit: 'packs', category: 'food' },
  { id: 'food2', name: 'Freeze-dried Meals', quantity: 300, unit: 'meals', category: 'food' },
  { id: 'med1', name: 'First Aid Kits', quantity: 20, unit: 'kits', category: 'medicine' },
  { id: 'med2', name: 'Emergency Medicine', quantity: 50, unit: 'units', category: 'medicine' },
  { id: 'fuel1', name: 'Diesel Fuel', quantity: 8500, unit: 'liters', category: 'fuel' },
  { id: 'spare1', name: 'Generator Parts', quantity: 5, unit: 'sets', category: 'spare_parts' },
  { id: 'spare2', name: 'HVAC Filters', quantity: 12, unit: 'units', category: 'spare_parts' },
];

function createInitialStation(): StationState {
  return {
    timestamp: Date.now(),
    environment: {
      temperature: -25,
      windSpeed: 15,
      humidity: 45,
      weatherCondition: WeatherCondition.CLEAR,
    },
    energy: {
      powerGeneration: 80,
      powerLoad: 65,
      batteryLevel: 92,
    },
    fuel: {
      fuelPercentage: 85,
      consumptionRate: 12,
    },
    equipment: initialEquipment,
    supplies: {
      foodDays: 120,
      medicineDays: 180,
    },
    modules: initialModules,
    daysOfAutonomy: 85,
  };
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  station: createInitialStation(),
  scenario: { type: ScenarioType.NORMAL, name: 'Normal Operations', description: 'Station operating under normal conditions.', active: true },
  alerts: [],
  auditLog: [],
  recommendations: [],
  history: { temperature: [], power: [], fuel: [], battery: [], wind: [] },
  inventory: initialInventory,
  requisitions: [],
  tick: 0,
  running: false,

  updateStation: (updates) => set((s) => ({ station: { ...s.station, ...updates, timestamp: Date.now() } })),
  
  setEnvironment: (env) => set((s) => ({
    station: { ...s.station, environment: { ...s.station.environment, ...env }, timestamp: Date.now() },
  })),
  
  setEnergy: (energy) => set((s) => ({
    station: { ...s.station, energy: { ...s.station.energy, ...energy }, timestamp: Date.now() },
  })),
  
  setFuel: (fuel) => set((s) => ({
    station: { ...s.station, fuel: { ...s.station.fuel, ...fuel }, timestamp: Date.now() },
  })),
  
  updateEquipment: (id, updates) => set((s) => ({
    station: {
      ...s.station,
      equipment: s.station.equipment.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      timestamp: Date.now(),
    },
  })),
  
  setSupplies: (supplies) => set((s) => ({
    station: { ...s.station, supplies: { ...s.station.supplies, ...supplies }, timestamp: Date.now() },
  })),
  
  setScenario: (scenario) => set({ scenario }),
  
  addAlert: (alert) => set((s) => {
    // Avoid duplicate alerts with same title in last 30 seconds
    const recent = s.alerts.find((a) => a.title === alert.title && Date.now() - a.timestamp < 30000);
    if (recent) return {};
    const alerts = [alert, ...s.alerts].slice(0, MAX_ALERTS);
    return { alerts };
  }),
  
  acknowledgeAlert: (id) => set((s) => ({
    alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
  })),
  
  addAuditEvent: (event) => set((s) => ({
    auditLog: [event, ...s.auditLog].slice(0, MAX_AUDIT),
  })),
  
  addRecommendation: (rec) => set((s) => {
    // Avoid duplicate recommendations
    const exists = s.recommendations.find((r) => r.situation === rec.situation && Date.now() - r.timestamp < 60000);
    if (exists) return {};
    return { recommendations: [rec, ...s.recommendations].slice(0, 10) };
  }),
  
  clearRecommendations: () => set({ recommendations: [] }),
  
  addHistoryPoint: (metric, point) => set((s) => ({
    history: {
      ...s.history,
      [metric]: [...s.history[metric], point].slice(-MAX_HISTORY_POINTS),
    },
  })),
  
  setRunning: (running) => set({ running }),
  incrementTick: () => set((s) => ({ tick: s.tick + 1 })),
  
  resetSimulation: () => set({
    station: createInitialStation(),
    scenario: { type: ScenarioType.NORMAL, name: 'Normal Operations', description: 'Station operating under normal conditions.', active: true },
    alerts: [],
    auditLog: [],
    recommendations: [],
    history: { temperature: [], power: [], fuel: [], battery: [], wind: [] },
    requisitions: [],
    tick: 0,
    running: false,
  }),
  
  updateModuleStatus: (id, status) => set((s) => ({
    station: {
      ...s.station,
      modules: s.station.modules.map((m) => (m.id === id ? { ...m, status } : m)),
    },
  })),
  
  addRequisition: (req) => set((s) => ({ requisitions: [...s.requisitions, req] })),
  updateRequisition: (id, status) => set((s) => ({
    requisitions: s.requisitions.map((r) => (r.id === id ? { ...r, status, updatedAt: Date.now() } : r)),
  })),
}));
