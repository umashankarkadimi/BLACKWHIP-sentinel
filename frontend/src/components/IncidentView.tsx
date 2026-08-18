import { authFetch } from '../utils';
import React, { useState } from 'react';
import { Incident } from '../types';
import { ArrowLeft, ShieldAlert, Cpu, Activity, Clock, Shield, FileText, Lock, ShieldBan, CheckCircle, Download, AlertCircle, User } from 'lucide-react';
import { getSeverityStyles, getStatusStyles } from './Dashboard';
import { formatTime } from '../utils';
import AttackGraph from './AttackGraph';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../lib/AuthProvider';
import { logAudit } from '../lib/audit';


export default function IncidentView({ incident, onBack }: { incident: Incident, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'GRAPH' | 'TIMELINE' | 'RESPONSE' | 'REPORT' | 'NEXUS'>('SUMMARY');

  return (
    <div className="flex flex-col h-full hud-panel rounded-xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
      
      {/* Header */}
      <div className="p-6 border-b border-red-500/20 dark:border-red-500/20 bg-black dark:bg-black flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-cyan-900/50 rounded-full transition-colors text-neutral-500 hover:text-neutral-300 dark:text-neutral-300">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest uppercase shadow-sm ${getSeverityStyles(incident.severity)}`}>
            {incident.severity}
          </span>
          <h2 className="text-xl font-bold flex-1 text-neutral-50 dark:text-neutral-50 tracking-wide">{incident.title}</h2>
          <span className="font-mono text-[10px] uppercase text-neutral-600 dark:text-neutral-400 tracking-widest">ID: {incident.incident_id}</span>
        </div>
        
        <div className="flex gap-6 text-[10px] font-mono uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>Confidence: {(incident.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-red-700 dark:text-red-500" />
            <span>Status: <span className={`ml-1 px-1.5 py-0.5 rounded-sm border ${getStatusStyles(incident.status)}`}>{incident.status}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Detected: {formatTime(incident.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-red-500/20 dark:border-red-500/20 bg-black/60">
        <Tab button="SUMMARY" active={activeTab} onClick={() => setActiveTab('SUMMARY')} />
        <Tab button="GRAPH" active={activeTab} onClick={() => setActiveTab('GRAPH')} />
        <Tab button="TIMELINE" active={activeTab} onClick={() => setActiveTab('TIMELINE')} />
        <Tab button="RESPONSE" active={activeTab} onClick={() => setActiveTab('RESPONSE')} />
        <Tab button="REPORT" active={activeTab} onClick={() => setActiveTab('REPORT')} />
        <Tab button="NEXUS" active={activeTab} onClick={() => setActiveTab('NEXUS')} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-black/20">
        {activeTab === 'SUMMARY' && <SummaryTab incident={incident} />}
        {activeTab === 'GRAPH' && <AttackGraph incident={incident} />}
        {activeTab === 'TIMELINE' && <TimelineTab incident={incident} />}
        {activeTab === 'RESPONSE' && <ResponseTab incident={incident} />}
        {activeTab === 'REPORT' && <ReportTab incident={incident} />}
        {activeTab === 'NEXUS' && <NexusTab incident={incident} />}
      </div>
    </div>
  );
}

function Tab({ button, active, onClick }: { button: string, active: string, onClick: () => void }) {
  const isActive = active === button;
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 text-[10px] font-bold tracking-[0.15em] uppercase border-b-2 transition-all duration-300 ${
        isActive ? 'border-red-500 text-red-700 dark:text-red-500 bg-black dark:bg-black/80 shadow-sm' : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:text-red-500 hover:border-red-500/20 dark:border-red-500/20'
      }`}
    >
      {button}
    </button>
  );
}

