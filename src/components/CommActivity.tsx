import { useCommunicationStore } from '../store/communicationStore';
import { formatTimeShort, formatBytes } from '../utils/helpers';

export function CommActivity() {
  const transmissionLog = useCommunicationStore((s) => s.comm.transmissionLog);
  const linkState = useCommunicationStore((s) => s.comm.linkState);

  return (
    <div className="card">
      <div className="card-header">Communication Activity</div>
      <div className="max-h-64 overflow-y-auto space-y-0">
        {transmissionLog.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No transmission activity</p>
        ) : (
          transmissionLog.slice(0, 25).map((packet) => (
            <div key={packet.id} className="flex items-center justify-between py-1 border-b border-[#2a3a4e]/30 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold ${
                  packet.status === 'sent' ? 'text-green-400' :
                  packet.status === 'dropped' ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {packet.status === 'sent' ? '✓' : packet.status === 'dropped' ? '✗' : '…'}
                </span>
                <span className="text-xs text-slate-400 truncate max-w-[160px]">{packet.telemetry.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-[tabular-nums]">{packet.telemetry.byteSize}B</span>
                {packet.sentAt && (
                  <span className="text-[10px] text-slate-600 font-[tabular-nums]">{formatTimeShort(packet.sentAt)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
