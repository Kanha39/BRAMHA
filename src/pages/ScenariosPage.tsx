import { useSimulationStore } from '../store/simulationStore';
import { ScenarioType } from '../types';
import { activateScenario, resetScenario } from '../simulation/scenarioEngine';
import { startDemo, stopDemo, resetDemo } from '../simulation/demoRunner';
import { useUIStore } from '../store/uiStore';

const scenarioConfigs = [
  {
    type: ScenarioType.NORMAL,
    name: 'Normal Operations',
    description: 'Station operating under normal conditions. Stable weather, healthy systems, full communication.',
    icon: '✅',
    color: 'border-green-500/30 hover:border-green-500/50',
    activeColor: 'border-green-500 bg-green-500/10',
  },
  {
    type: ScenarioType.BLIZZARD,
    name: 'Blizzard',
    description: 'Severe Antarctic blizzard. Wind increases, temperature drops, power demand surges, communication degrades.',
    icon: '🌨',
    color: 'border-blue-500/30 hover:border-blue-500/50',
    activeColor: 'border-blue-500 bg-blue-500/10',
  },
  {
    type: ScenarioType.GENERATOR_FAILURE,
    name: 'Generator Failure',
    description: 'Generator 2 experiences critical failure. Power generation drops, battery begins discharging, risk increases.',
    icon: '⚡',
    color: 'border-amber-500/30 hover:border-amber-500/50',
    activeColor: 'border-amber-500 bg-amber-500/10',
  },
  {
    type: ScenarioType.COMM_OUTAGE,
    name: 'Communication Outage',
    description: 'Communication link lost. Station continues normally but HQ stops receiving telemetry. Data becomes stale.',
    icon: '📡',
    color: 'border-red-500/30 hover:border-red-500/50',
    activeColor: 'border-red-500 bg-red-500/10',
  },
];

export function ScenariosPage() {
  const scenario = useSimulationStore((s) => s.scenario);
  const running = useSimulationStore((s) => s.running);
  const demo = useUIStore((s) => s.demo);

  return (
    <div className="p-4 space-y-6">
      {/* Demo Controls */}
      <div className="card">
        <div className="card-header">Demo Control</div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (demo.running) {
                stopDemo();
              } else {
                startDemo();
              }
            }}
            className={`px-6 py-2.5 rounded font-semibold text-sm transition-colors ${
              demo.running
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
            }`}
          >
            {demo.running ? '⏹ STOP DEMO' : '▶ RUN DEMO'}
          </button>
          <button
            onClick={resetDemo}
            className="px-4 py-2.5 rounded text-sm text-slate-400 border border-[#2a3a4e] hover:text-slate-300 hover:border-slate-500 transition-colors"
          >
            ↻ RESET
          </button>
          {demo.running && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs text-cyan-400">{demo.currentPhase}</span>
              </div>
              <div className="w-32 budget-meter">
                <div
                  className="budget-meter-fill bg-cyan-500"
                  style={{ width: `${(demo.step / demo.totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">{demo.step}/{demo.totalSteps}</span>
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          The demo automatically plays through the complete resilience workflow: Normal → Blizzard → Generator Failure → Comm Outage → Recovery
        </p>
      </div>

      {/* Scenario Cards */}
      <div>
        <div className="card-header px-1 mb-3">Scenario Controls</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scenarioConfigs.map((cfg) => {
            const isActive = scenario.type === cfg.type;
            return (
              <div
                key={cfg.type}
                className={`card border transition-colors cursor-pointer ${
                  isActive ? cfg.activeColor : cfg.color
                }`}
                onClick={() => {
                  if (!running && !demo.running) {
                    activateScenario(cfg.type);
                    useSimulationStore.getState().setRunning(true);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{cfg.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-200">{cfg.name}</h3>
                      {isActive && (
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{cfg.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      <div className="flex justify-center">
        <button
          onClick={() => {
            resetScenario();
          }}
          className="px-4 py-2 text-xs text-slate-500 border border-[#2a3a4e] rounded hover:text-slate-400 hover:border-slate-500 transition-colors"
        >
          Reset All to Normal
        </button>
      </div>
    </div>
  );
}
