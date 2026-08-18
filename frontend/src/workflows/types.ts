export type OSFamily = 'windows' | 'macos';

export interface WorkflowStep {
  id: string;
  tactic: string;
  technique: string;
  description: string;
  ioc: string;
  socDetection: string;
  socResponse: string;
}

export interface AttackWorkflow {
  id: string;
  name: string;
  os: OSFamily;
  severity: 'Critical' | 'High' | 'Medium';
  description: string;
  steps: WorkflowStep[];
}
