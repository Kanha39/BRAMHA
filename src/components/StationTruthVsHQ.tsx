import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { Freshness, EquipmentStatus } from '../types';
import { formatAge, freshnessColor } from '../utils/helpers';

interface ComparisonRow {
  label: string;
  stationValue: string;
  hqValue: string;
  hqAge: number;
  hqFreshness: Freshness;
  isDifferent: boolean;
}

export function StationTruthVsHQ() {
  const station = useSimulationStore((s) => s.station);
  const hq = useCommunicationStore((s) => s.hq);

  const rows: ComparisonRow[] = [
    {
      label: 'Temperature',
      stationValue: `${station.environment.temperature.toFixed(1)}°C`,
      hqValue: `${Number(hq.environment.temperature?.value ?? 0).toFixed(1)}°C`,
      hqAge: hq.environment.temperature?.age ?? 0,
      hqFreshness: hq.environment.temperature?.freshness ?? Freshness.STALE,
      isDifferent: Math.abs(station.environment.temperature - Number(hq.environment.temperature?.value ?? 0)) > 1,
    },
    {
      label: 'Wind Speed',
      stationValue: `${station.environment.windSpeed.toFixed(1)} km/h`,
      hqValue: `${Number(hq.environment.windSpeed?.value ?? 0).toFixed(1)} km/h`,
      hqAge: hq.environment.windSpeed?.age ?? 0,
      hqFreshness: hq.environment.windSpeed?.freshness ?? Freshness.STALE,
      isDifferent: Math.abs(station.environment.windSpeed - Number(hq.environment.windSpeed?.value ?? 0)) > 3,
    },
    {
      label: 'Power Gen',
      stationValue: `${station.energy.powerGeneration.toFixed(1)} kW`,
      hqValue: `${Number(hq.energy.powerGeneration?.value ?? 0).toFixed(1)} kW`,
      hqAge: hq.energy.powerGeneration?.age ?? 0,
      hqFreshness: hq.energy.powerGeneration?.freshness ?? Freshness.STALE,
      isDifferent: Math.abs(station.energy.powerGeneration - Number(hq.energy.powerGeneration?.value ?? 0)) > 2,
    },
    {
      label: 'Power Load',
      stationValue: `${station.energy.powerLoad.toFixed(1)} kW`,
      hqValue: `${Number(hq.energy.powerLoad?.value ?? 0).toFixed(1)} kW`,
      hqAge: hq.energy.powerLoad?.age ?? 0,
      hqFreshness: hq.energy.powerLoad?.freshness ?? Freshness.STALE,
      isDifferent: Math.abs(station.energy.powerLoad - Number(hq.energy.powerLoad?.value ?? 0)) > 2,
    },
    {
      label: 'Battery',
      stationValue: `${station.energy.batteryLevel.toFixed(1)}%`,
      hqValue: `${Number(hq.energy.batteryLevel?.value ?? 0).toFixed(1)}%`,
      hqAge: hq.energy.batteryLevel?.age ?? 0,
      hqFreshness: hq.energy.batteryLevel?.freshness ?? Freshness.STALE,
      isDifferent: Math.abs(station.energy.batteryLevel - Number(hq.energy.batteryLevel?.value ?? 0)) > 3,
    },
    {
      label: 'Fuel',
      stationValue: `${station.fuel.fuelPercentage.toFixed(1)}%`,
      hqValue: `${Number(hq.fuel.fuelPercentage?.value ?? 0).toFixed(1)}%`,
      hqAge: hq.fuel.fuelPercentage?.age ?? 0,
      hqFreshness: hq.fuel.fuelPercentage?.freshness ?? Freshness.STALE,
      isDifferent: Math.abs(station.fuel.fuelPercentage - Number(hq.fuel.fuelPercentage?.value ?? 0)) > 2,
    },
    {
      label: 'Gen 1',
      stationValue: station.equipment.find((e) => e.id === 'gen1')?.status ?? 'UNKNOWN',
      hqValue: String(hq.equipment.gen1?.value ?? 'UNKNOWN'),
      hqAge: hq.equipment.gen1?.age ?? 0,
      hqFreshness: hq.equipment.gen1?.freshness ?? Freshness.STALE,
      isDifferent: (station.equipment.find((e) => e.id === 'gen1')?.status ?? '') !== String(hq.equipment.gen1?.value ?? ''),
    },
    {
      label: 'Gen 2',
      stationValue: station.equipment.find((e) => e.id === 'gen2')?.status ?? 'UNKNOWN',
      hqValue: String(hq.equipment.gen2?.value ?? 'UNKNOWN'),
      hqAge: hq.equipment.gen2?.age ?? 0,
      hqFreshness: hq.equipment.gen2?.freshness ?? Freshness.STALE,
      isDifferent: (station.equipment.find((e) => e.id === 'gen2')?.status ?? '') !== String(hq.equipment.gen2?.value ?? ''),
    },
  ];

  const equipStatusColor = (status: string) => {
    switch (status) {
      case EquipmentStatus.OPERATIONAL: return 'text-green-400';
      case EquipmentStatus.WARNING: return 'text-amber-400';
      case EquipmentStatus.FAILED: return 'text-red-400';
      case EquipmentStatus.OFFLINE: return 'text-slate-500';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Station Truth */}
      <div className="card border-emerald-500/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d39980' }} />
          <span className="card-header mb-0">Station Truth</span>
        </div>
        <div className="space-y-0">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-[#2a3a4e]/50 last:border-0">
              <span className="text-xs text-slate-400">{row.label}</span>
              <span className={`text-sm font-semibold font-[tabular-nums] ${
                row.label.startsWith('Gen') ? equipStatusColor(row.stationValue) : 'text-emerald-400'
              }`}>
                {row.stationValue}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* HQ Knowledge */}
      <div className="card border-blue-500/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-blue-400" style={{ boxShadow: '0 0 6px #3b82f680' }} />
          <span className="card-header mb-0">HQ Knowledge</span>
        </div>
        <div className="space-y-0">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-[#2a3a4e]/50 last:border-0">
              <span className="text-xs text-slate-400">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold font-[tabular-nums] ${
                  row.isDifferent ? 'text-amber-400' : row.label.startsWith('Gen') ? equipStatusColor(row.hqValue) : 'text-blue-400'
                }`}>
                  {row.hqValue}
                </span>
                <span className={`text-[10px] ${freshnessColor(row.hqFreshness)}`}>
                  {formatAge(row.hqAge)} · {row.hqFreshness}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
