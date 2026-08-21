import { authFetch } from './utils';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { SystemState, NormalizedEvent, Incident, Alert } from './types';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import IncidentView from './components/IncidentView';
import EventFeed from './components/EventFeed';
import GlobalChat from './components/GlobalChat';
import SensorsDashboard from './sensors/SensorsDashboard';
import PermissionDialog from './components/PermissionDialog';
import CaseManagement from './components/CaseManagement';
import ThreatHunting from './components/ThreatHunting';
import RuleEngineering from './components/RuleEngineering';
import Workflows from './components/Workflows';
import LoginView from './components/LoginView';
import UserManagement from './components/UserManagement';
import { Activity, ShieldAlert, Shield, ShieldCheck, X, Lock } from 'lucide-react';
import { useAuth } from './lib/AuthProvider';



import AuditLogsPanel from './components/AuditLogsPanel';

export default function App() {
  const { user, role, loading, logOut } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState<'dashboard' | 'workflows' | 'sensors' | 'cases' | 'hunting' | 'rules'>('dashboard');
  const [state, setState] = useState<SystemState>({
    mode: 'LIVE',
    telemetrySource: 'REAL',
    threatLevel: 'LOW',
    activeIncidents: 0,
    highAlerts: 0,
    eps: 0,
    totalEndpoints: 0,
    autonomousDefense: false
  });

  const [events, setEvents] = useState<NormalizedEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const [activeModal, setActiveModal] = useState<'none' | 'settings' | 'profile'>('none');
  const [modalTab, setModalTab] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [showAutoDefenseDialog, setShowAutoDefenseDialog] = useState<boolean>(false);

  useEffect(() => {
    if (!user || role === 'GUEST') return;
    
    // Initial fetch from backend for state
    authFetch('/api/state').then(r => r.json()).then(setState).catch(console.error);
    
    // Merge (not overwrite) fetched data with anything SSE already delivered:
    // dedupe by id and keep newest-first, so a fetch racing the stream can
    // never produce duplicate events/incidents in the UI.
    authFetch('/api/events')
      .then(r => r.json())
      .then((fetched: any[]) => {
        setEvents(prev => {
          const byId = new Map<string, any>();
          for (const e of prev) byId.set(e.event_id, e);
          for (const e of fetched) if (e?.event_id) byId.set(e.event_id, e);
          return [...byId.values()]
            .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
            .slice(0, 100);
        });
      })
      .catch(err => console.error("Error fetching events from backend:", err));

    authFetch('/api/incidents')
      .then(r => r.json())
      .then((fetched: any[]) => {
        setIncidents(prev => {
          const byId = new Map<string, any>();
          for (const i of prev) byId.set(i.incident_id, i);
          for (const i of fetched) if (i?.incident_id) byId.set(i.incident_id, i);
          return [...byId.values()]
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        });
      })
      .catch(err => console.error("Error fetching incidents from backend:", err));

    // SSE stream: uses a short-lived stream token (2 min) fetched from the
    // backend, so the long-lived API JWT never appears in the query string.
    // On disconnect the stream re-fetches a fresh token and reconnects.
    let mounted = true;
    let eventSource: EventSource | null = null;
    let retryTimer: number | null = null;

    const attachHandlers = (es: EventSource) => {
      es.onopen = () => setIsConnected(true);
      es.onerror = () => {
        setIsConnected(false);
        es.close();
        if (mounted && retryTimer === null) {
          retryTimer = window.setTimeout(() => { retryTimer = null; openStream(); }, 3000);
        }
      };
      es.addEventListener('state_update', (e) => setState(JSON.parse(e.data)));
      es.addEventListener('new_event', (e) => {
        const event = JSON.parse(e.data);
        setEvents(prev => [event, ...prev.filter(x => x.event_id !== event.event_id)].slice(0, 100));
      });
      es.addEventListener('new_alert', (e) => {
        const alert = JSON.parse(e.data);
        setAlerts(prev => [alert, ...prev.filter(a => a.alert_id !== alert.alert_id)].slice(0, 20));
      });
      es.addEventListener('alert_updated', (e) => {
        const alert = JSON.parse(e.data);
        setAlerts(prev => [alert, ...prev.filter(a => a.alert_id !== alert.alert_id)].slice(0, 20));
      });
      es.addEventListener('new_incident', (e) => {
        const incident = JSON.parse(e.data);
        setIncidents(prev => [incident, ...prev.filter(i => i.incident_id !== incident.incident_id)]);
      });
      es.addEventListener('incident_updated', (e) => {
        const updated = JSON.parse(e.data);
        setIncidents(prev => prev.map(i => i.incident_id === updated.incident_id ? updated : i));
        setSelectedIncident(prev => prev?.incident_id === updated.incident_id ? updated : prev);
      });
    };

    const openStream = () => {
      if (!mounted) return;
      authFetch('/api/stream/token', { method: 'POST' })
        .then(r => r.json())
        .then((data: any) => {
          if (!mounted || !data.token) return;
          eventSource = new EventSource('/api/stream?token=' + encodeURIComponent(data.token));
          attachHandlers(eventSource);
        })
        .catch(() => {
          if (mounted && retryTimer === null) {
            retryTimer = window.setTimeout(() => { retryTimer = null; openStream(); }, 5000);
          }
        });
    };

    openStream();

    return () => {
      mounted = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      eventSource?.close();
    };
  }, [user, role]);

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className={`h-screen bg-black dark:bg-black ${isDarkMode ? "dark" : ""} text-neutral-50 dark:text-neutral-50 font-sans flex flex-col overflow-hidden bg-grid relative transition-colors duration-300`}>

      <TopBar 
        state={state} 
        alerts={alerts}
        isConnected={isConnected}
        isDarkMode={isDarkMode}
        activeMainTab={activeMainTab}
        onTabChange={setActiveMainTab}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onOpenSettings={(tab) => { setActiveModal('settings'); setModalTab(tab); }}
        onOpenProfile={(tab) => { setActiveModal('profile'); setModalTab(tab); }}
        onToggleDefense={() => {
          if (!state.autonomousDefense) {
            setShowAutoDefenseDialog(true);
          } else {
            authFetch('/api/state/defense', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ active: false })
            });
            setState(s => ({ ...s, autonomousDefense: false }));
          }
        }}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 transition-all duration-300">
          {activeMainTab === 'dashboard' && events.length === 0 && (
            <div className="mb-4 p-3 border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] font-mono rounded flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
              REAL-TIME TELEMETRY: no events received yet — waiting for the Wazuh/OpenSearch collector or POST /api/events/ingest.
            </div>
          )}
          {activeMainTab === 'workflows' ? (
            <Workflows />
          ) : activeMainTab === 'sensors' ? (
            <SensorsDashboard />
          ) : activeMainTab === 'cases' ? (
            <CaseManagement incidents={incidents} onSelectIncident={(i) => { setSelectedIncident(i); setActiveMainTab('dashboard'); }} />
          ) : activeMainTab === 'hunting' ? (
            <ThreatHunting />
          ) : activeMainTab === 'rules' ? (
            <RuleEngineering />
          ) : selectedIncident ? (
            <IncidentView incident={selectedIncident} onBack={() => setSelectedIncident(null)} />
          ) : (
            <Dashboard state={state} incidents={incidents} onSelectIncident={setSelectedIncident} />
          )}
        </div>
        {activeMainTab === 'dashboard' && events.length > 0 && (
          <div className="w-80 bg-black dark:bg-black border-l border-red-500/20 dark:border-red-500/20 flex flex-col shadow-sm transition-all duration-300">
            <div className="p-4 border-b border-red-500/20 dark:border-red-500/20 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-50 dark:text-neutral-50 flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-700 dark:text-red-500" />
                Live Telemetry
              </h2>
              <span className="text-[10px] font-mono bg-black dark:bg-black text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded uppercase tracking-widest">{state.eps} EPS</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EventFeed events={events} />
            </div>
          </div>
        )}
      </div>

      {/* Modals Overlay */}
      <PermissionDialog 
        isOpen={showAutoDefenseDialog}
        onCancel={() => setShowAutoDefenseDialog(false)}
        onConfirm={() => {
          authFetch('/api/state/defense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true })
          });
          setState(s => ({ ...s, autonomousDefense: true }));
          setShowAutoDefenseDialog(false);
        }}
      />
      {activeModal !== 'none' && (
        <div className="absolute inset-0 z-50 bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col relative z-50">
            <div className="flex justify-between items-center p-4 border-b border-red-500/20 dark:border-red-500/20 bg-black dark:bg-black/80">
              <h2 className="text-[12px] font-bold text-red-700 dark:text-red-500 uppercase tracking-widest flex items-center gap-2">
                {activeModal === 'settings' ? 'Platform Settings' : 'Profile Management'}
                <span className="text-neutral-500">/</span>
                <span className="text-neutral-200 dark:text-neutral-200">{modalTab}</span>
              </h2>
              <button onClick={() => setActiveModal('none')} className="text-neutral-500 hover:text-red-700 dark:hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex border-b border-red-500/20 dark:border-red-500/20 overflow-x-auto custom-scrollbar bg-black/50 dark:bg-black/50">
              {(activeModal === 'settings' ? ['Global Config', 'API Management', 'Paul Thresholds', 'Audit Logs'] : ['Access Control', 'Agent Preferences', 'Disconnect']).map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setModalTab(tab)}
                  className={`px-4 py-3 text-[10px] whitespace-nowrap font-bold uppercase tracking-widest transition-all duration-200 ${modalTab === tab ? 'text-red-700 dark:text-red-500 border-b-2 border-red-700 dark:border-red-500 bg-black dark:bg-black' : 'text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-500 hover:bg-black/50 dark:hover:bg-black/50'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6 h-[400px] overflow-y-auto text-neutral-300 dark:text-neutral-300 font-mono text-[12px] custom-scrollbar bg-black dark:bg-black">
              {activeModal === 'profile' && modalTab === 'Disconnect' ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <Activity className="w-12 h-12 text-red-700 dark:text-red-500 animate-pulse" />
                  <div>
                    <h3 className="text-red-700 dark:text-red-500 font-bold uppercase tracking-widest text-lg mb-2">Initiate Disconnect Sequence?</h3>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm max-w-md mx-auto">WARNING: Severing the connection to Paul will terminate active session tokens and disable autonomous SOAR controls from this console.</p>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <button onClick={() => setActiveModal('none')} className="px-6 py-2 border border-red-700 dark:border-red-500/20 hover:bg-black dark:bg-black/80 transition-colors uppercase tracking-widest font-bold text-[10px] rounded-md text-neutral-300 dark:text-neutral-300">Abort</button>
                    <button onClick={() => { setActiveModal('none'); logOut(); }} className="px-6 py-2 bg-red-500/10 dark:bg-red-700/30 border border-red-500/30 dark:border-red-500/30 text-red-700 dark:text-red-500 hover:bg-red-500/20 dark:bg-red-700/30 transition-colors uppercase tracking-widest font-bold text-[10px] rounded-md">Confirm Disconnect</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 border border-red-600/20 bg-red-500/10/50 dark:bg-red-700/30 rounded-lg">
                    <div className="text-red-700 dark:text-red-500 uppercase tracking-widest text-[10px] font-bold mb-2">Module Initialized: {modalTab}</div>
                    <div className="text-neutral-600 dark:text-neutral-400 space-y-2">
                      <p>&gt; Loading configuration parameters...</p>
                      <p>&gt; Validating access tokens...</p>
                      <p className="text-emerald-700">&gt; Status: OK (View-Only Mode Active)</p>
                    </div>
                  </div>
                  
                  {modalTab === 'Global Config' && (
                     <div className="space-y-4 mt-6 px-2">
                        <div className="flex justify-between items-center border-b border-red-500/20 dark:border-red-500/20 pb-3">
                           <span className="uppercase tracking-widest text-[10px] font-bold text-neutral-600 dark:text-neutral-400">Environment</span>
                           <span className="text-red-700 dark:text-red-500 font-bold">PRODUCTION</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-red-500/20 dark:border-red-500/20 pb-3">
                           <span className="uppercase tracking-widest text-[10px] font-bold text-neutral-600 dark:text-neutral-400">Data Retention (Days)</span>
                           <span className="text-red-700 dark:text-red-500 font-bold">90</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-red-500/20 dark:border-red-500/20 pb-3">
                           <span className="uppercase tracking-widest text-[10px] font-bold text-neutral-600 dark:text-neutral-400">Telemetry Forwarding</span>
                           <span className="text-emerald-700 font-bold">ACTIVE</span>
                        </div>
                     </div>
                  )}
                  {modalTab === 'API Management' && (
                     <div className="space-y-4 mt-6 px-2">
                        <div className="flex justify-between items-center border-b border-red-500/20 dark:border-red-500/20 pb-3">
                           <span className="uppercase tracking-widest text-[10px] font-bold text-neutral-600 dark:text-neutral-400">Paul Analysis Engine</span>
                           <span className="text-emerald-700 font-bold">CONNECTED</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-red-500/20 dark:border-red-500/20 pb-3">
                           <span className="uppercase tracking-widest text-[10px] font-bold text-neutral-600 dark:text-neutral-400">Threat Intel Feeds</span>
                           <span className="text-emerald-700 font-bold">SYNCED (2m ago)</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-red-500/20 dark:border-red-500/20 pb-3">
                           <span className="uppercase tracking-widest text-[10px] font-bold text-neutral-600 dark:text-neutral-400">SOAR Webhooks</span>
                           <span className="text-red-700 dark:text-red-500 font-bold">3 ACTIVE</span>
                        </div>
                     </div>
                  )}
                  {modalTab === 'Audit Logs' && <AuditLogsPanel />}
                  {modalTab === 'Access Control' && (role === 'ADMIN' || role === 'ROOT') && <UserManagement />}
                  {(modalTab === 'Agent Preferences' || modalTab === 'Paul Thresholds' || (modalTab === 'Access Control' && role !== 'ADMIN' && role !== 'ROOT')) && (
                    <div className="text-neutral-500 mt-6 text-center italic mt-12 flex flex-col items-center gap-2">
                      <ShieldAlert className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
                      <p>Settings interface locked due to insufficient clearance.<br/>Contact root administrator.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <GlobalChat />
    </div>
  );
}
