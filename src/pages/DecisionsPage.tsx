import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { DecisionPanel } from '../components/DecisionPanel';
import { AlertLevel } from '../types';
import { alertLevelBg, alertLevelColor, formatTimeShort } from '../utils/helpers';

export function DecisionsPage() {
  const alerts = useSimulationStore((s) => s.alerts);
  const station = useSimulationStore((s) => s.station);
  const hq = useCommunicationStore((s) => s.hq);
  const acknowledgeAlert = useSimulationStore((s) => s.acknowledgeAlert);

  const staleness = hq.overallStaleness;
  const stalenessMin = Math.floor(staleness / 60000);
  const forecastConfidence = Math.max(10, 100 - stalenessMin * 15);

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Decision Support */}
        <DecisionPanel />

        {/* Forecast & Confidence */}
        <div className="card">
          <div className="card-header">Forecast & Uncertainty</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">HQ Data Staleness</span>
              <span className={`text-sm font-semibold ${
                stalenessMin < 2 ? 'text-green-400' : stalenessMin < 5 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {stalenessMin < 1 ? '<1 min' : `${stalenessMin} min`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Forecast Confidence</span>
              <span className={`text-sm font-semibold ${
                forecastConfidence >= 70 ? 'text-green-400' : forecastConfidence >= 40 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {forecastConfidence}%
              </span>
            </div>
            <div className="bg-[#0d1321] border border-[#2a3a4e] rounded p-3">
              <p className="text-[10px] text-slate-500 italic">
                Simulated deterministic projection based on current trends. 
                Confidence decreases as HQ telemetry becomes stale. 
                This is NOT machine-learning prediction.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Days of Autonomy (Station)</span>
              <span className="text-sm font-semibold text-emerald-400">{station.daysOfAutonomy} days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Days of Autonomy (HQ Estimate)</span>
              <span className="text-sm font-semibold text-blue-400">{Number(hq.daysOfAutonomy.value)} days</span>
            </div>
          </div>
        </div>
      </div>

      {/* All Alerts */}
      <div className="card">
        <div className="card-header">All Alerts</div>
        <div className="max-h-96 overflow-y-auto space-y-1">
          {alerts.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No alerts</p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between px-3 py-2 rounded border text-xs ${
                  alert.acknowledged ? 'opacity-50 bg-[#1a2332] border-[#2a3a4e]' : alertLevelBg(alert.level)
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${alertLevelColor(alert.level)}`}>
                    {alert.level === AlertLevel.RED ? '⚠' : alert.level === AlertLevel.AMBER ? '△' : '●'}
                  </span>
                  <span className="font-semibold text-slate-200">{alert.title}</span>
                  <span className="text-slate-400">{alert.message}</span>
                  <span className="text-slate-500">{formatTimeShort(alert.timestamp)}</span>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 uppercase"
                  >
                    ACK
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
