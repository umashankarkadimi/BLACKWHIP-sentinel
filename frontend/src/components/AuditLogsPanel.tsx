import { authFetch } from '../utils';
import React, { useEffect, useState } from 'react';



export default function AuditLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await authFetch('/api/audit');
        const fetchedLogs = await res.json();
        setLogs(fetchedLogs);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="text-center font-mono text-neutral-500 mt-8">Fetching audit trail...</div>;
  if (logs.length === 0) return <div className="text-center font-mono text-neutral-500 mt-8">No audit logs found.</div>;

  return (
    <div className="flex flex-col gap-2">
      {logs.map(log => (
        <div key={log.id} className="p-3 border border-red-500/20 rounded bg-neutral-900/50 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 font-bold uppercase tracking-widest text-[10px]">{log.action}</span>
            <span className="text-neutral-500 text-[10px]">{new Date(log.timestamp).toLocaleString()}</span>
          </div>
          <div className="text-neutral-300 text-xs">
            User: <span className="font-bold text-neutral-100">{log.userEmail}</span>
          </div>
          <div className="text-neutral-500 text-[10px] mt-1 break-all">
            {JSON.stringify(log.details)}
          </div>
        </div>
      ))}
    </div>
  );
}
