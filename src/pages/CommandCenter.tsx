import { useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { useCommunicationStore } from '../store/communicationStore';
import { MetricCard } from '../components/MetricCard';
import { StationTruthVsHQ } from '../components/StationTruthVsHQ';
import { AlertBanner } from '../components/AlertBanner';
import { TelemetryCharts } from '../components/TelemetryCharts';
import { AuditLog } from '../components/AuditLog';
import { DecisionPanel } from '../components/DecisionPanel';
import { ForecastCard } from '../components/ForecastCard';
import { CommActivity } from '../components/CommActivity';
import { LinkState } from '../types';
import { startDemo } from '../simulation/demoRunner';

export function CommandCenter() {
  const [showWelcome, setShowWelcome] = useState(true);
  const station = useSimulationStore((s) => s.station);
  const hq = useCommunicationStore((s) => s.hq);
  const linkState = useCommunicationStore((s) => s.comm.linkState);
  const tick = useSimulationStore((s) => s.tick);

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
  const powerReserve = Math.max(0, station.energy.powerGeneration - station.energy.powerLoad);
  const linkColor = linkState === LinkState.ONLINE ? 'text-emerald-400' : linkState === LinkState.DEGRADED ? 'text-amber-400' : 'text-red-400';
  const showLiveWorkspace = tick > 0 || !showWelcome;
  const isLanding = showWelcome && tick === 0;

  return (
    <div className={`mx-auto w-full max-w-[1500px] space-y-5 p-4 lg:p-6 ${isLanding ? 'flex min-h-[calc(100vh-7rem)] flex-col justify-center' : ''}`}>
      {showWelcome && tick === 0 && (
        <section className="rounded-xl border border-cyan-400/20 bg-[linear-gradient(110deg,#101d2d,#111827_58%,#152334)] p-6 shadow-lg shadow-cyan-950/20 lg:p-10" aria-labelledby="welcome-title">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Remote operations / live simulation</p>
              <h1 id="welcome-title" className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl lg:text-5xl">See what HQ does not know.</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 lg:text-base">
                Watch an Antarctic station move from normal operations to crisis while the communication link decides which facts reach headquarters.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                onClick={startDemo}
                className="rounded-lg bg-cyan-300 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-cyan-200"
              >
                Run guided demo
              </button>
              <button
                onClick={() => setShowWelcome(false)}
                className="rounded-lg border border-slate-600 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
              >
                Explore manually
              </button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-3">
            <div><span className="mb-1 block font-semibold text-emerald-300">Station Truth</span><span className="text-slate-400">What is happening right now.</span></div>
            <div><span className="mb-1 block font-semibold text-blue-300">HQ Knowledge</span><span className="text-slate-400">What successfully reached HQ.</span></div>
            <div><span className="mb-1 block font-semibold text-amber-300">Human Decision</span><span className="text-slate-400">What the operator chooses to do.</span></div>
          </div>
        </section>
      )}

      <AlertBanner />

      {/* Primary situation metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          label="Link Status"
          value={linkState}
          icon="◉"
          color={linkColor}
        />
        <MetricCard
          label="Power Reserve"
          value={powerReserve.toFixed(1)}
          unit=" kW"
          icon="⚡"
          color={powerReserve > 10 ? 'text-yellow-300' : 'text-red-400'}
          trend={powerReserve > 10 ? 'stable' : 'up'}
        />
      </div>

      {showLiveWorkspace && (
        <>
          <StationTruthVsHQ />
          <TelemetryCharts />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <ForecastCard />
            <DecisionPanel />
            <CommActivity />
            <AuditLog />
          </div>
        </>
      )}

      <div className="text-center synthetic-notice py-2">
        ● Synthetic simulation data — Not connected to real station
      </div>
    </div>
  );
}
