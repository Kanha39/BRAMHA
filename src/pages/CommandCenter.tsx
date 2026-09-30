import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { MetricCard } from '../components/MetricCard';
import { StationTruthVsHQ } from '../components/StationTruthVsHQ';
import { AlertBanner } from '../components/AlertBanner';
import { TelemetryCharts } from '../components/TelemetryCharts';
import { AuditLog } from '../components/AuditLog';
import { DecisionPanel } from '../components/DecisionPanel';
import { CommActivity } from '../components/CommActivity';
import { Freshness, LinkState } from '../types';

export function CommandCenter() {
  const station = useSimulationStore((s) => s.station);
  const hq = useCommunicationStore((s) => s.hq);
  const linkState = useCommunicationStore((s) => s.comm.linkState);
  const scenario = useSimulationStore((s) => s.scenario);

  const stationHealthPct = Math.round(
    (
      (station.energy.batteryLevel / 100) * 25 +
      (station.fuel.fuelPercentage / 100) * 25 +
      (station.energy.powerGeneration / station.energy.powerLoad > 1 ? 25 : (station.energy.powerGeneration / station.energy.powerLoad) * 25) +
      (linkState === LinkState.ONLINE ? 25 : linkState === LinkState.DEGRADED ? 12.5 : 0)
    )
  );

  const healthColor = stationHealthPct >= 70 ? 'text-green-400' : stationHealthPct >= 40 ? 'text-amber-400' : 'text-red-400';
  const autoColor = station.daysOfAutonomy >= 60 ? 'text-green-400' : station.daysOfAutonomy >= 30 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-3 p-4">
      <AlertBanner />

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <MetricCard
          label="Autonomy"
          value={station.daysOfAutonomy}
          unit=" days"
          icon="🛡"
          color={autoColor}
          hqValue={Number(hq.daysOfAutonomy.value)}
          hqAge={hq.daysOfAutonomy.age}
          hqFreshness={hq.daysOfAutonomy.freshness}
        />
        <MetricCard
          label="Station Health"
          value={stationHealthPct}
          unit="%"
          icon="❤"
          color={healthColor}
        />
        <MetricCard
          label="Power"
          value={station.energy.powerLoad.toFixed(1)}
          unit=" kW"
          icon="⚡"
          color="text-yellow-400"
          trend={station.energy.powerLoad > station.energy.powerGeneration ? 'up' : 'stable'}
        />
        <MetricCard
          label="Battery"
          value={station.energy.batteryLevel.toFixed(1)}
          unit="%"
          icon="🔋"
          color={station.energy.batteryLevel > 50 ? 'text-green-400' : 'text-amber-400'}
          trend={station.energy.powerLoad > station.energy.powerGeneration ? 'down' : 'stable'}
        />
        <MetricCard
          label="Fuel"
          value={station.fuel.fuelPercentage.toFixed(1)}
          unit="%"
          icon="⛽"
          color={station.fuel.fuelPercentage > 40 ? 'text-cyan-400' : 'text-amber-400'}
          trend="down"
        />
        <MetricCard
          label="Temperature"
          value={station.environment.temperature.toFixed(1)}
          unit="°C"
          icon="🌡"
          color="text-blue-400"
        />
        <MetricCard
          label="Wind"
          value={station.environment.windSpeed.toFixed(1)}
          unit=" km/h"
          icon="💨"
          color={station.environment.windSpeed > 50 ? 'text-red-400' : 'text-slate-400'}
        />
      </div>

      {/* Station Truth vs HQ */}
      <StationTruthVsHQ />

      {/* Charts */}
      <TelemetryCharts />

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <DecisionPanel />
        <CommActivity />
        <AuditLog />
      </div>

      <div className="text-center synthetic-notice py-2">
        ● Synthetic simulation data — Not connected to real station
      </div>
    </div>
  );
}
