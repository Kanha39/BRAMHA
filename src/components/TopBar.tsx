import { useState } from 'react';
import { useCommunicationStore } from '../store/communicationStore';
import { useSimulationStore } from '../store/simulationStore';
import { useUIStore, type Tab } from '../store/uiStore';
import { LinkState, UserRole } from '../types';
import { formatBytes } from '../utils/helpers';

const PRIMARY_TABS: { id: Tab; label: string }[] = [
  { id: 'command-center', label: 'Command Center' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'link', label: 'Link Simulator' },
  { id: 'decisions', label: 'Decisions' },
];

const MORE_TABS: { id: Tab; label: string }[] = [
  { id: 'station', label: 'Station View' },
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
  const [moreOpen, setMoreOpen] = useState(false);
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-2 gap-3 md:gap-0">
        {/* Logo + Scenario */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: '0 0 8px #06b6d4' }} />
            <span className="text-sm font-bold tracking-wider text-cyan-400">BRAMHA</span>
          </div>
          <span className="hidden sm:inline text-xs text-slate-500">|</span>
          <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wide bg-[#1a2332] px-2 py-0.5 rounded border border-[#2a3a4e]">
            {scenario.name}
          </span>
          {demo.running && (
            <span className="text-[10px] sm:text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">
              DEMO: {demo.currentPhase}
            </span>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 w-full md:w-auto">
          {/* Link Status */}
          <div className="flex items-center gap-2 bg-[#1a2332] px-2 py-1 rounded border border-[#2a3a4e]">
            <div className={`w-2 h-2 rounded-full ${linkStateColors[linkState]}`}
              style={{ boxShadow: `0 0 6px ${linkState === LinkState.ONLINE ? '#22c55e' : linkState === LinkState.DEGRADED ? '#f59e0b' : '#ef4444'}80` }} />
            <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold">{linkStateLabels[linkState]}</span>
          </div>

          {/* Comm Mode */}
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <span className="text-[10px] text-slate-500 uppercase">Mode:</span>
            <span className="text-xs text-slate-300 font-medium">{commMode.replace('_', ' ')}</span>
          </div>

          {/* Byte Budget */}
          <div className="flex items-center gap-2 flex-1 md:min-w-[140px] md:flex-none">
            <span className="text-[10px] text-slate-500 uppercase hidden sm:inline">Budget:</span>
            <div className="flex-1">
              <div className="budget-meter h-1.5 bg-[#1a2332]">
                <div className={`budget-meter-fill ${budgetColor}`} style={{ width: `${budgetPct}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-[tabular-nums] whitespace-nowrap">
              {formatBytes(bytesUsed)}/{formatBytes(byteBudget)}
            </span>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-1 bg-[#1a2332] rounded border border-[#2a3a4e] p-0.5">
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
        {PRIMARY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setMoreOpen(false);
            }}
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => setMoreOpen((open) => !open)}
            className={`tab ${MORE_TABS.some((tab) => tab.id === activeTab) ? 'tab-active' : ''}`}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
          >
            More <span className="ml-1 text-[10px]">{moreOpen ? '▴' : '▾'}</span>
          </button>
          {moreOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 min-w-40 rounded border border-[#2a3a4e] bg-[#111827] p-1 shadow-xl">
              {MORE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMoreOpen(false);
                  }}
                  className={`block w-full rounded px-3 py-2 text-left text-xs uppercase tracking-wide transition-colors ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'text-slate-400 hover:bg-[#1a2332] hover:text-slate-200'
                  }`}
                  role="menuitem"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
