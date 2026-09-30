import { useSimulationStore } from '../store/simulationStore';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';

function formatChartTime(ts: number) {
  const d = new Date(ts);
  return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

interface MiniChartProps {
  title: string;
  data: { timestamp: number; value: number }[];
  color: string;
  unit: string;
  domain?: [number, number];
}

function MiniChart({ title, data, color, unit, domain }: MiniChartProps) {
  const chartData = data.map((d) => ({ time: d.timestamp, value: d.value }));

  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickFormatter={formatChartTime}
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={domain || ['auto', 'auto']}
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a2332',
                border: '1px solid #2a3a4e',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
              labelFormatter={(val) => formatChartTime(Number(val))}
              formatter={(val: any) => [`${Number(val).toFixed(1)} ${unit}`, title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#grad-${title})`}
              strokeWidth={1.5}
              dot={false}
              animationDuration={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TelemetryCharts() {
  const history = useSimulationStore((s) => s.history);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <MiniChart title="Temperature" data={history.temperature} color="#3b82f6" unit="°C" />
      <MiniChart title="Power Load" data={history.power} color="#eab308" unit="kW" />
      <MiniChart title="Battery" data={history.battery} color="#22c55e" unit="%" domain={[0, 100]} />
      <MiniChart title="Fuel" data={history.fuel} color="#06b6d4" unit="%" domain={[0, 100]} />
      <MiniChart title="Wind Speed" data={history.wind} color="#94a3b8" unit="km/h" />
    </div>
  );
}
