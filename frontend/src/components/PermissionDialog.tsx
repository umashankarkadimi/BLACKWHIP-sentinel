import React from 'react';
import { Shield, AlertTriangle, Key, Terminal, X, Zap } from 'lucide-react';

interface PermissionDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PermissionDialog({ isOpen, onConfirm, onCancel }: PermissionDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-red-500/50 rounded-xl w-full max-w-2xl overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.2)]">
        {/* Header */}
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-500">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            <h2 className="font-bold text-lg tracking-[0.1em]">AUTHORIZATION REQUIRED</h2>
          </div>
          <button onClick={onCancel} className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6 text-neutral-300">
          <p className="text-sm leading-relaxed">
            Enabling <span className="font-bold text-red-400">Autonomous Defense</span> grants the AI engine active mitigation capabilities. 
            To execute machine-speed response playbooks across the enterprise, the following high-level privileges must be granted to the execution engine:
          </p>

          <div className="flex flex-col gap-4">
            {/* Permission 1 */}
            <div className="flex gap-4 p-4 rounded-lg border border-red-500/20 bg-red-950/10">
              <Terminal className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <h3 className="font-bold text-neutral-200 text-sm mb-1 uppercase tracking-wider">Endpoint Control (Kernel Level)</h3>
                <p className="text-xs text-neutral-400 font-mono mb-2">Requires: <span className="text-red-400">NT AUTHORITY\SYSTEM</span> (Win) / <span className="text-red-400">root</span> (macOS/Linux)</p>
                <p className="text-xs text-neutral-500">Allows the engine to aggressively terminate malicious processes, bypass OS-level locks, and isolate compromised hosts from the network at the network-driver level.</p>
              </div>
            </div>

            {/* Permission 2 */}
            <div className="flex gap-4 p-4 rounded-lg border border-red-500/20 bg-red-950/10">
              <Shield className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <h3 className="font-bold text-neutral-200 text-sm mb-1 uppercase tracking-wider">Network Infrastructure API</h3>
                <p className="text-xs text-neutral-400 font-mono mb-2">Requires: <span className="text-red-400">Firewall_Admin_Write</span> / <span className="text-red-400">BGP_Route_Modify</span></p>
                <p className="text-xs text-neutral-500">Allows dynamic modification of edge firewall rules to instantly block command-and-control (C2) IPs and sinkhole malicious DNS requests globally.</p>
              </div>
            </div>

            {/* Permission 3 */}
            <div className="flex gap-4 p-4 rounded-lg border border-red-500/20 bg-red-950/10">
              <Key className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <h3 className="font-bold text-neutral-200 text-sm mb-1 uppercase tracking-wider">Identity & Access Management</h3>
                <p className="text-xs text-neutral-400 font-mono mb-2">Requires: <span className="text-red-400">Directory.ReadWrite.All</span> / <span className="text-red-400">IdP_Global_Admin</span></p>
                <p className="text-xs text-neutral-500">Allows instant suspension of compromised user accounts, forced password resets, and revocation of all active OAuth/SAML session tokens.</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded text-xs text-orange-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p><strong>WARNING:</strong> By authorizing these permissions, the system may autonomously disrupt business operations (e.g., isolating production servers) if a critical threat is detected.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-black border-t border-red-500/20 px-6 py-4 flex justify-end gap-4">
          <button 
            onClick={onCancel}
            className="px-5 py-2.5 rounded text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex items-center gap-2 px-5 py-2.5 rounded text-xs font-bold uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all"
          >
            <Zap className="w-4 h-4" />
            Grant Permissions & Enable
          </button>
        </div>
      </div>
    </div>
  );
}
