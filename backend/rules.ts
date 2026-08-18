export const detectionRules = [
  {
    rule_id: '100001',
    description: 'Multiple failed RDP logins',
    mitre_tactic: 'Credential Access',
    mitre_technique: 'T1110.001', // Password Guessing
    severity: 'HIGH',
    enabled: true,
    condition: {
      event_type: '4625',
      threshold: 5,
      window_seconds: 300 // 5 minutes
    }
  },
  {
    rule_id: '100002',
    description: 'Suspicious PowerShell Download Cradle',
    mitre_tactic: 'Execution',
    mitre_technique: 'T1059.001', // PowerShell
    severity: 'CRITICAL',
    enabled: true,
    condition: {
      command_includes: ['Net.WebClient', 'Invoke-WebRequest', 'IEX'],
      threshold: 1,
      window_seconds: 0
    }
  },
  {
    rule_id: '100003',
    description: 'Scheduled Task Creation',
    mitre_tactic: 'Persistence',
    mitre_technique: 'T1053.005', // Scheduled Task
    severity: 'MEDIUM',
    enabled: true,
    condition: {
      event_type: '4698',
      threshold: 1,
      window_seconds: 0
    }
  },
  {
    rule_id: '100004',
    description: 'OS Credential Dumping',
    mitre_tactic: 'Credential Access',
    mitre_technique: 'T1003', // OS Credential Dumping
    severity: 'CRITICAL',
    enabled: true,
    condition: {
      process_name_includes: ['lsass.exe', 'mimikatz'],
      threshold: 1,
      window_seconds: 0
    }
  }
];
