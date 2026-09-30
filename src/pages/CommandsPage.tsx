import { useState } from 'react';
import { useCommunicationStore } from '../store/communicationStore';
import { useSimulationStore } from '../store/simulationStore';
import { useUIStore } from '../store/uiStore';
import { CommandStatus, Priority, UserRole, type StationBrief } from '../types';
import { generateId, formatTimeShort, priorityColor } from '../utils/helpers';
import { applyLoadReduction } from '../simulation/stationSimulator';
import { estimateByteSize } from '../utils/helpers';

const commandTemplates = [
  { type: 'REDUCE_NONESSENTIAL_LOAD', description: 'Reduce non-essential load to extend station autonomy' },
  { type: 'ACTIVATE_BACKUP_COMMS', description: 'Switch to backup communication array' },
  { type: 'EMERGENCY_FUEL_CONSERVATION', description: 'Enter emergency fuel conservation mode' },
  { type: 'SHELTER_IN_PLACE', description: 'All personnel shelter in living quarters' },
];

const statusColors: Record<CommandStatus, string> = {
  [CommandStatus.PENDING]: 'text-slate-400',
  [CommandStatus.SENT]: 'text-blue-400',
  [CommandStatus.RECEIVED]: 'text-cyan-400',
  [CommandStatus.APPROVED]: 'text-green-400',
  [CommandStatus.VETOED]: 'text-red-400',
  [CommandStatus.EXPIRED]: 'text-slate-500',
};

