import { AttackWorkflow } from './types';

export const attackWorkflows: AttackWorkflow[] = [
  {
    id: 'win-kerberoast',
    name: 'Kerberoasting & Lateral Movement',
    os: 'windows',
    severity: 'Critical',
    description: 'Attacker compromises a low-privilege account, extracts service tickets, cracks them offline, and moves laterally to a Domain Controller.',
    steps: [
      {
        id: 'step-1',
        tactic: 'Initial Access',
        technique: 'Phishing: Spearphishing Link',
        description: 'User clicks a malicious link in an email and downloads a payload.',
        ioc: 'URL: http://malicious-update-domain[.]com/invoice.exe',
        socDetection: 'EDR alerts on execution of unsigned binary from AppData\\Local\\Temp.',
        socResponse: 'Isolate host, pull binary for sandbox analysis, block domain at firewall.'
      },
      {
        id: 'step-2',
        tactic: 'Credential Access',
        technique: 'Steal or Forge Kerberos Tickets: Kerberoasting',
        description: 'Attacker uses Rubeus or PowerShell to request TGS tickets for accounts with SPNs.',
        ioc: 'Event ID 4769: A Kerberos service ticket was requested (Ticket Encryption Type: 0x17 - RC4-HMAC).',
        socDetection: 'SIEM rule triggers on anomalous volume of RC4 ticket requests from a single host.',
        socResponse: 'Disable compromised user account, reset service account passwords.'
      },
      {
        id: 'step-3',
        tactic: 'Lateral Movement',
        technique: 'Remote Services: SMB/Windows Admin Shares',
        description: 'Cracked service account credentials are used to access the C$ share on a sensitive server.',
        ioc: 'Event ID 4624 (Logon Type 3) followed by Event ID 5140 (A network share object was accessed).',
        socDetection: 'UEBA detects unusual lateral movement from a workstation to a Domain Controller.',
        socResponse: 'Hunt for persistence mechanisms (scheduled tasks, services) on the target server.'
      }
    ]
  },
  {
    id: 'win-ransomware',
    name: 'Ransomware Execution (Conti/Ryuk Profile)',
    os: 'windows',
    severity: 'Critical',
    description: 'Rapid encryption of local and networked drives following a successful initial compromise via exposed RDP.',
    steps: [
      {
        id: 'step-1',
        tactic: 'Initial Access',
        technique: 'Exploit Public-Facing Application',
        description: 'Attacker brute-forces an exposed RDP service to gain initial footing.',
        ioc: 'Multiple Event ID 4625 (Failed Logon) followed by Event ID 4624 (Successful Logon Type 10).',
        socDetection: 'SIEM detects rapid failed logins followed by a success from a foreign IP.',
        socResponse: 'Terminate RDP session, block external IP, enforce MFA on all remote access.'
      },
      {
        id: 'step-2',
        tactic: 'Defense Evasion',
        technique: 'Impair Defenses: Disable Windows Defender',
        description: 'Attacker runs a script to disable real-time monitoring and delete shadow copies.',
        ioc: 'Command: vssadmin.exe delete shadows /all /quiet',
        socDetection: 'EDR flags execution of vssadmin.exe attempting to delete volume shadow copies.',
        socResponse: 'Block execution via EDR policy. Initiate incident response playbook for ransomware.'
      },
      {
        id: 'step-3',
        tactic: 'Impact',
        technique: 'Data Encrypted for Impact',
        description: 'Ransomware payload executes, encrypting files and dropping ransom notes.',
        ioc: 'Mass file renaming to .RYUK extension. High disk I/O.',
        socDetection: 'EDR ransomware behavioral detection blocks process (Partial encryption).',
        socResponse: 'Quarantine infected machine. Verify backups. Reimage endpoint.'
      }
    ]
  },
  {
    id: 'mac-gatekeeper',
    name: 'Malicious DMG / Gatekeeper Bypass',
    os: 'macos',
    severity: 'High',
    description: 'Attacker distributes a trojanized DMG file that bypasses Gatekeeper checks using a revoked developer certificate.',
    steps: [
      {
        id: 'step-1',
        tactic: 'Initial Access',
        technique: 'Drive-by Compromise',
        description: 'User downloads a fake Flash Player update (DMG).',
        ioc: 'File Hash (SHA256): 8a9f...e1c4',
        socDetection: 'Web Proxy logs download of executable content from a newly registered domain.',
        socResponse: 'Block domain. Alert user not to open the file.'
      },
      {
        id: 'step-2',
        tactic: 'Execution',
        technique: 'User Execution: Malicious Image',
        description: 'User mounts DMG and runs the binary. Binary strips quarantine attributes.',
        ioc: 'Command: xattr -c /Volumes/FakeUpdate/Install.app',
        socDetection: 'macOS endpoint agent detects execution of xattr to remove com.apple.quarantine.',
        socResponse: 'Kill the installer process. Remove the DMG and app from the system.'
      },
      {
        id: 'step-3',
        tactic: 'Persistence',
        technique: 'Create or Modify System Process: Launch Agent',
        description: 'Malware creates a .plist file in ~/Library/LaunchAgents to run on boot.',
        ioc: 'File creation: ~/Library/LaunchAgents/com.apple.updater.plist',
        socDetection: 'FIM (File Integrity Monitoring) detects unsigned LaunchAgent creation.',
        socResponse: 'Delete the malicious .plist file. Hunt for additional persistence mechanisms.'
      }
    ]
  },
  {
    id: 'mac-keychain',
    name: 'Keychain Exfiltration',
    os: 'macos',
    severity: 'Critical',
    description: 'Attacker gains local access and attempts to dump the macOS Keychain for stored credentials.',
    steps: [
      {
        id: 'step-1',
        tactic: 'Credential Access',
        technique: 'Credentials from Password Stores: Keychain',
        description: 'Attacker runs a custom script using the "security" command-line tool to dump keychain items.',
        ioc: 'Command: security dump-keychain -d login.keychain',
        socDetection: 'Endpoint telemetry flags abnormal usage of the "security" binary by a non-standard process.',
        socResponse: 'Isolate host. Terminate the offending process shell.'
      },
      {
        id: 'step-2',
        tactic: 'Exfiltration',
        technique: 'Exfiltration Over Alternative Protocol',
        description: 'Dumped credentials are Base64 encoded and exfiltrated via DNS tunneling.',
        ioc: 'High volume of DNS TXT queries to attacker-controlled domain (e.g., .ns.evil[.]com).',
        socDetection: 'Network IDS alerts on DNS tunneling signatures (high entropy subdomains).',
        socResponse: 'Sinkhole the attacker domain. Rotate all compromised credentials.'
      }
    ]
  },
  {
    id: 'win-printnightmare',
    name: 'PrintNightmare (CVE-2021-1675)',
    os: 'windows',
    severity: 'Critical',
    description: 'Exploitation of the Windows Print Spooler service to achieve Local Privilege Escalation and System-level code execution.',
    steps: [
      {
        id: 'step-1',
        tactic: 'Privilege Escalation',
        technique: 'Exploitation for Privilege Escalation',
        description: 'Attacker leverages a known vulnerability in spoolsv.exe to load a malicious DLL.',
        ioc: 'Event ID 5014 in Microsoft-Windows-PrintService/Operational. DLL load from %SystemRoot%\\System32\\spool\\drivers.',
        socDetection: 'EDR alerts on spoolsv.exe spawning abnormal child processes (e.g., cmd.exe, powershell.exe).',
        socResponse: 'Isolate host immediately. Stop and disable the Print Spooler service. Patch the system.'
      },
      {
        id: 'step-2',
        tactic: 'Execution',
        technique: 'Command and Scripting Interpreter',
        description: 'The malicious DLL executes a reverse shell back to the attackers C2 server as SYSTEM.',
        ioc: 'Network connection from spoolsv.exe to an external IP on port 443.',
        socDetection: 'Network telemetry detects beaconing behavior originating from a system process.',
        socResponse: 'Block C2 IP at the firewall. Investigate other hosts for similar network traffic.'
      }
    ]
  },
  {
    id: 'win-dcsync',
    name: 'DCSync / Domain Dominance',
    os: 'windows',
    severity: 'Critical',
    description: 'An attacker with elevated privileges mimics a Domain Controller to request password hashes via the Directory Replication Service (DRS) protocol.',
    steps: [
      {
        id: 'step-1',
        tactic: 'Credential Access',
        technique: 'OS Credential Dumping: DCSync',
        description: 'Attacker uses Mimikatz to execute a DCSync attack, extracting the krbtgt account hash.',
        ioc: 'Event ID 4662 (Directory Service Access) containing DS-Replication-Get-Changes and DS-Replication-Get-Changes-All extended rights.',
        socDetection: 'SIEM rule triggers on DCSync replication requests originating from an IP address not associated with a known Domain Controller.',
        socResponse: 'Disable the compromised admin account. Initiate emergency incident response.'
      },
      {
        id: 'step-2',
        tactic: 'Persistence',
        technique: 'Create Account: Golden Ticket',
        description: 'Using the stolen krbtgt hash, the attacker forges a Golden Ticket for persistent, undetectable domain access.',
        ioc: 'Event ID 4769 with a forged Ticket Granting Ticket (TGT) showing an unrealistic expiration time (e.g., 10 years).',
        socDetection: 'UEBA detects TGT requests with anomalous lifetime configurations or encryption downgrade.',
        socResponse: 'Execute a double password reset of the krbtgt account to invalidate all forged tickets.'
      }
    ]
  },
  {
    id: 'mac-tcc-bypass',
    name: 'TCC Bypass & Privacy Access',
    os: 'macos',
    severity: 'High',
    description: 'Malware modifies the Transparency, Consent, and Control (TCC) database to grant itself access to the microphone, camera, and full disk.',
    steps: [
      {
        id: 'step-1',
        tactic: 'Defense Evasion',
        technique: 'Impair Defenses: Modify TCC Database',
        description: 'Attacker exploits a vulnerability or uses Full Disk Access to write directly to /Library/Application Support/com.apple.TCC/TCC.db.',
        ioc: 'File modification event on TCC.db by a non-system binary (e.g., sqlite3).',
        socDetection: 'FIM (File Integrity Monitoring) alerts on unauthorized modification of the TCC database.',
        socResponse: 'Quarantine the offending application. Restore TCC.db from a known good backup.'
      },
      {
        id: 'step-2',
        tactic: 'Collection',
        technique: 'Audio/Video Capture',
        description: 'The malware silently records audio and takes webcam snapshots without triggering user prompts.',
        ioc: 'High CPU/Memory usage by the hidden application; persistent open file handles to AVFoundation frameworks.',
        socDetection: 'Endpoint agent detects background process accessing AV hardware without active UI components.',
        socResponse: 'Kill the process. Revoke permissions and analyze the binary for exfiltration endpoints.'
      }
    ]
  },
  {
    id: 'mac-xcsset',
    name: 'XCSSET Xcode Project Infection',
    os: 'macos',
    severity: 'High',
    description: 'Supply chain attack targeting developers. Malware infects local Xcode projects, injecting malicious payloads into compiled apps.',
    steps: [
      {
        id: 'step-1',
        tactic: 'Execution',
        technique: 'Malicious Build Scripts',
        description: 'Attacker script modifies Xcode project files to include a hidden Run Script build phase.',
        ioc: 'Presence of hidden folders inside .xcodeproj (e.g., xcshareddata/xcschemes/xcuserdata).',
        socDetection: 'EDR detects anomalous execution of osascript or curl triggered as a child process of xcodebuild.',
        socResponse: 'Isolate developer machine. Purge infected project repositories.'
      },
      {
        id: 'step-2',
        tactic: 'Credential Access',
        technique: 'Steal Web Session Cookie',
        description: 'The injected script exploits a zero-day or AppleScript trick to steal Safari cookies, specifically targeting developer portals.',
        ioc: 'AppleScript execution reading from ~/Library/Cookies/Cookies.binarycookies.',
        socDetection: 'Behavioral analytics flag a build script attempting to read browser cookie stores.',
        socResponse: 'Reset all developer portal credentials and revoke active session tokens.'
      }
    ]
  }
];