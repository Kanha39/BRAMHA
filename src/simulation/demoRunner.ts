import { ScenarioType, LinkState, CommMode, CommandStatus, Priority } from '../types';
import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { useUIStore } from '../store/uiStore';
import { activateScenario, resetScenario } from './scenarioEngine';
import { applyLoadReduction } from './stationSimulator';
import { generateId } from '../utils/helpers';
import { enqueueCommand, enqueueCommandAcknowledgement, resetCommunicationEngine, requestTelemetryRefresh, tickCommunication } from '../communication/commEngine';
import { registerDemoCancellation } from './demoLifecycle';

interface DemoStep {
  delay: number;
  phase: string;
  action: () => void;
}

const TOTAL_STEPS = 16;

const TIMED_STEPS: DemoStep[] = [
  {
    delay: 0,
    phase: '1/16 — Normal Operation',
    action: () => {
      activateScenario(ScenarioType.NORMAL);
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Demo started — Normal operations', source: 'system' });
    },
  },
  {
    delay: 8000,
    phase: '2/16 — Blizzard Approaching',
    action: () => activateScenario(ScenarioType.BLIZZARD),
  },
  {
    delay: 6000,
    phase: '3/16 — Wind Increasing',
    action: () => useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Wind speed increasing rapidly', source: 'station' }),
  },
  {
    delay: 6000,
    phase: '4/16 — Power Demand Rising',
    action: () => useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Power demand rising due to HVAC load', source: 'station' }),
  },
  {
    delay: 5000,
    phase: '5/16 — Communication Degraded',
    action: () => {
      useCommunicationStore.getState().setLinkState(LinkState.DEGRADED);
      useCommunicationStore.getState().setCommMode(CommMode.COMPACT);
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Communication link degraded', source: 'communication' });
    },
  },
  {
    delay: 5000,
    phase: '6/16 — Generator Warning',
    action: () => activateScenario(ScenarioType.GENERATOR_FAILURE),
  },
  {
    delay: 8000,
    phase: '7/16 — Communication Offline',
    action: () => {
      useCommunicationStore.getState().setLinkState(LinkState.OFFLINE);
      useCommunicationStore.getState().setCommMode(CommMode.SOS_ONLY);
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Communication link lost', source: 'communication' });
    },
  },
  {
    delay: 8000,
    phase: '8/16 — HQ Data Becoming Stale',
    action: () => useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ data staleness increasing', source: 'system' }),
  },
  {
    delay: 5000,
    phase: '9/16 — Critical Info Prioritized',
    action: () => {
      useCommunicationStore.getState().setCommMode(CommMode.SOS_ONLY);
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Switching to SOS-only mode', source: 'communication' });
    },
  },
  {
    delay: 5000,
    phase: '10/16 — Partial Link Restored',
    action: () => {
      useCommunicationStore.getState().setLinkState(LinkState.DEGRADED);
      useCommunicationStore.getState().setCommMode(CommMode.ALERTS_ONLY);
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Partial communication restored', source: 'communication' });
    },
  },
  {
    delay: 5000,
    phase: '11/16 — HQ Receives Critical Alert',
    action: () => useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ received critical generator alert', source: 'communication' }),
  },
  {
    delay: 4000,
    phase: '12/16 — HQ Issues Command',
    action: () => undefined,
  },
];

let demoTimeouts: ReturnType<typeof setTimeout>[] = [];
let demoRunId = 0;

function clearDemoTimers() {
  demoTimeouts.forEach(clearTimeout);
  demoTimeouts = [];
}

function isDemoActive(runId: number) {
  return runId === demoRunId && useUIStore.getState().demo.running;
}

function schedule(callback: () => void, delay: number, runId: number) {
  const timeout = setTimeout(() => {
    demoTimeouts = demoTimeouts.filter((item) => item !== timeout);
    if (isDemoActive(runId)) callback();
  }, delay);
  demoTimeouts.push(timeout);
}

function failDemo(runId: number, message: string) {
  if (!isDemoActive(runId)) return;
  clearDemoTimers();
  useUIStore.getState().setDemo({ running: false, error: message, currentPhase: 'Demo failed' });
  useSimulationStore.getState().setRunning(false);
}

function waitForState(
  runId: number,
  waitingPhase: string,
  predicate: () => boolean,
  timeoutMs: number,
  timeoutMessage: string,
  onComplete: () => void,
) {
  const startedAt = Date.now();
  useUIStore.getState().setDemo({ currentPhase: waitingPhase });

  const check = () => {
    if (!isDemoActive(runId)) return;
    if (predicate()) {
      onComplete();
      return;
    }
    if (Date.now() - startedAt >= timeoutMs) {
      failDemo(runId, timeoutMessage);
      return;
    }
    schedule(check, 500, runId);
  };

  check();
}

