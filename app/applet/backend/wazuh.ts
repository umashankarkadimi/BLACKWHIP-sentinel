export async function getAgents() {
  return [
    { id: '001', name: 'WIN-DB-SERVER-01', status: 'active', ip: '10.0.0.10', os: 'Windows Server 2022' },
    { id: '002', name: 'WIN-WEB-SERVER-02', status: 'active', ip: '10.0.0.11', os: 'Windows Server 2022' },
    { id: '003', name: 'LINUX-APP-01', status: 'disconnected', ip: '10.0.0.12', os: 'Ubuntu 22.04' },
    { id: '004', name: 'DESKTOP-X9201', status: 'active', ip: '10.0.5.55', os: 'Windows 11' }
  ];
}

export async function isolateHost(hostname: string) {
  console.log(`[Wazuh] Isolating host: ${hostname}`);
  return { status: 'SUCCESS', details: `Host ${hostname} has been successfully isolated via network quarantine.` };
}
