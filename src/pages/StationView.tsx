import { useSimulationStore } from '../store/simulationStore';
import { useUIStore } from '../store/uiStore';
import { EquipmentStatus } from '../types';

const moduleLayout: { id: string; x: number; y: number; w: number; h: number }[] = [
  { id: 'control', x: 200, y: 50, w: 160, h: 100 },
  { id: 'comms', x: 400, y: 50, w: 140, h: 100 },
  { id: 'living', x: 50, y: 50, w: 120, h: 100 },
  { id: 'medical', x: 50, y: 190, w: 120, h: 90 },
  { id: 'generator', x: 200, y: 190, w: 160, h: 90 },
  { id: 'hvac', x: 400, y: 190, w: 140, h: 90 },
  { id: 'fuel', x: 50, y: 320, w: 160, h: 80 },
  { id: 'storage', x: 250, y: 320, w: 160, h: 80 },
];

const statusColors: Record<EquipmentStatus, { fill: string; stroke: string }> = {
  [EquipmentStatus.OPERATIONAL]: { fill: '#0f2a1a', stroke: '#22c55e' },
  [EquipmentStatus.WARNING]: { fill: '#2a1f0a', stroke: '#f59e0b' },
  [EquipmentStatus.FAILED]: { fill: '#2a0f0f', stroke: '#ef4444' },
  [EquipmentStatus.OFFLINE]: { fill: '#1a1a2a', stroke: '#64748b' },
};

export function StationView() {
  const modules = useSimulationStore((s) => s.station.modules);
  const selectedModule = useUIStore((s) => s.selectedModule);
  const setSelectedModule = useUIStore((s) => s.setSelectedModule);

  const selectedData = modules.find((m) => m.id === selectedModule);

  return (
    <div className="p-4 space-y-4">
      <div className="card">
        <div className="card-header">Station Schematic — Maitri/Bharati Research Station</div>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* SVG Schematic */}
          <div className="flex-1 overflow-auto">
            <svg viewBox="0 0 600 440" className="w-full max-w-2xl">
              {/* Background */}
              <rect x="0" y="0" width="600" height="440" fill="#0a0f1a" rx="8" />
              
              {/* Grid lines */}
              {Array.from({ length: 12 }, (_, i) => (
                <line key={`vg${i}`} x1={i * 50} y1="0" x2={i * 50} y2="440" stroke="#1a2332" strokeWidth="0.5" />
              ))}
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`hg${i}`} x1="0" y1={i * 50} x2="600" y2={i * 50} stroke="#1a2332" strokeWidth="0.5" />
              ))}

              {/* Connection lines between modules */}
              <line x1="170" y1="100" x2="200" y2="100" stroke="#2a3a4e" strokeWidth="2" strokeDasharray="4" />
              <line x1="360" y1="100" x2="400" y2="100" stroke="#2a3a4e" strokeWidth="2" strokeDasharray="4" />
              <line x1="280" y1="150" x2="280" y2="190" stroke="#2a3a4e" strokeWidth="2" strokeDasharray="4" />
              <line x1="110" y1="150" x2="110" y2="190" stroke="#2a3a4e" strokeWidth="2" strokeDasharray="4" />
              <line x1="470" y1="150" x2="470" y2="190" stroke="#2a3a4e" strokeWidth="2" strokeDasharray="4" />
              <line x1="130" y1="280" x2="130" y2="320" stroke="#2a3a4e" strokeWidth="2" strokeDasharray="4" />
              <line x1="330" y1="280" x2="330" y2="320" stroke="#2a3a4e" strokeWidth="2" strokeDasharray="4" />

              {/* Modules */}
              {moduleLayout.map((layout) => {
                const module = modules.find((m) => m.id === layout.id);
                if (!module) return null;
                const colors = statusColors[module.status];
                const isSelected = selectedModule === layout.id;

                return (
                  <g
                    key={layout.id}
                    onClick={() => setSelectedModule(isSelected ? null : layout.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={layout.x}
                      y={layout.y}
                      width={layout.w}
                      height={layout.h}
                      fill={colors.fill}
                      stroke={isSelected ? '#06b6d4' : colors.stroke}
                      strokeWidth={isSelected ? 2 : 1}
                      rx="4"
                      opacity={0.9}
                    />
                    {/* Module name */}
                    <text
                      x={layout.x + layout.w / 2}
                      y={layout.y + 20}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {module.name}
                    </text>
                    {/* Status indicator */}
                    <circle
                      cx={layout.x + layout.w - 12}
                      cy={layout.y + 12}
                      r="4"
                      fill={colors.stroke}
                    />
                    {/* Temperature */}
                    {module.temperature !== undefined && (
                      <text
                        x={layout.x + layout.w / 2}
                        y={layout.y + 40}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="10"
                      >
                        {module.temperature}°C
                      </text>
                    )}
                    {/* Power draw */}
                    {module.powerDraw !== undefined && (
                      <text
                        x={layout.x + layout.w / 2}
                        y={layout.y + 55}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="9"
                      >
                        {module.powerDraw} kW
                      </text>
                    )}
                    {/* Status text */}
                    <text
                      x={layout.x + layout.w / 2}
                      y={layout.y + layout.h - 10}
                      textAnchor="middle"
                      fill={colors.stroke}
                      fontSize="9"
                      fontWeight="500"
                    >
                      {module.status}
                    </text>
                  </g>
                );
              })}

              {/* Station label */}
              <text x="300" y="425" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="500">
                ANTARCTIC RESEARCH STATION — SYNTHETIC LAYOUT
              </text>
            </svg>
          </div>

          {/* Module Detail Panel */}
          <div className="w-full lg:w-72">
            {selectedData ? (
              <div className="card">
                <div className="card-header">{selectedData.name} — Details</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Status</span>
                    <span className={`font-semibold ${
                      selectedData.status === EquipmentStatus.OPERATIONAL ? 'text-green-400' :
                      selectedData.status === EquipmentStatus.WARNING ? 'text-amber-400' :
                      selectedData.status === EquipmentStatus.FAILED ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {selectedData.status}
                    </span>
                  </div>
                  {selectedData.temperature !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Temperature</span>
                      <span className="text-blue-400">{selectedData.temperature}°C</span>
                    </div>
                  )}
                  {selectedData.powerDraw !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Power Draw</span>
                      <span className="text-yellow-400">{selectedData.powerDraw} kW</span>
                    </div>
                  )}
                  {selectedData.occupancy !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Occupancy</span>
                      <span className="text-cyan-400">{selectedData.occupancy} personnel</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card text-center">
                <p className="text-xs text-slate-500">Click a module to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
