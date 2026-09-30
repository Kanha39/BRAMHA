import { type Freshness } from '../types';
import { formatAge, freshnessColor } from '../utils/helpers';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: string;
  // For HQ comparison
  hqValue?: string | number;
  hqAge?: number;
  hqFreshness?: Freshness;
  compact?: boolean;
}

export function MetricCard({
  label,
  value,
  unit = '',
  icon,
  trend,
  color = 'text-cyan-400',
  hqValue,
  hqAge,
  hqFreshness,
  compact = false,
}: MetricCardProps) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-amber-400' : 'text-slate-500';

  if (compact) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold font-[tabular-nums] ${color}`}>
            {value}{unit}
          </span>
          {trend && <span className={`text-xs ${trendColor}`}>{trendIcon}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">{icon && <span className="mr-1">{icon}</span>}{label}</div>
      <div className="flex items-end justify-between">
        <div>
          <span className={`metric-value ${color}`}>{value}</span>
          {unit && <span className="text-xs text-slate-500 ml-1">{unit}</span>}
        </div>
        {trend && <span className={`text-sm ${trendColor}`}>{trendIcon}</span>}
      </div>
      {hqValue !== undefined && hqAge !== undefined && hqFreshness && (
        <div className="mt-2 pt-2 border-t border-[#2a3a4e]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase">HQ Knows</span>
            <span className={`text-[10px] ${freshnessColor(hqFreshness)}`}>{formatAge(hqAge)}</span>
          </div>
          <span className="text-sm text-slate-400 font-[tabular-nums]">{hqValue}{unit}</span>
        </div>
      )}
    </div>
  );
}