export function CommandsPage() {
  const role = useUIStore((s) => s.role);
  const commands = useCommunicationStore((s) => s.commands);
  const briefs = useCommunicationStore((s) => s.briefs);
  const createCommand = useCommunicationStore((s) => s.createCommand);
  const updateCommandStatus = useCommunicationStore((s) => s.updateCommandStatus);
  const addBrief = useCommunicationStore((s) => s.addBrief);
  const addAuditEvent = useSimulationStore((s) => s.addAuditEvent);
  const addToQueue = useCommunicationStore((s) => s.addToQueue);

  const [selectedTemplate, setSelectedTemplate] = useState(0);

  // Brief Form State
  const [briefPriority, setBriefPriority] = useState<Priority>(Priority.HIGH);
  const [briefIssue, setBriefIssue] = useState('');
  const [briefImpact, setBriefImpact] = useState('');
  const [briefAction, setBriefAction] = useState('');

  const handleCreateCommand = () => {
    const template = commandTemplates[selectedTemplate];
    const cmd = {
      id: generateId(),
      type: template.type,
      description: template.description,
      priority: Priority.HIGH,
      status: CommandStatus.SENT,
      createdAt: Date.now(),
      expiresAt: Date.now() + 300000, // 5 min expiry
      sentAt: Date.now(),
    };
    createCommand(cmd);
    addAuditEvent({ id: generateId(), timestamp: Date.now(), event: `HQ command created: ${template.type}`, source: 'hq' });
  };

  const handleApprove = (id: string) => {
    updateCommandStatus(id, CommandStatus.APPROVED);
    addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Station leader approved command', source: 'station' });
    // Apply effect
    const cmd = commands.find((c) => c.id === id);
    if (cmd?.type === 'REDUCE_NONESSENTIAL_LOAD') {
      applyLoadReduction();
    }
  };

  const handleVeto = (id: string) => {
    updateCommandStatus(id, CommandStatus.VETOED);
    addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Station leader vetoed command', source: 'station' });
  };

  const handleSendBrief = () => {
    if (!briefIssue || !briefImpact) return;
    const brief: StationBrief = {
      id: generateId(),
      priority: briefPriority,
      issue: briefIssue,
      impact: briefImpact,
      recommendedAction: briefAction,
      createdAt: Date.now(),
      byteSize: estimateByteSize({ issue: briefIssue, impact: briefImpact, recommendedAction: briefAction }),
      transmissionStatus: 'queued',
    };
    addBrief(brief);
    
    // Add to comm queue
    addToQueue({
      id: generateId(),
      telemetry: {
        type: 'STATION_BRIEF',
        value: brief.id,
        timestamp: Date.now(),
        priority: brief.priority,
        byteSize: brief.byteSize,
      },
      status: 'queued',
      createdAt: Date.now(),
    });
    
    addAuditEvent({ id: generateId(), timestamp: Date.now(), event: 'Station Brief queued for transmission', source: 'station' });
    setBriefIssue('');
    setBriefImpact('');
    setBriefAction('');
  };

  return (
    <div className="p-4 space-y-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT COLUMN: Commands */}
      <div className="space-y-4">
        {/* HQ: Create Command */}
        {role === UserRole.HQ_COMMAND && (
          <div className="card">
            <div className="card-header">Create HQ Command</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Command Template</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {commandTemplates.map((tpl, i) => (
                    <button
                      key={tpl.type}
                      onClick={() => setSelectedTemplate(i)}
                      className={`px-3 py-2 text-xs rounded border text-left transition-colors ${
                        selectedTemplate === i
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : 'bg-[#1a2332] text-slate-500 border-[#2a3a4e] hover:text-slate-400'
                      }`}
                    >
                      <div className="font-semibold">{tpl.type.replace(/_/g, ' ')}</div>
                      <div className="text-[10px] mt-0.5 opacity-70">{tpl.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreateCommand}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-sm font-semibold hover:bg-blue-500/30 transition-colors"
              >
                Send Command to Station
              </button>
            </div>
          </div>
        )}

        {/* Station: Approve/Veto */}
        {role === UserRole.STATION_LEADER && (
          <div className="card border-emerald-500/20">
            <div className="card-header">Incoming Commands (Station Leader View)</div>
            <p className="text-xs text-slate-500 mb-3">Review and approve or veto commands from HQ.</p>
          </div>
        )}

        {/* Command List */}
        <div className="card">
          <div className="card-header">Command History</div>
          <div className="space-y-2">
            {commands.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No commands issued</p>
            ) : (
              commands.map((cmd) => {
                const isExpired = cmd.status !== CommandStatus.APPROVED && cmd.status !== CommandStatus.VETOED && Date.now() > cmd.expiresAt;
                const expiresIn = Math.max(0, Math.floor((cmd.expiresAt - Date.now()) / 1000));

                return (
                  <div key={cmd.id} className="bg-[#0d1321] border border-[#2a3a4e] rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">
                          {cmd.type.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-[10px] font-semibold ${priorityColor(cmd.priority)}`}>
                          {cmd.priority}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold ${statusColors[isExpired ? CommandStatus.EXPIRED : cmd.status]}`}>
                        {isExpired ? 'EXPIRED' : cmd.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{cmd.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>ID: {cmd.id}</span>
                      <span>Created: {formatTimeShort(cmd.createdAt)}</span>
                      {!isExpired && cmd.status === CommandStatus.SENT && (
                        <span>Expires in: {expiresIn}s</span>
                      )}
                    </div>
                    {/* Station Leader: Approve/Veto buttons */}
                    {role === UserRole.STATION_LEADER &&
                      (cmd.status === CommandStatus.SENT || cmd.status === CommandStatus.RECEIVED) &&
                      !isExpired && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleApprove(cmd.id)}
                            className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-semibold hover:bg-green-500/30 transition-colors"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleVeto(cmd.id)}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-semibold hover:bg-red-500/30 transition-colors"
                          >
                            ✗ Veto
                          </button>
                        </div>
                      )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Station Briefs */}
      <div className="space-y-4">
        {/* Station Leader: Create Brief */}
        {role === UserRole.STATION_LEADER && (
          <div className="card border-emerald-500/20">
            <div className="card-header">Create Station Brief</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Priority</label>
                <select
                  value={briefPriority}
                  onChange={(e) => setBriefPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2 bg-[#0d1321] border border-[#2a3a4e] rounded text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                >
                  {Object.values(Priority).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Issue</label>
                <input
                  type="text"
                  value={briefIssue}
                  onChange={(e) => setBriefIssue(e.target.value)}
                  placeholder="e.g. Generator 2 unstable"
                  className="w-full px-3 py-2 bg-[#0d1321] border border-[#2a3a4e] rounded text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Impact</label>
                <input
                  type="text"
                  value={briefImpact}
                  onChange={(e) => setBriefImpact(e.target.value)}
                  placeholder="e.g. Power deficit, battery draining"
                  className="w-full px-3 py-2 bg-[#0d1321] border border-[#2a3a4e] rounded text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Recommended Action</label>
                <input
                  type="text"
                  value={briefAction}
                  onChange={(e) => setBriefAction(e.target.value)}
                  placeholder="e.g. Need approval to cut non-essential load"
                  className="w-full px-3 py-2 bg-[#0d1321] border border-[#2a3a4e] rounded text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-500">
                  Estimated size: {estimateByteSize({ issue: briefIssue, impact: briefImpact, recommendedAction: briefAction })} bytes
                </span>
                <button
                  onClick={handleSendBrief}
                  disabled={!briefIssue || !briefImpact}
                  className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-sm font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  Queue Transmission
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Brief History */}
        <div className="card">
          <div className="card-header">Station Briefs History</div>
          <div className="space-y-2">
            {briefs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No briefs transmitted</p>
            ) : (
              briefs.map((brief) => (
                <div key={brief.id} className="bg-[#0d1321] border border-[#2a3a4e] rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-semibold ${priorityColor(brief.priority)}`}>
                      {brief.priority}
                    </span>
                    <span className={`text-[10px] font-semibold ${
                      brief.transmissionStatus === 'sent' ? 'text-green-400' : 'text-amber-400'
                    }`}>
                      {brief.transmissionStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-300"><span className="text-slate-500">Issue:</span> {brief.issue}</p>
                    <p className="text-xs text-slate-300"><span className="text-slate-500">Impact:</span> {brief.impact}</p>
                    {brief.recommendedAction && (
                      <p className="text-xs text-slate-300"><span className="text-slate-500">Action:</span> {brief.recommendedAction}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                    <span>{formatTimeShort(brief.createdAt)}</span>
                    <span>{brief.byteSize}B</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
