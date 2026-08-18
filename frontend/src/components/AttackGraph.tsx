import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, Node, Edge, BackgroundVariant } from 'reactflow';
import 'reactflow/dist/style.css';
import { Incident } from '../types';

export default function AttackGraph({ incident }: { incident: Incident }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // Group events by hostname
    const hostMap = new Map<string, typeof incident.events>();
    incident.events.forEach(e => {
      const key = e.hostname || e.src_ip || 'Unknown';
      if (!hostMap.has(key)) hostMap.set(key, []);
      hostMap.get(key)!.push(e);
    });

    let xOffset = 100;
    
    // Create a node for each host
    hostMap.forEach((events, host) => {
      const hostNodeId = `host-${host}`;
      nodes.push({
        id: hostNodeId,
        position: { x: xOffset, y: 50 },
        data: {
          label: (
            <div className="flex flex-col items-center">
              <span className="text-[12px] font-bold text-cyan-400">{host}</span>
            </div>
          )
        },
        style: {
          background: '#000',
          border: '2px solid #0891b2',
          color: '#fff',
          borderRadius: '4px',
          padding: '8px',
          width: 150
        }
      });

      let yOffset = 150;
      let prevEventNodeId = hostNodeId;

      events.forEach((e, i) => {
        const eventNodeId = `event-${host}-${i}`;
        nodes.push({
          id: eventNodeId,
          position: { x: xOffset - 25, y: yOffset },
          data: {
            label: (
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">{e.event_type}</span>
                {e.process_name && <span className="text-[10px] text-neutral-400 mt-0.5">{e.process_name}</span>}
                {e.rule_name && <span className="text-[8px] mt-2 text-red-600 bg-red-900/30 px-1.5 py-0.5 rounded border border-red-600/30">{e.rule_name}</span>}
              </div>
            )
          },
          style: {
            background: 'transparent',
            border: e.severity === 'CRITICAL' ? '2px dashed #ef4444' : '1px dashed #f97316',
            color: '#d4d4d8',
            borderRadius: '8px',
            padding: '12px',
            width: 200,
          }
        });

        edges.push({
          id: `edge-${prevEventNodeId}-${eventNodeId}`,
          source: prevEventNodeId,
          target: eventNodeId,
          animated: true,
          style: { stroke: '#ef4444' }
        });

        prevEventNodeId = eventNodeId;
        yOffset += 120;
      });

      xOffset += 300;
    });

    return { nodes, edges };
  }, [incident.events]);

  return (
    <div className="h-[600px] w-full bg-black/50 rounded-xl border border-red-500/20 overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background variant={BackgroundVariant.Lines} className="stroke-[#1a1a1a]" gap={20} />
        <Controls className="bg-[#09090b] border-[#1a1a1a] fill-neutral-500" />
      </ReactFlow>
    </div>
  );
}
