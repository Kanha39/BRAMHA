import { useSimulationStore } from '../store/simulationStore';
import { formatTimeShort } from '../utils/helpers';

const sourceColors: Record<string, string> = {
  station: 'text-emerald-400',
  hq: 'text-blue-400',
  system: 'text-slate-400',
  communication: 'text-amber-400',
};

export function AuditLog() {
  const auditLog = useSimulationStore((s) => s.auditLog);

  return (
    <div className="card">
      <div className="card-header">Audit Log</div>
      <div className="max-h-64 overflow-y-auto space-y-0">
        {auditLog.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No events recorded</p>
        ) : (
          auditLog.slice(0, 30).map((event) => (
            <div key={event.id} className="flex items-start gap-2 py-1.5 border-b border-[#2a3a4e]/30 last:border-0">
              <span className="text-[10px] text-slate-500 font-[tabular-nums] whitespace-nowrap">
                {formatTimeShort(event.timestamp)}
              </span>
              <span className={`text-[10px] uppercase font-semibold w-10 ${sourceColors[event.source] || 'text-slate-500'}`}>
                {event.source.slice(0, 4)}
              </span>
              <span className="text-xs text-slate-300 flex-1">{event.event}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
