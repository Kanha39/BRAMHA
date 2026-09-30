import { useSimulationStore } from '../store/simulationStore';
import { AlertLevel } from '../types';
import { alertLevelBg, alertLevelColor } from '../utils/helpers';

export function DecisionPanel() {
  const recommendations = useSimulationStore((s) => s.recommendations);
  const alerts = useSimulationStore((s) => s.alerts);

  const criticalCount = alerts.filter((a) => a.level === AlertLevel.RED && !a.acknowledged).length;
  const warningCount = alerts.filter((a) => a.level === AlertLevel.AMBER && !a.acknowledged).length;

  // Simple risk score
  const riskScore = Math.min(100, criticalCount * 25 + warningCount * 10);
  const riskColor = riskScore >= 60 ? 'text-red-400' : riskScore >= 30 ? 'text-amber-400' : 'text-green-400';

  return (
    <div className="card">
      <div className="card-header">Decision Support</div>
      
      {/* Risk Score */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">Risk Score</span>
        <div className="flex items-center gap-2">
          <div className="w-24 budget-meter">
            <div
              className={`budget-meter-fill ${riskScore >= 60 ? 'bg-red-500' : riskScore >= 30 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${riskScore}%` }}
            />
          </div>
          <span className={`text-sm font-bold font-[tabular-nums] ${riskColor}`}>{riskScore}</span>
        </div>
      </div>

      {/* Active Alerts Summary */}
      <div className="flex gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-slate-400">{criticalCount} Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-slate-400">{warningCount} Warning</span>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-2">
        {recommendations.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">No active recommendations</p>
        ) : (
          recommendations.slice(0, 3).map((rec) => (
            <div key={rec.id} className="bg-[#0d1321] border border-[#2a3a4e] rounded p-3">
              <div className="text-xs text-red-400 font-semibold mb-1">⚠ SITUATION</div>
              <p className="text-xs text-slate-300 mb-2">{rec.situation}</p>
              <div className="text-xs text-amber-400 font-semibold mb-1">IMPACT</div>
              <p className="text-xs text-slate-400 mb-2">{rec.impact}</p>
              <div className="text-xs text-cyan-400 font-semibold mb-1">RECOMMENDED ACTION</div>
              <p className="text-xs text-slate-300 mb-2">{rec.recommendedAction}</p>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">
                  Autonomy: {rec.projectedAutonomyBefore}d → {rec.projectedAutonomyAfter}d
                </span>
                <span className="text-slate-400">Confidence: {rec.confidence}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
