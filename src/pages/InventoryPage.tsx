import { useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { RequisitionStatus } from '../types';
import { generateId, formatTimeShort } from '../utils/helpers';

const statusColors: Record<RequisitionStatus, string> = {
  [RequisitionStatus.REQUESTED]: 'text-blue-400',
  [RequisitionStatus.APPROVED]: 'text-cyan-400',
  [RequisitionStatus.PROCESSING]: 'text-amber-400',
  [RequisitionStatus.IN_TRANSIT]: 'text-purple-400',
  [RequisitionStatus.DELIVERED]: 'text-green-400',
};

export function InventoryPage() {
  const inventory = useSimulationStore((s) => s.inventory);
  const requisitions = useSimulationStore((s) => s.requisitions);
  const addRequisition = useSimulationStore((s) => s.addRequisition);
  const station = useSimulationStore((s) => s.station);

  const [reqItem, setReqItem] = useState('');
  const [reqQty, setReqQty] = useState(1);

  const categories = ['food', 'medicine', 'fuel', 'spare_parts'] as const;

  return (
    <div className="p-4 space-y-4">
      {/* Supplies Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card">
          <div className="card-header">Food Supply</div>
          <div className="metric-value text-green-400">{station.supplies.foodDays}</div>
          <div className="metric-label">days remaining</div>
        </div>
        <div className="card">
          <div className="card-header">Medicine Supply</div>
          <div className="metric-value text-blue-400">{station.supplies.medicineDays}</div>
          <div className="metric-label">days remaining</div>
        </div>
        <div className="card">
          <div className="card-header">Fuel Level</div>
          <div className="metric-value text-cyan-400">{station.fuel.fuelPercentage.toFixed(1)}%</div>
          <div className="metric-label">of capacity</div>
        </div>
        <div className="card">
          <div className="card-header">Consumption Rate</div>
          <div className="metric-value text-amber-400">{station.fuel.consumptionRate.toFixed(1)}</div>
          <div className="metric-label">liters/hour</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory */}
        <div className="card">
          <div className="card-header">Inventory</div>
          <div className="space-y-0">
            {categories.map((cat) => {
              const items = inventory.filter((i) => i.category === cat);
              return (
                <div key={cat}>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold py-1.5 mt-1">
                    {cat.replace('_', ' ')}
                  </div>
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-1 border-b border-[#2a3a4e]/30">
                      <span className="text-xs text-slate-300">{item.name}</span>
                      <span className="text-xs text-slate-400 font-[tabular-nums]">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Requisitions */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">Create Requisition</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={reqItem}
                onChange={(e) => setReqItem(e.target.value)}
                placeholder="Item name"
                className="flex-1 px-3 py-1.5 bg-[#0d1321] border border-[#2a3a4e] rounded text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
              <input
                type="number"
                value={reqQty}
                onChange={(e) => setReqQty(Number(e.target.value))}
                min={1}
                className="w-20 px-3 py-1.5 bg-[#0d1321] border border-[#2a3a4e] rounded text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={() => {
                  if (reqItem.trim()) {
                    addRequisition({
                      id: generateId(),
                      itemName: reqItem,
                      quantity: reqQty,
                      status: RequisitionStatus.REQUESTED,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    });
                    setReqItem('');
                    setReqQty(1);
                  }
                }}
                className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-xs font-semibold hover:bg-cyan-500/30 transition-colors"
              >
                Request
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Requisition History</div>
            <div className="space-y-1">
              {requisitions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-3">No requisitions</p>
              ) : (
                requisitions.map((req) => (
                  <div key={req.id} className="flex items-center justify-between py-1.5 border-b border-[#2a3a4e]/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300">{req.itemName}</span>
                      <span className="text-[10px] text-slate-500">×{req.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold ${statusColors[req.status]}`}>
                        {req.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-600">{formatTimeShort(req.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
