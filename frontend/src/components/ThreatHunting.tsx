import { authFetch } from '../utils';
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { NormalizedEvent } from '../types';

export default function ThreatHunting() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NormalizedEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/events/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-neutral-50 flex items-center gap-2">Threat Hunting</h2>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search events by hostname, event_type, IP..."
            className="w-full bg-black border border-red-500/20 rounded pl-10 pr-4 py-2 text-sm text-neutral-200 outline-none focus:border-red-500/50"
          />
        </div>
        <button onClick={handleSearch} disabled={loading} className="px-6 py-2 bg-red-900/30 text-red-500 border border-red-500/30 rounded font-bold uppercase text-xs tracking-widest hover:bg-red-900/50 disabled:opacity-50">
          {loading ? 'Searching...' : 'Hunt'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-black border border-red-500/20 rounded">
        {results.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900 text-neutral-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="p-2">Timestamp</th>
                <th className="p-2">Host</th>
                <th className="p-2">Event Type</th>
                <th className="p-2">Severity</th>
                <th className="p-2">Command Line / Path</th>
              </tr>
            </thead>
            <tbody className="text-neutral-300 font-mono text-[11px]">
              {results.map(ev => (
                <tr key={ev.event_id} className="border-t border-red-500/10 hover:bg-red-500/5">
                  <td className="p-2 whitespace-nowrap">{new Date(ev.timestamp).toLocaleTimeString()}</td>
                  <td className="p-2">{ev.hostname}</td>
                  <td className="p-2 text-cyan-400">{ev.event_type}</td>
                  <td className="p-2">{ev.severity}</td>
                  <td className="p-2 overflow-hidden text-ellipsis whitespace-nowrap max-w-[300px]">{ev.command_line || ev.file_path || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-neutral-500 font-mono text-sm">
            No results found. Try searching for specific hosts or event types.
          </div>
        )}
      </div>
    </div>
  );
}
