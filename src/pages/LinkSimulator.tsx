import { useCommunicationStore } from '../store/communicationStore';
import { LinkState, CommMode, Priority } from '../types';
import { formatBytes } from '../utils/helpers';
import { calculateBytesSaved } from '../communication/commEngine';

const modeDescriptions: Record<CommMode, string> = {
  [CommMode.FULL]: 'All telemetry transmitted',
  [CommMode.COMPACT]: 'Only meaningful changes & compressed summaries',
  [CommMode.ALERTS_ONLY]: 'Only warnings and critical events',
  [CommMode.SOS_ONLY]: 'Emergency information only',
};

export function LinkSimulator() {
  const comm = useCommunicationStore((s) => s.comm);
  const setLinkState = useCommunicationStore((s) => s.setLinkState);
  const setCommMode = useCommunicationStore((s) => s.setCommMode);
  const setBandwidth = useCommunicationStore((s) => s.setBandwidth);

  const { saved, percentage } = calculateBytesSaved();
  const budgetPct = Math.min((comm.bytesUsedToday / comm.dailyByteBudget) * 100, 100);
  const budgetColor = budgetPct > 80 ? 'bg-red-500' : budgetPct > 50 ? 'bg-amber-500' : 'bg-cyan-500';

  const priorityColors: Record<string, string> = {
    [Priority.CRITICAL]: 'bg-red-500/20 text-red-400 border-red-500/30',
    [Priority.HIGH]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    [Priority.MEDIUM]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    [Priority.LOW]: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Link Controls */}
        <div className="card">
          <div className="card-header">Communication Link Controls</div>
          <div className="space-y-4">
            {/* Link State */}
            <div>
              <label className="text-xs text-slate-400 block mb-2">Link State</label>
              <div className="flex gap-2">
                {Object.values(LinkState).map((state) => (
                  <button
                    key={state}
                    onClick={() => setLinkState(state)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${
                      comm.linkState === state
                        ? state === LinkState.ONLINE ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : state === LinkState.DEGRADED ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-[#1a2332] text-slate-500 border-[#2a3a4e] hover:text-slate-400'
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>

            {/* Bandwidth Slider */}
            <div>
              <label className="text-xs text-slate-400 block mb-2">
                Bandwidth: {formatBytes(comm.bandwidth)}/s
              </label>
              <input
                type="range"
                min="0"
                max={comm.maxBandwidth}
                value={comm.bandwidth}
                onChange={(e) => setBandwidth(Number(e.target.value))}
                className="w-full h-1 bg-[#2a3a4e] rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0</span>
                <span>{formatBytes(comm.maxBandwidth)}/s</span>
              </div>
            </div>

            {/* Comm Mode */}
            <div>
              <label className="text-xs text-slate-400 block mb-2">Communication Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(CommMode).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCommMode(mode)}
                    className={`px-3 py-2 text-xs rounded border transition-colors text-left ${
                      comm.commMode === mode
                        ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                        : 'bg-[#1a2332] text-slate-500 border-[#2a3a4e] hover:text-slate-400'
                    }`}
                  >
                    <div className="font-semibold">{mode.replace(/_/g, ' ')}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">{modeDescriptions[mode]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bytes Saved */}
            {comm.commMode !== CommMode.FULL && (
              <div className="bg-green-500/10 border border-green-500/20 rounded px-3 py-2">
                <span className="text-xs text-green-400 font-semibold">
                  {percentage}% bytes saved vs full telemetry
                </span>
                <span className="text-[10px] text-green-400/60 ml-2">
                  ({formatBytes(saved)} per cycle)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Link Status */}
        <div className="space-y-4">
          {/* Byte Accounting */}
          <div className="card">
            <div className="card-header">Byte Accounting</div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Bytes Sent</span>
                <span className="text-green-400 font-semibold font-[tabular-nums]">{formatBytes(comm.bytesSent)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Bytes Queued</span>
                <span className="text-amber-400 font-semibold font-[tabular-nums]">{formatBytes(comm.bytesQueued)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Bytes Dropped</span>
                <span className="text-red-400 font-semibold font-[tabular-nums]">{formatBytes(comm.bytesDropped)}</span>
              </div>
              <div className="border-t border-[#2a3a4e] pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Daily Budget Used</span>
                  <span className="text-slate-300">{budgetPct.toFixed(1)}%</span>
                </div>
                <div className="budget-meter h-2">
                  <div className={`budget-meter-fill ${budgetColor}`} style={{ width: `${budgetPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>{formatBytes(comm.bytesUsedToday)}</span>
                  <span>{formatBytes(comm.dailyByteBudget)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transmission Queue */}
          <div className="card">
            <div className="card-header">Transmission Queue ({comm.queue.length} packets)</div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {comm.queue.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Queue empty</p>
              ) : (
                comm.queue.slice(0, 20).map((packet) => (
                  <div key={packet.id} className="flex items-center justify-between py-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${priorityColors[packet.telemetry.priority]}`}>
                        {packet.telemetry.priority}
                      </span>
                      <span className="text-slate-400">{packet.telemetry.type}</span>
                    </div>
                    <span className="text-slate-500 font-[tabular-nums]">{packet.telemetry.byteSize}B</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
