import { useEffect, useMemo, useState } from 'react';
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCommunicationStore } from '../store/communicationStore';
import { Freshness, LinkState } from '../types';
import { buildBatteryForecast } from '../utils/forecast';

function formatAge(seconds: number) {
  if (seconds < 60) return `${Math.floor(seconds)} sec`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
}

export function ForecastCard() {
  const [now, setNow] = useState(0);
  const battery = useCommunicationStore((s) => s.hq.energy.batteryLevel);
  const history = useCommunicationStore((s) => s.hq.batteryHistory);
  const linkState = useCommunicationStore((s) => s.comm.linkState);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const generatedAt = now || battery.lastUpdated + battery.age;
  const forecast = useMemo(
    () => buildBatteryForecast(history, battery, linkState, generatedAt),
    [history, battery, linkState, generatedAt],
  );
  const freshnessColor = battery.freshness === Freshness.FRESH ? 'text-emerald-400' : battery.freshness === Freshness.AGING ? 'text-amber-400' : 'text-red-400';
  const confidenceColor = forecast.overallConfidence >= 75 ? 'text-emerald-400' : forecast.overallConfidence >= 50 ? 'text-amber-400' : 'text-red-400';
  const communication = linkState === LinkState.ONLINE ? 'ONLINE' : linkState;
  const chartData = forecast.points.map((point) => ({
    ...point,
    lower: point.lowerBound,
    range: point.upperBound - point.lowerBound,
    actual: point.actual,
    prediction: point.timestamp >= forecast.generatedAt ? point.forecast : undefined,
  }));
  const min = Math.max(0, Math.min(...chartData.map((point) => point.lowerBound)) - 2);
  const max = Math.min(100, Math.max(...chartData.map((point) => point.upperBound)) + 2);

  return (
    <section className="card" aria-label="Battery reserve forecast">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="card-header mb-1">Battery Reserve Forecast</div>
          <p className="text-[10px] text-slate-500">HQ-known telemetry · 10 minute projection</p>
        </div>
        <div className="text-right" title="Simulated uncertainty based on HQ data age, link state and recent battery variability.">
          <div className={`text-lg font-bold tabular-nums ${confidenceColor}`}>{forecast.overallConfidence}%</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Simulated confidence</div>
        </div>
      </div>

      <div className="mt-3 h-44" role="img" aria-label={`HQ battery forecast from ${Number(battery.value).toFixed(1)} percent, ${forecast.overallConfidence} percent simulated confidence`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={35} />
            <YAxis domain={[min, max]} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={38} unit="%" />
            <Tooltip
              labelFormatter={(value) => formatTime(Number(value))}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)}%`,
                name === 'actual' ? 'Received by HQ' : name === 'prediction' ? 'Forecast' : name === 'range' ? 'Uncertainty range' : String(name),
              ]}
              contentStyle={{ backgroundColor: '#101927', border: '1px solid #2a3a4e', borderRadius: 6, fontSize: 11, color: '#e2e8f0' }}
            />
            <ReferenceLine x={forecast.generatedAt} stroke="#64748b" strokeDasharray="3 3" />
            <Area dataKey="lower" stackId="cone" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area dataKey="range" stackId="cone" stroke="none" fill="#38bdf8" fillOpacity={0.18} isAnimationActive={false} />
            <Line dataKey="actual" name="actual" type="monotone" stroke="#34d399" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line dataKey="prediction" name="prediction" type="monotone" stroke="#38bdf8" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-3 bg-emerald-400" /> Received by HQ</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-3 border-t border-dashed border-sky-400" /> Forecast</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-3 rounded-sm bg-sky-400/25" /> Uncertainty</span>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-[#263244] pt-2 text-[10px]">
        <span className="text-slate-400">HQ value <b className="text-slate-200">{Number(battery.value).toFixed(1)}%</b></span>
        <span className="text-slate-400">Data age <b className="text-slate-200">{formatAge(forecast.dataAgeSeconds)}</b></span>
        <span className="text-slate-400">Freshness <b className={freshnessColor}>{battery.freshness}</b></span>
        <span className="text-slate-400">Link <b className={linkState === LinkState.ONLINE ? 'text-emerald-400' : linkState === LinkState.DEGRADED ? 'text-amber-400' : 'text-red-400'}>{communication}</b></span>
      </div>
      <p className="mt-2 text-[9px] leading-4 text-slate-500">Confidence reflects simulated data age, link quality and recent variability; it is not a statistical probability.</p>
    </section>
  );
}
