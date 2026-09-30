import { useSimulationStore } from '../store/simulationStore';
import { AlertLevel } from '../types';
import { alertLevelBg, alertLevelColor, formatTimeShort } from '../utils/helpers';

export function AlertBanner() {
  const alerts = useSimulationStore((s) => s.alerts);
  const acknowledgeAlert = useSimulationStore((s) => s.acknowledgeAlert);

  const criticalAlerts = alerts.filter((a) => a.level === AlertLevel.RED && !a.acknowledged);
  const warningAlerts = alerts.filter((a) => a.level === AlertLevel.AMBER && !a.acknowledged);
  const activeAlerts = [...criticalAlerts, ...warningAlerts].slice(0, 5);

  if (activeAlerts.length === 0) return null;

  return (
    <div className="space-y-1 px-4 py-2">
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between px-3 py-1.5 rounded border text-xs ${alertLevelBg(alert.level)}`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${alertLevelColor(alert.level)}`}>
              {alert.level === AlertLevel.RED ? '⚠' : '△'}
            </span>
            <span className={`font-semibold ${alertLevelColor(alert.level)}`}>{alert.title}</span>
            <span className="text-slate-400">{alert.message}</span>
            <span className="text-slate-500">{formatTimeShort(alert.timestamp)}</span>
          </div>
          <button
            onClick={() => acknowledgeAlert(alert.id)}
            className="text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-wide"
          >
            ACK
          </button>
        </div>
      ))}
    </div>
  );
}
