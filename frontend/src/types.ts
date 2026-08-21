export type Severity = 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ThreatLevel = 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'NEW' | 'TRIAGE' | 'INVESTIGATING' | 'CONTAINMENT' | 'ERADICATION' | 'RECOVERY' | 'CLOSED' | 'RESOLVED' | 'RESOLVED';

export interface NormalizedEvent {
  event_id: string;
  timestamp: string;
  source: string;
  source_type: string;
  hostname?: string;
  host_id?: string;
  username?: string;
  process_name?: string;
  parent_process?: string;
  pid?: number;
  parent_pid?: number;
  command_line?: string;
  src_ip?: string;
  src_port?: number;
  dst_ip?: string;
  dst_port?: number;
  protocol?: string;
  domain?: string;
  url?: string;
  file_path?: string;
  file_hash?: string;
  event_type: string;
  event_category: string;
  severity: Severity;
  rule_id?: string;
  rule_name?: string;
  ioc_type?: string;
  ioc_value?: string;
  raw_event: any;
  confidence?: number;
  mitre_tactic?: string;
  mitre_technique?: string;
  incident_id?: string;
}

export interface Alert {
  alert_id: string;
  timestamp: string;
  rule_name: string;
  severity: Severity;
  confidence: number;
  events: NormalizedEvent[];
  mitre_tactic?: string;
  mitre_technique?: string;
  incident_id?: string;
  /** Number of duplicate events aggregated into this alert (dedup window). */
  count?: number;
}

export interface Incident {
  incident_id: string;
  title: string;
  severity: Severity;
  confidence: number;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  affected_assets: string[];
  affected_users: string[];
  alerts: Alert[];
  events: NormalizedEvent[];
  iocs: { type: string; value: string; malicious?: boolean; source?: string }[];
  mitre_techniques: string[];
  ai_analysis?: AIAnalysis;
  case_owner?: string;
  case_notes?: { timestamp: string; author: string; content: string }[];
  case_tasks?: { id: string; title: string; completed: boolean }[];
  case_evidence?: { type: string; value: string; added_at: string }[];
  blocked_ips?: string[];
}

export interface AIAnalysis {
  classification: string;
  severity: Severity;
  confidence: number;
  attack_stage: string;
  what_happened: string;
  why_suspicious: string;
  evidence: string[];
  mitre_candidates: string[];
  recommended_investigation: string[];
  recommended_response: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface SystemState {
  mode: 'LIVE';
  telemetrySource: 'REAL';
  threatLevel: ThreatLevel;
  activeIncidents: number;
  highAlerts: number;
  eps: number;
  totalEndpoints: number;
  autonomousDefense: boolean;
}