function SummaryTab({ incident }: { incident: Incident }) {
  const ai = incident.ai_analysis;

  return (
    <div className="space-y-6">
      {/* AI Analysis Panel */}
      <div className="hud-panel rounded-xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-1">
          <div className="text-[8px] font-mono bg-red-500/10 dark:bg-red-700/30 text-red-700 dark:text-red-500 px-1.5 py-0.5 rounded border border-red-500/30 dark:border-red-500/30">PAUL.CORE</div>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5 text-red-700 dark:text-red-500" />
          <h3 className="font-bold text-neutral-50 dark:text-neutral-50 uppercase tracking-[0.2em] text-[10px]">Paul SOC Analysis Engine</h3>
        </div>
        
        {ai ? (
          <div className="space-y-6 text-xs">
            <div>
              <h4 className="text-neutral-600 dark:text-neutral-400 uppercase tracking-widest text-[9px] font-bold mb-2">Analysis Report</h4>
              <p className="text-neutral-50 dark:text-neutral-50 leading-relaxed font-mono text-[11px]">{ai.what_happened}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6 border-t border-red-500/20 dark:border-red-500/20 pt-6">
              <div>
                <h4 className="text-neutral-600 dark:text-neutral-400 uppercase tracking-widest text-[9px] font-bold mb-3">Evidence Telemetry</h4>
                <ul className="space-y-2.5">
                  {ai.evidence.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-neutral-500 mt-0.5 font-bold">›</span>
                      <span className="text-neutral-300 dark:text-neutral-300 font-mono text-[10px]">{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-emerald-700 uppercase tracking-widest text-[9px] font-bold mb-3">Suggested Response</h4>
                <ul className="space-y-2.5">
                  {ai.recommended_response.map((resp, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5 font-bold">›</span>
                      <span className="text-emerald-300 font-mono text-[10px]">{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-2 bg-cyan-900/30 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-2 bg-cyan-900/30 rounded"></div>
                <div className="h-2 bg-cyan-900/30 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MITRE ATT&CK */}
      <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <h3 className="font-bold text-neutral-50 dark:text-neutral-50 uppercase tracking-widest text-[10px]">MITRE ATT&CK Map</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {incident.mitre_techniques.map((t, i) => (
            <span key={i} className="bg-black dark:bg-black border border-zinc-800 px-2 py-1 rounded text-[10px] text-neutral-600 dark:text-neutral-400 font-mono">
              {t}
            </span>
          ))}
          {incident.mitre_techniques.length === 0 && (
            <span className="text-neutral-600 dark:text-neutral-400 text-xs italic">No techniques mapped yet.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ incident }: { incident: Incident }) {
  return (
    <div className="relative pl-6 border-l border-red-500/20 dark:border-red-500/20 space-y-8 py-4 ml-4">
      {incident.events.map((e, i) => (
        <div key={i} className="relative">
          <div className="absolute -left-[30px] bg-black dark:bg-neutral-900/50 p-1 rounded-full border border-red-500/20 dark:border-red-500/20">
            <div className={`w-2 h-2 rounded-full ${e.severity === 'CRITICAL' ? 'bg-red-700/30' : e.severity === 'HIGH' ? 'bg-orange-500' : 'bg-blue-500'}`} />
          </div>
          <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-neutral-500 dark:text-neutral-400 text-[10px]">{formatTime(e.timestamp)}</span>
              <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold ${getSeverityStyles(e.severity)}`}>
                {e.severity}
              </span>
            </div>
            <h4 className="font-semibold text-neutral-200 dark:text-neutral-200 text-xs">{e.rule_name || e.event_type}</h4>
            <div className="mt-3 text-[10px] text-neutral-500 dark:text-neutral-400 font-mono grid grid-cols-2 gap-y-2 gap-x-4">
              <div><span className="text-neutral-600 dark:text-neutral-400">SRC:</span> {e.source}</div>
              <div><span className="text-neutral-600 dark:text-neutral-400">HOST:</span> {e.hostname}</div>
              {e.username && <div><span className="text-neutral-600 dark:text-neutral-400">USR:</span> {e.username}</div>}
              {e.process_name && <div><span className="text-neutral-600 dark:text-neutral-400">PROC:</span> {e.process_name}</div>}
              {e.dst_ip && <div><span className="text-neutral-600 dark:text-neutral-400">DST_IP:</span> {e.dst_ip}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResponseTab({ incident }: { incident: Incident }) {
  const { user } = useAuth();
  const [isolatedHosts, setIsolatedHosts] = useState<string[]>([]);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const handleIsolate = async (host: string) => {
    setIsolatedHosts(prev => [...prev, host]);
    const token = localStorage.getItem('soc_token');
    try {
        await authFetch(`/api/incidents/${incident.incident_id}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'ISOLATE_HOST', payload: { hostname: host }, incident })
        });
    } catch(e) { console.error(e); }
    if (user) logAudit(user.uid, user.email || 'unknown', 'ISOLATE_HOST', { incident: incident.incident_id, host });
  };

  const handleBlockIp = (ip: string) => {
    setBlockedIps(prev => [...prev, ip]);
    if (user) logAudit(user.uid, user.email || 'unknown', 'BLOCK_IP', { incident: incident.incident_id, ip });
  };

  const handleResolve = async () => {
    setIsResolving(true);
    const token = localStorage.getItem('soc_token');
    await authFetch(`/api/incidents/${incident.incident_id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'UPDATE_STATUS', payload: { status: 'RESOLVED' }, incident })
    });
    if (user) logAudit(user.uid, user.email || 'unknown', 'RESOLVE_INCIDENT', { incident: incident.incident_id });
    setIsResolving(false);
  };

  // Get unique source IPs from events
  const externalIps = Array.from(new Set(
    incident.events.map(e => e.src_ip).filter(ip => ip && !ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('172.'))
  )) as string[];

  return (
    <div className="space-y-6">
      <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-4 h-4 text-orange-500" />
          <h3 className="font-bold text-neutral-50 dark:text-neutral-50 uppercase tracking-widest text-[10px]">Step 12: Containment & Isolation</h3>
        </div>
        
        <div className="space-y-4">
          {incident.affected_assets.map(host => (
            <div key={host} className="flex items-center justify-between p-4 bg-black dark:bg-neutral-900/50 border border-red-500/20 dark:border-red-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                <div>
                  <div className="text-xs font-bold text-neutral-200 dark:text-neutral-200">{host}</div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">Wazuh Agent / EDR Status: Online</div>
                </div>
              </div>
              <button
                onClick={() => handleIsolate(host)}
                disabled={isolatedHosts.includes(host)}
                className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                  isolatedHosts.includes(host) 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 cursor-not-allowed'
                    : 'bg-orange-500/10 dark:bg-orange-700/30 text-orange-700 dark:text-orange-500 border-orange-500/30 dark:border-orange-500/30 hover:bg-orange-500/20 dark:hover:bg-orange-700/30'
                }`}
              >
                {isolatedHosts.includes(host) ? 'Host Isolated' : 'Isolate Host'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldBan className="w-4 h-4 text-red-600" />
          <h3 className="font-bold text-neutral-50 dark:text-neutral-50 uppercase tracking-widest text-[10px]">Step 13: Eradication & Blocking</h3>
        </div>
        
        {externalIps.length === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400 text-xs italic flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> No external attacker IPs identified in telemetry.
          </div>
        ) : (
          <div className="space-y-4">
            {externalIps.map(ip => (
              <div key={ip} className="flex items-center justify-between p-4 bg-black dark:bg-neutral-900/50 border border-red-500/20 dark:border-red-500/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="text-xs font-bold text-neutral-200 dark:text-neutral-200 font-mono">{ip}</div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">Identified External Threat Actor IP</div>
                  </div>
                </div>
                <button
                  onClick={() => handleBlockIp(ip)}
                  disabled={blockedIps.includes(ip)}
                  className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                    blockedIps.includes(ip) 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 cursor-not-allowed'
                      : 'bg-red-600/10 dark:bg-red-900/30 text-red-900 dark:text-red-600 border-red-600/30 dark:border-red-600/30 hover:bg-red-600/20 dark:hover:bg-red-900/30'
                  }`}
                >
                  {blockedIps.includes(ip) ? 'IP Blocked at Firewall' : 'Block IP'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <h3 className="font-bold text-neutral-50 dark:text-neutral-50 uppercase tracking-widest text-[10px]">Step 15: Incident Closure</h3>
        </div>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
          Verify that containment and eradication steps have been successfully executed before resolving this incident.
        </p>
        <button
          onClick={handleResolve}
          disabled={incident.status === 'RESOLVED' || isResolving}
          className={`w-full py-3 rounded text-xs font-bold uppercase tracking-wider transition-colors border ${
            incident.status === 'RESOLVED'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
          }`}
        >
          {isResolving ? 'Resolving...' : incident.status === 'RESOLVED' ? 'Incident Resolved' : 'Mark as Resolved'}
        </button>
      </div>
    </div>
  );
}

function ReportTab({ incident }: { incident: Incident }) {
  const markdownReport = `# Incident Report: ${incident.title}

**Incident ID:** \`${incident.incident_id}\`  
**Date:** ${new Date().toUTCString()}  
**Severity:** ${incident.severity}  
**Status:** ${incident.status}  

---

## 1. Executive Summary
${incident.ai_analysis?.what_happened || 'No Paul summary available.'}

## 2. Affected Assets
${incident.affected_assets.map(a => '- ' + a).join('\n')}

## 3. MITRE ATT&CK Mapping
${incident.mitre_techniques.length > 0 ? incident.mitre_techniques.map(t => '- ' + t).join('\n') : 'None mapped'}

## 4. IOCs & Evidence
${incident.ai_analysis?.evidence.map(e => '- ' + e).join('\n') || 'None'}

## 5. Timeline of Events
${incident.events.map(e => `- **[${new Date(e.timestamp).toISOString()}]** [${e.severity}] ${e.event_type} - Host: ${e.hostname} | Source: ${e.source}`).join('\n')}

---
*Report auto-generated by BlackWhip SentinelX DFIR Engine*
`;

  const handleDownload = () => {
    const blob = new Blob([markdownReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Incident_Report_${incident.incident_id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-50 dark:text-neutral-50">Post-Incident Report</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Official DFIR documentation for this incident.</p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-blue-400 shadow-lg shadow-blue-900/20"
        >
          <Download className="w-3.5 h-3.5" />
          Download Markdown
        </button>
      </div>

      <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-xl p-8">
        <div className="text-sm text-neutral-300 dark:text-neutral-300 leading-relaxed [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-neutral-50 dark:[&>h1]:text-neutral-50 [&>h1]:mb-6 [&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-neutral-50 dark:[&>h2]:text-neutral-50 [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:pb-2 [&>h2]:border-b [&>h2]:border-red-500/20 dark:[&>h2]:border-red-500/20 [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-6 [&>li]:mb-1.5 [&>hr]:border-red-500/20 dark:[&>hr]:border-red-500/20 [&>hr]:my-8 [&_code]:bg-black dark:[&_code]:bg-black [&_code]:text-neutral-200 dark:[&_code]:text-neutral-200 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono [&_strong]:text-neutral-200 dark:[&_strong]:text-neutral-200">
          <ReactMarkdown>{markdownReport}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function NexusTab({ incident }: { incident: Incident }) {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incident.incident_id, message: userMsg, history: messages, incident })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "PAUL ERROR: CONNECTION LOST." }]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto border border-red-500/20 dark:border-red-500/20 rounded-xl overflow-hidden bg-black dark:bg-black shadow-md">
      <div className="p-4 border-b border-red-500/20 dark:border-red-500/20 bg-black dark:bg-black flex items-center gap-3">
        <Cpu className="w-5 h-5 text-red-700 dark:text-red-500" />
        <h3 className="font-bold text-neutral-50 dark:text-neutral-50 tracking-[0.2em] text-sm uppercase">NEXUS COPILOT INTERROGATOR</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-neutral-600 dark:text-neutral-400 font-mono text-xs uppercase tracking-widest mt-10">
            PAUL CONNECTION ESTABLISHED.<br/><br/>
            YOU MAY INTERROGATE PAUL REGARDING INCIDENT {incident.incident_id}.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl p-4 ${msg.role === 'user' ? 'bg-red-500/10 dark:bg-red-700/30 border border-red-500/30 dark:border-red-500/30 text-neutral-50 dark:text-neutral-50' : 'bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 text-neutral-300 dark:text-neutral-300 shadow-sm'}`}>
              <div className="text-[9px] font-bold tracking-widest uppercase mb-2 opacity-50 flex items-center gap-1.5">
                {msg.role === 'user' ? <User className="w-3 h-3"/> : <Cpu className="w-3 h-3"/>}
                {msg.role === 'user' ? 'SOC Analyst' : 'Paul'}
              </div>
              <div className="text-sm leading-relaxed">
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div className="prose  dark:prose-invert  prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&_code]:text-neutral-200 dark:[&_code]:text-neutral-200 [&_code]:bg-red-500/10 dark:[&_code]:bg-red-700/30 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-black dark:[&_pre]:bg-black [&_pre]:border [&_pre]:border-red-500/20 dark:[&_pre]:border-red-500/20 [&_ul]:my-2 [&_li]:my-0.5">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 text-neutral-500 p-4 rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
              <span className="font-mono text-xs uppercase tracking-widest">Processing...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="p-4 bg-black dark:bg-black border-t border-red-500/20 dark:border-red-500/20">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Paul..." 
            className="flex-1 bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-lg px-4 py-2.5 text-sm text-neutral-50 dark:text-neutral-50 font-mono focus:outline-none focus:border-red-500 focus:shadow-sm transition-all"
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="bg-red-500/10 dark:bg-red-700/30 hover:bg-red-500/20 dark:hover:bg-red-700/30 border border-red-500/30 dark:border-red-500/30 text-red-700 dark:text-red-500 px-6 rounded-lg font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
