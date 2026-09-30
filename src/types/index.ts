// === ENUMS ===

export enum LinkState {
  ONLINE = 'ONLINE',
  DEGRADED = 'DEGRADED',
  OFFLINE = 'OFFLINE',
}

export enum CommMode {
  FULL = 'FULL',
  COMPACT = 'COMPACT',
  ALERTS_ONLY = 'ALERTS_ONLY',
  SOS_ONLY = 'SOS_ONLY',
}

export enum AlertLevel {
  GREEN = 'GREEN',
  AMBER = 'AMBER',
  RED = 'RED',
}

export enum Priority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum CommandStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  APPROVED = 'APPROVED',
  VETOED = 'VETOED',
  EXPIRED = 'EXPIRED',
}

export enum ScenarioType {
  NORMAL = 'NORMAL',
  BLIZZARD = 'BLIZZARD',
  GENERATOR_FAILURE = 'GENERATOR_FAILURE',
  COMM_OUTAGE = 'COMM_OUTAGE',
}

export enum WeatherCondition {
  CLEAR = 'CLEAR',
  CLOUDY = 'CLOUDY',
  SNOW = 'SNOW',
  BLIZZARD = 'BLIZZARD',
}

export enum EquipmentStatus {
  OPERATIONAL = 'OPERATIONAL',
  WARNING = 'WARNING',
  FAILED = 'FAILED',
  OFFLINE = 'OFFLINE',
}

export enum RequisitionStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
}

export enum Freshness {
  FRESH = 'FRESH',
  AGING = 'AGING',
  STALE = 'STALE',
}

export enum UserRole {
  HQ_COMMAND = 'HQ_COMMAND',
  STATION_LEADER = 'STATION_LEADER',
}

// === DATA TYPES ===

export interface Environment {
  temperature: number; // Celsius
  windSpeed: number; // km/h
  humidity: number; // %
  weatherCondition: WeatherCondition;
}

export interface EnergyState {
  powerGeneration: number; // kW
  powerLoad: number; // kW
  batteryLevel: number; // %
}

export interface FuelState {
  fuelPercentage: number; // %
  consumptionRate: number; // liters/hour
}

export interface Equipment {
  id: string;
  name: string;
  status: EquipmentStatus;
  load?: number; // kW
}

export interface SupplyState {
  foodDays: number;
  medicineDays: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'food' | 'medicine' | 'fuel' | 'spare_parts';
}

export interface Requisition {
  id: string;
  itemName: string;
  quantity: number;
  status: RequisitionStatus;
  createdAt: number;
  updatedAt: number;
}

// === TELEMETRY ===

export interface TelemetryPoint {
  type: string;
  value: number | string;
  timestamp: number;
  priority: Priority;
  byteSize: number;
}

export interface HQMetric {
  value: number | string;
  lastUpdated: number;
  age: number; // ms
  freshness: Freshness;
}

// === STATION STATE ===

export interface StationModule {
  id: string;
  name: string;
  status: EquipmentStatus;
  temperature?: number;
  powerDraw?: number;
  occupancy?: number;
  details?: Record<string, string | number>;
}

export interface StationState {
  timestamp: number;
  environment: Environment;
  energy: EnergyState;
  fuel: FuelState;
  equipment: Equipment[];
  supplies: SupplyState;
  modules: StationModule[];
  daysOfAutonomy: number;
}

// === HQ STATE ===

export interface HQState {
  lastSyncTimestamp: number;
  environment: Record<string, HQMetric>;
  energy: Record<string, HQMetric>;
  fuel: Record<string, HQMetric>;
  equipment: Record<string, HQMetric>;
  supplies: Record<string, HQMetric>;
  daysOfAutonomy: HQMetric;
  overallStaleness: number; // average age in ms
  batteryHistory: HQBatteryObservation[];
}

/** A battery observation that was delivered to HQ, never a station-side sample. */
export interface HQBatteryObservation {
  timestamp: number;
  value: number;
}

// === COMMUNICATION ===

export interface TransmissionPacket {
  id: string;
  telemetry: TelemetryPoint;
  kind?: 'telemetry' | 'command' | 'acknowledgement' | 'brief';
  direction?: 'station-to-hq' | 'hq-to-station';
  commandId?: string;
  commandAcknowledgement?: CommandAcknowledgement;
  status: 'queued' | 'transmitting' | 'sent' | 'dropped';
  createdAt: number;
  sentAt?: number;
  deliveredAt?: number;
  deliveryAt?: number;
  dropReason?: string;
}

export interface CommunicationState {
  linkState: LinkState;
  commMode: CommMode;
  bandwidth: number; // bytes/sec
  maxBandwidth: number;
  dailyByteBudget: number;
  bytesUsedToday: number; // transmission attempts counted against the simulated daily budget
  bytesAttempted: number;
  bytesDelivered: number;
  bytesQueued: number;
  bytesDropped: number;
  queuePressureDrops: number;
  queueCompactions: number;
  queue: TransmissionPacket[];
  inFlight: TransmissionPacket[];
  deliveredPackets: TransmissionPacket[];
  transmissionLog: TransmissionPacket[];
  latencyMs: number;
  packetLossRate: number;
  syncState: 'SYNCED' | 'SYNCING' | 'STALE' | 'BLOCKED';
}

// === ALERTS ===

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  source: string;
}

// === COMMANDS ===

export interface Command {
  id: string;
  type: string;
  description: string;
  priority: Priority;
  status: CommandStatus;
  createdAt: number;
  expiresAt: number;
  sentAt?: number;
  receivedAt?: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  acknowledgedDecision?: CommandDecision;
  resolvedBy?: string;
}

export type CommandDecision = 'APPROVED' | 'VETOED';

export interface CommandAcknowledgement {
  commandId: string;
  decision: CommandDecision;
  timestamp: number;
}

// === DECISION SUPPORT ===

export interface DecisionRecommendation {
  id: string;
  situation: string;
  impact: string;
  recommendedAction: string;
  confidence: number; // 0-100
  projectedAutonomyBefore: number;
  projectedAutonomyAfter: number;
  relatedAlertIds: string[];
  timestamp: number;
}

// === FORECAST ===

export interface ForecastPoint {
  timestamp: number;
  actual?: number;
  forecast: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
}

export interface Forecast {
  metric: string;
  generatedAt: number;
  horizonMinutes: number;
  dataAgeSeconds: number;
  points: ForecastPoint[];
  overallConfidence: number;
}

// === SCENARIO ===

export interface Scenario {
  type: ScenarioType;
  name: string;
  description: string;
  startedAt?: number;
  active: boolean;
}

// === AUDIT ===

export interface AuditEvent {
  id: string;
  timestamp: number;
  event: string;
  details?: string;
  source: 'station' | 'hq' | 'system' | 'communication';
}

// === STATION BRIEF ===

export interface StationBrief {
  id: string;
  priority: Priority;
  issue: string;
  impact: string;
  recommendedAction: string;
  createdAt: number;
  byteSize: number;
  transmissionStatus: 'draft' | 'queued' | 'sent';
}

// === DEMO ===

export interface DemoState {
  running: boolean;
  step: number;
  totalSteps: number;
  currentPhase: string;
  error?: string;
  startedAt?: number;
  paused: boolean;
}

// === TIME SERIES for charts ===

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}
