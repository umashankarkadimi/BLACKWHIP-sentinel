import React, { useState, useEffect } from 'react';
import { ShieldAlert, Activity, Server, Monitor, Terminal, Shield, ArrowRight, Zap, Target, Lock, Play, Square, ShieldCheck } from 'lucide-react';
import { attackWorkflows } from './data';
import { AttackWorkflow, OSFamily } from './types';

export default function WorkflowSimulator() {
  const [selectedOS, setSelectedOS] = useState<OSFamily>('windows');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<'idle'|'running'|'completed'>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const filteredWorkflows = attackWorkflows.filter(w => w.os === selectedOS);
  const selectedWorkflow = attackWorkflows.find(w => w.id === selectedWorkflowId);

  // Reset simulation when workflow changes
  useEffect(() => {
    setSimulationStatus('idle');
    setCurrentStepIndex(0);
  }, [selectedWorkflowId]);

  // Simulation timer loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (simulationStatus === 'running' && selectedWorkflow) {
      if (currentStepIndex < selectedWorkflow.steps.length) {
        timer = setTimeout(() => {
          setCurrentStepIndex(prev => prev + 1);
        }, 3500); // Wait 3.5 seconds before revealing the next step
      } else {
        setSimulationStatus('completed');
      }
    }
    return () => clearTimeout(timer);
  }, [simulationStatus, currentStepIndex, selectedWorkflow]);

  const handleStart = () => {
    setCurrentStepIndex(0);
    setSimulationStatus('running');
  };

  const handleStop = () => {
    setSimulationStatus('idle');
    setCurrentStepIndex(0);
  };

  return (
    <div className="flex h-full w-full bg-black text-neutral-300 font-sans overflow-hidden p-6 gap-6">
      
      {/* Sidebar: Selection Panel */}
      <div className="w-80 flex flex-col gap-6">
        <div className="bg-black border border-red-500/20 rounded-xl p-4 flex flex-col gap-4">
          <h2 className="font-bold text-lg text-neutral-50 tracking-[0.1em] flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            ATTACK VECTORS
          </h2>
          
          <div className="flex bg-black border border-red-500/20 rounded-lg overflow-hidden p-1">
            <button 
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${selectedOS === 'windows' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'text-neutral-500 hover:text-neutral-300'}`}
              onClick={() => { setSelectedOS('windows'); setSelectedWorkflowId(null); }}
            >
              Windows
            </button>
            <button 
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${selectedOS === 'macos' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'text-neutral-500 hover:text-neutral-300'}`}
              onClick={() => { setSelectedOS('macos'); setSelectedWorkflowId(null); }}
            >
              macOS
            </button>
          </div>
        </div>

        <div className="bg-black border border-red-500/20 rounded-xl flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-red-500/20 bg-black">
            <h3 className="font-mono text-xs text-neutral-400 uppercase tracking-widest">Available Scenarios</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {filteredWorkflows.map(workflow => (
              <button
                key={workflow.id}
                onClick={() => setSelectedWorkflowId(workflow.id)}
                className={`w-full text-left p-4 rounded-lg mb-2 transition-all border ${selectedWorkflowId === workflow.id ? 'bg-red-500/10 border-red-500/50 text-neutral-50' : 'bg-black border-transparent hover:bg-red-500/5 hover:border-red-500/20 text-neutral-400'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm">{workflow.name}</span>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${workflow.severity === 'Critical' ? 'border-red-600 text-red-500 bg-red-900/30' : 'border-orange-600 text-orange-500 bg-orange-900/30'}`}>
                    {workflow.severity}
                  </span>
                </div>
                <p className="text-xs opacity-70 line-clamp-2">{workflow.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Area: Simulation View */}
      <div className="flex-1 bg-black border border-red-500/20 rounded-xl overflow-hidden flex flex-col relative bg-grid">
        {selectedWorkflow ? (
          <>
            <div className="p-6 border-b border-red-500/20 bg-black/80 backdrop-blur z-10">
              <h1 className="text-2xl font-bold text-neutral-50 flex items-center gap-3">
                <ShieldAlert className="w-7 h-7 text-red-500" />
                {selectedWorkflow.name}
              </h1>
              <p className="text-neutral-400 mt-2 font-mono text-sm max-w-3xl">{selectedWorkflow.description}</p>

              <div className="flex items-center gap-4 mt-6">
                {simulationStatus === 'idle' || simulationStatus === 'completed' ? (
                  <button onClick={handleStart} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded font-bold text-[11px] uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                    <Play className="w-4 h-4" />
                    {simulationStatus === 'completed' ? 'Restart Simulation' : 'Start Simulation'}
                  </button>
                ) : (
                  <button onClick={handleStop} className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-300 px-5 py-2.5 rounded font-bold text-[11px] uppercase tracking-widest transition-colors">
                    <Square className="w-4 h-4" />
                    Abort Simulation
                  </button>
                )}
                
                {simulationStatus === 'running' && (
                  <div className="flex items-center gap-2 text-red-500 font-mono text-xs uppercase animate-pulse border border-red-500/30 bg-red-500/10 px-3 py-1.5 rounded">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    ATTACK IN PROGRESS...
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar z-10 pb-32">
              <div className="max-w-4xl mx-auto flex flex-col gap-8 relative">
                {/* Vertical connecting line */}
                <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-red-500/20 border-l border-dashed border-red-500/40 z-0"></div>

                {selectedWorkflow.steps.map((step, index) => {
                  const isSimulating = simulationStatus !== 'idle';
                  const isPast = isSimulating && index < currentStepIndex;
                  const isCurrent = isSimulating && index === currentStepIndex;
                  const isFuture = isSimulating && index > currentStepIndex;

                  return (
                    <div key={step.id} className={`relative z-10 flex gap-6 group transition-all duration-700 ${isFuture ? 'opacity-20 blur-[2px] pointer-events-none grayscale' : ''} ${isCurrent ? 'scale-[1.02]' : ''}`}>
                      
                      {/* Number / Node */}
                      <div className={`w-14 h-14 rounded-full bg-black border-2 flex items-center justify-center font-bold shrink-0 transition-all duration-500
                        ${isCurrent ? 'border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)]' : ''}
                        ${isPast ? 'border-red-900 text-red-900 bg-red-950/20' : ''}
                        ${!isSimulating ? 'border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] group-hover:scale-110' : ''}
                      `}>
                        {index + 1}
                      </div>

                      {/* Content Card */}
                      <div className={`flex-1 bg-black border rounded-xl overflow-hidden transition-all duration-500 shadow-lg
                        ${isCurrent ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.15)]' : 'border-red-500/30'}
                        ${isPast ? 'border-red-900/50' : ''}
                      `}>
                        {/* Step Header (Attacker Tactic) */}
                        <div className={`border-b p-3 px-5 flex justify-between items-center transition-colors duration-500
                          ${isCurrent ? 'bg-red-500/20 border-red-500/50' : 'bg-red-500/10 border-red-500/20'}
                          ${isPast ? 'bg-red-950/20 border-red-900/30' : ''}
                        `}>
                          <div className={`flex items-center gap-2 ${isPast ? 'text-red-900' : 'text-red-500'}`}>
                            <Terminal className="w-4 h-4" />
                            <span className="font-mono text-xs uppercase tracking-widest font-bold">Tactic: {step.tactic}</span>
                          </div>
                          <div className="flex gap-3 items-center">
                            {isCurrent && (
                              <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-mono animate-pulse bg-red-950 px-2 py-0.5 rounded border border-red-500/50">
                                <Zap className="w-3 h-3 fill-red-400" /> EXECUTING
                              </span>
                            )}
                            {isPast && (
                              <span className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/50">
                                <ShieldCheck className="w-3 h-3" /> MITIGATED
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded font-mono border ${isPast ? 'text-red-900 bg-red-950/10 border-red-900/30' : 'text-red-400 bg-red-900/30 border-red-500/30'}`}>{step.technique}</span>
                          </div>
                        </div>
                        
                        <div className="p-5 flex flex-col gap-4">
                          {/* Attacker Action */}
                          <div className={isPast ? 'opacity-60' : ''}>
                            <p className="text-neutral-200 text-sm leading-relaxed">{step.description}</p>
                            <div className="mt-3 bg-black border border-red-500/20 rounded p-3 text-xs font-mono text-neutral-400 flex flex-col gap-1">
                              <span className="text-red-500/70 text-[10px] uppercase">Indicator of Compromise (IoC)</span>
                              <span className="text-red-400">{step.ioc}</span>
                            </div>
                          </div>

                          {/* SOC Response Section */}
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className={`border p-4 rounded-lg border-l-2 transition-all duration-500 ${isPast ? 'bg-orange-950/10 border-orange-900/20 border-l-orange-900/50 opacity-60' : 'bg-orange-950/20 border-orange-500/20 border-l-orange-500'}`}>
                              <div className={`flex items-center gap-2 mb-2 ${isPast ? 'text-orange-700' : 'text-orange-500'}`}>
                                <Activity className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Detection</span>
                              </div>
                              <p className="text-xs text-neutral-300">{step.socDetection}</p>
                            </div>
                            <div className={`border p-4 rounded-lg border-l-2 transition-all duration-500 ${isPast ? 'bg-emerald-950/10 border-emerald-900/20 border-l-emerald-900/50 opacity-60' : 'bg-emerald-950/20 border-emerald-500/20 border-l-emerald-500'}`}>
                              <div className={`flex items-center gap-2 mb-2 ${isPast ? 'text-emerald-700' : 'text-emerald-500'}`}>
                                <Shield className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Response Playbook</span>
                              </div>
                              <p className="text-xs text-neutral-300">{step.socResponse}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-4 z-10">
            <div className="w-24 h-24 rounded-full bg-red-500/5 border border-red-500/20 flex items-center justify-center">
              <ShieldAlert className="w-10 h-10 text-red-500/50" />
            </div>
            <p className="font-mono text-sm uppercase tracking-widest">Select a scenario to view workflow</p>
          </div>
        )}
      </div>
    </div>
  );
}
