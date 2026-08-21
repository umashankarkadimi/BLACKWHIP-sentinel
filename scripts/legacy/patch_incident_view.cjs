const fs = require('fs');
let view = fs.readFileSync('frontend/src/components/IncidentView.tsx', 'utf8');

view = view.replace(/const \[isolatedHosts, setIsolatedHosts\] = useState<string\[\]>\(\[\]\);/g, `const [isolatedHosts, setIsolatedHosts] = useState<string[]>([]);
  const [isolationStatus, setIsolationStatus] = useState<Record<string, string>>({});`);

view = view.replace(/const handleIsolate = async \(host: string\) => \{\n    setIsolatedHosts\(prev => \[\.\.\.prev, host\]\);\n    try \{\n        const token = localStorage\.getItem\('soc_token'\);\n        await authFetch\(\`\/api\/incidents\/\$\{incident\.incident_id\}\/action\`, \{\n            method: 'POST',\n            headers: \{ 'Content-Type': 'application\/json', 'Authorization': \`Bearer \$\{token\}\` \},\n            body: JSON\.stringify\(\{ action: 'ISOLATE_HOST', payload: \{ hostname: host \}, incident \}\)\n        \}\);\n    \} catch\(e\) \{ console\.error\(e\); \}\n    if \(user\) logAudit\(user\.uid, user\.email \|\| 'unknown', 'ISOLATE_HOST', \{ incident: incident\.incident_id, host \}\);\n  \};/g, `const handleIsolate = async (host: string) => {
    setIsolationStatus(prev => ({ ...prev, [host]: 'Isolating...' }));
    try {
        const token = localStorage.getItem('soc_token');
        const res = await authFetch(\`/api/incidents/\${incident.incident_id}/action\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
            body: JSON.stringify({ action: 'ISOLATE_HOST', payload: { hostname: host }, incident })
        });
        const data = await res.json();
        if (data && data.result && data.result.status === 'SUCCESS') {
            setIsolationStatus(prev => ({ ...prev, [host]: 'Host Isolated' }));
            setIsolatedHosts(prev => [...prev, host]);
            if (user) logAudit(user.uid, user.email || 'unknown', 'ISOLATE_HOST', { incident: incident.incident_id, host });
        } else {
            setIsolationStatus(prev => ({ ...prev, [host]: 'Isolation Unverified' }));
        }
    } catch(e) {
        console.error(e);
        setIsolationStatus(prev => ({ ...prev, [host]: 'Isolation Unverified' }));
    }
  };`);

view = view.replace(/\{isolatedHosts\.includes\(host\) \? 'Host Isolated' : 'Isolate Host'\}/g, `{isolationStatus[host] || 'Isolate Host'}`);

fs.writeFileSync('frontend/src/components/IncidentView.tsx', view);
