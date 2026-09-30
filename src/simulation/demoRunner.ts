import { ScenarioType, LinkState, CommMode, CommandStatus, Priority } from '../types';
import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { useUIStore } from '../store/uiStore';
import { activateScenario, resetScenario } from './scenarioEngine';
import { applyLoadReduction } from './stationSimulator';
import { generateId } from '../utils/helpers';

interface DemoStep {
  delay: number; // ms after previous step
  phase: string;
  action: () => void;
}

const DEMO_STEPS: DemoStep[] = [
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
    action: () => {
      activateScenario(ScenarioType.BLIZZARD);
    },
  },
  {
    delay: 6000,
    phase: '3/16 — Wind Increasing',
    action: () => {
      // Wind ramp handled by simulation
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Wind speed increasing rapidly', source: 'station' });
    },
  },
  {
    delay: 6000,
    phase: '4/16 — Power Demand Rising',
    action: () => {
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Power demand rising due to HVAC load', source: 'station' });
    },
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
    action: () => {
      activateScenario(ScenarioType.GENERATOR_FAILURE);
    },
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
    action: () => {
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ data staleness increasing', source: 'system' });
    },
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
    action: () => {
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ received critical generator alert', source: 'communication' });
    },
  },
  {
    delay: 4000,
    phase: '12/16 — HQ Issues Command',
    action: () => {
      const cmd = {
        id: generateId(),
        type: 'REDUCE_NONESSENTIAL_LOAD',
        description: 'Reduce non-essential load to extend station autonomy',
        priority: Priority.HIGH,
        status: CommandStatus.SENT,
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
        sentAt: Date.now(),
      };
      useCommunicationStore.getState().createCommand(cmd);
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ command created: Reduce non-essential load', source: 'hq' });
    },
  },
  {
    delay: 3000,
    phase: '13/16 — Station Receives Command',
    action: () => {
      const { commands } = useCommunicationStore.getState();
      if (commands.length > 0) {
        useCommunicationStore.getState().updateCommandStatus(commands[0].id, CommandStatus.RECEIVED);
        useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Station received HQ command', source: 'station' });
      }
    },
  },
  {
    delay: 4000,
    phase: '14/16 — Station Leader Approves',
    action: () => {
      const { commands } = useCommunicationStore.getState();
      if (commands.length > 0) {
        useCommunicationStore.getState().updateCommandStatus(commands[0].id, CommandStatus.APPROVED);
        applyLoadReduction();
        useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Station leader approved load reduction', source: 'station' });
      }
    },
  },
  {
    delay: 6000,
    phase: '15/16 — Link Restoring',
    action: () => {
      useCommunicationStore.getState().setLinkState(LinkState.ONLINE);
      useCommunicationStore.getState().setCommMode(CommMode.FULL);
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Full communication link restored', source: 'communication' });
    },
  },
  {
    delay: 6000,
    phase: '16/16 — HQ Synchronized',
    action: () => {
      useSimulationStore.getState().addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'HQ fully synchronized with station', source: 'system' });
    },
  },
];

let demoTimeouts: ReturnType<typeof setTimeout>[] = [];

export function startDemo() {
  stopDemo();
  resetScenario();
  
  const uiStore = useUIStore.getState();
  const simStore = useSimulationStore.getState();
  
  uiStore.setDemo({ running: true, step: 0, totalSteps: DEMO_STEPS.length, currentPhase: 'Starting...', startedAt: Date.now() });
  simStore.setRunning(true);
  
  let cumulativeDelay = 0;
  
  DEMO_STEPS.forEach((step, index) => {
    cumulativeDelay += step.delay;
    const timeout = setTimeout(() => {
      const currentDemo = useUIStore.getState().demo;
      if (!currentDemo.running) return;
      
      step.action();
      useUIStore.getState().setDemo({ step: index + 1, currentPhase: step.phase });
      
      // End demo after last step
      if (index === DEMO_STEPS.length - 1) {
        setTimeout(() => {
          useUIStore.getState().setDemo({ currentPhase: 'Demo Complete', running: false });
        }, 3000);
      }
    }, cumulativeDelay);
    demoTimeouts.push(timeout);
  });
}

export function stopDemo() {
  demoTimeouts.forEach(clearTimeout);
  demoTimeouts = [];
  useUIStore.getState().setDemo({ running: false, step: 0, currentPhase: 'Idle' });
  useSimulationStore.getState().setRunning(false);
}

export function resetDemo() {
  stopDemo();
  resetScenario();
  useUIStore.getState().resetUI();
}
