import { useCommunicationStore } from '../store/communicationStore';
import { useSimulationStore } from '../store/simulationStore';
import { useUIStore, type Tab } from '../store/uiStore';
import { LinkState, CommMode, UserRole } from '../types';
import { formatBytes } from '../utils/helpers';

const TABS: { id: Tab; label: string }[] = [
  { id: 'command-center', label: 'Command Center' },
  { id: 'station', label: 'Station' },
  { id: 'link', label: 'Link Simulator' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'commands', label: 'Commands' },
  { id: 'inventory', label: 'Inventory' },
];

const linkStateColors: Record<LinkState, string> = {
  [LinkState.ONLINE]: 'bg-green-500',
  [LinkState.DEGRADED]: 'bg-amber-500',
  [LinkState.OFFLINE]: 'bg-red-500',
};

const linkStateLabels: Record<LinkState, string> = {
  [LinkState.ONLINE]: 'ONLINE',
  [LinkState.DEGRADED]: 'DEGRADED',
  [LinkState.OFFLINE]: 'OFFLINE',
};

export function TopBar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const role = useUIStore((s) => s.role);
  const setRole = useUIStore((s) => s.setRole);
  const demo = useUIStore((s) => s.demo);
  const scenario = useSimulationStore((s) => s.scenario);
  const linkState = useCommunicationStore((s) => s.comm.linkState);
  const commMode = useCommunicationStore((s) => s.comm.commMode);
  const bytesUsed = useCommunicationStore((s) => s.comm.bytesUsedToday);
  const byteBudget = useCommunicationStore((s) => s.comm.dailyByteBudget);

  const budgetPct = Math.min((bytesUsed / byteBudget) * 100, 100);
  const budgetColor = budgetPct > 80 ? 'bg-red-500' : budgetPct > 50 ? 'bg-amber-500' : 'bg-cyan-500';

  return (
    <header className="bg-[#0d1321] border-b border-[#2a3a4e]">
      {/* Top row */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Logo + Scenario */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 8px #06b6d4' }} />
            <span className="text-sm font-bold tracking-wider text-cyan-400">POLAR RESILIENCE</span>
          </div>
          <span className="text-xs text-slate-500">|</span>
          <span className="text-xs text-slate-400 uppercase tracking-wide">{scenario.name}</span>
          {demo.running && (
            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">
              DEMO: {demo.currentPhase}
            </span>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-5">
          {/* Link Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${linkStateColors[linkState]}`}
              style={{ boxShadow: `0 0 6px ${linkState === LinkState.ONLINE ? '#22c55e' : linkState === LinkState.DEGRADED ? '#f59e0b' : '#ef4444'}80` }} />
            <span className="text-xs text-slate-400 uppercase">{linkStateLabels[linkState]}</span>
          </div>

          {/* Comm Mode */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase">Mode:</span>
            <span className="text-xs text-slate-300 font-medium">{commMode.replace('_', ' ')}</span>
          </div>

          {/* Byte Budget */}
          <div className="flex items-center gap-2 min-w-[140px]">
            <span className="text-[10px] text-slate-500 uppercase">Budget:</span>
            <div className="flex-1">
              <div className="budget-meter">
                <div className={`budget-meter-fill ${budgetColor}`} style={{ width: `${budgetPct}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-slate-400">{formatBytes(bytesUsed)}/{formatBytes(byteBudget)}</span>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-1 bg-[#1a2332] rounded border border-[#2a3a4e]">
            <button
              onClick={() => setRole(UserRole.HQ_COMMAND)}
              className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded transition-colors ${
                role === UserRole.HQ_COMMAND
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              HQ Command
            </button>
            <button
              onClick={() => setRole(UserRole.STATION_LEADER)}
              className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded transition-colors ${
                role === UserRole.STATION_LEADER
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              Station Leader
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center px-4 gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