function beginCommandFlow(runId: number) {
  const command = {
    id: generateId(),
    type: 'REDUCE_NONESSENTIAL_LOAD',
    description: 'Reduce non-essential load to extend station autonomy',
    priority: Priority.HIGH,
    status: CommandStatus.PENDING,
    createdAt: Date.now(),
    expiresAt: Date.now() + 300000,
  };
  useCommunicationStore.getState().createCommand(command);
  enqueueCommand(command);
  useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ command created: Reduce non-essential load', source: 'hq' });
  useUIStore.getState().setDemo({ step: 12, currentPhase: '12/16 — HQ Issues Command' });

  waitForState(
    runId,
    '13/16 — Waiting for command delivery',
    () => useCommunicationStore.getState().commands.find((item) => item.id === command.id)?.status === CommandStatus.RECEIVED,
    20000,
    'Demo waiting for command delivery',
    () => {
      useUIStore.getState().setDemo({ step: 13, currentPhase: '13/16 — Station Receives Command' });
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Station received HQ command', source: 'station' });
      const loadBeforeApproval = useSimulationStore.getState().station.energy.powerLoad;

      schedule(() => {
        if (useCommunicationStore.getState().commands.find((item) => item.id === command.id)?.status !== CommandStatus.RECEIVED) {
          failDemo(runId, 'Demo waiting for station approval');
          return;
        }
        useCommunicationStore.getState().updateCommandStatus(command.id, CommandStatus.APPROVED);
        applyLoadReduction();
        enqueueCommandAcknowledgement(command.id, 'APPROVED');
        useUIStore.getState().setDemo({ step: 14, currentPhase: '14/16 — Station Leader Approved' });
        useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Station leader approved load reduction', source: 'station' });

        waitForState(
          runId,
          '14/16 — Waiting for station state change',
          () => useSimulationStore.getState().station.energy.powerLoad < loadBeforeApproval,
          5000,
          'Demo waiting for station state change',
          () => waitForState(
            runId,
            '15/16 — Waiting for HQ acknowledgement',
            () => Boolean(useCommunicationStore.getState().commands.find((item) => item.id === command.id)?.acknowledgedAt),
            20000,
            'Demo waiting for command acknowledgement',
            () => {
              const reconnectAt = Date.now();
              useCommunicationStore.getState().setLinkState(LinkState.ONLINE);
              useCommunicationStore.getState().setCommMode(CommMode.FULL);
              // Freeze the scenario snapshot while the last queued telemetry drains; otherwise
              // continuous station changes can keep the in-flight queue perpetually non-empty.
              useSimulationStore.getState().setRunning(false);
              requestTelemetryRefresh();
              useUIStore.getState().setDemo({ step: 15, currentPhase: '15/16 — Link Restoring' });
              useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: reconnectAt, event: 'Full communication link restored', source: 'communication' });

              waitForState(
                runId,
                '16/16 — Syncing HQ with station',
                () => {
                  tickCommunication();
                  const { comm, hq } = useCommunicationStore.getState();
                  return comm.queue.length === 0
                    && comm.inFlight.length === 0
                    && hq.lastSyncTimestamp >= reconnectAt
                    && Boolean(useCommunicationStore.getState().commands.find((item) => item.id === command.id)?.acknowledgedAt);
                },
                30000,
                'Synchronization incomplete',
                () => {
                  useUIStore.getState().setDemo({ step: 16, currentPhase: 'Demo Complete', running: false, error: undefined });
                  useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ fully synchronized with station', source: 'system' });
                  clearDemoTimers();
                },
              );
            },
          ),
        );
      }, 1200, runId);
    },
  );
}

registerDemoCancellation(() => {
  demoRunId += 1;
  clearDemoTimers();
});

export function startDemo() {
  stopDemo();
  resetScenario();
  resetCommunicationEngine(2026);

  const runId = ++demoRunId;
  useUIStore.getState().setDemo({ running: true, step: 0, totalSteps: TOTAL_STEPS, currentPhase: 'Starting...', error: undefined, startedAt: Date.now() });
  useSimulationStore.getState().setRunning(true);

  let cumulativeDelay = 0;
  TIMED_STEPS.forEach((step, index) => {
    cumulativeDelay += step.delay;
    schedule(() => {
      if (index === TIMED_STEPS.length - 1) {
        beginCommandFlow(runId);
        return;
      }
      step.action();
      useUIStore.getState().setDemo({ step: index + 1, currentPhase: step.phase });
    }, cumulativeDelay, runId);
  });
}

export function stopDemo() {
  demoRunId += 1;
  clearDemoTimers();
  useUIStore.getState().setDemo({ running: false, step: 0, currentPhase: 'Idle', error: undefined });
  useSimulationStore.getState().setRunning(false);
}

export function resetDemo() {
  stopDemo();
  resetScenario();
  useUIStore.getState().resetUI();
}
