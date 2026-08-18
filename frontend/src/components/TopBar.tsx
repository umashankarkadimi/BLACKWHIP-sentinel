import { authFetch } from '../utils';
import React, { useState } from 'react';
import { Shield, Play, Bell, Settings, User, Zap, Crosshair, X, Moon, Sun, LogOut } from 'lucide-react';
import { SystemState } from '../types';
import { useAuth } from '../lib/AuthProvider';

export default function TopBar({ 
  state, 
  isConnected = true,
  isDarkMode = true,
  activeMainTab = 'dashboard',
  onTabChange,
  onToggleDarkMode,
  onOpenSettings,
  onOpenProfile,
  onToggleDefense,
  onToggleMode
}: { 
  state: SystemState;
  isConnected?: boolean;
  isDarkMode?: boolean;
  activeMainTab?: 'dashboard' | 'workflows' | 'sensors' | 'hunting' | 'cases' | 'rules';
  onTabChange?: (tab: 'dashboard' | 'workflows' | 'sensors' | 'hunting' | 'cases' | 'rules') => void;
  onToggleDarkMode?: () => void;
  onOpenSettings?: (tab: string) => void;
  onOpenProfile?: (tab: string) => void;
  onToggleDefense?: () => void;
  onToggleMode: () => void;
}) {
  const { user, role, logOut } = useAuth();
  
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Paul Updated', desc: 'Paul synced successfully.', type: 'info' },
    { id: 2, title: 'Threat Intel Alert', desc: 'New IOC signatures pulled from global C2.', type: 'alert' },
    { id: 3, title: 'SOAR Executed', desc: 'Playbook [Isolate_Host] ran 2 hrs ago.', type: 'info' }
  ]);

  

  const toggleDefense = async () => {
    if (onToggleDefense) {
      onToggleDefense();
    } else {
      await authFetch('/api/state/defense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !state.autonomousDefense })
      });
    }
  };

  const dismissNotification = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="h-14 border-b border-red-500/20 dark:border-red-500/20 bg-black/60 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50 hud-border z-40 relative">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4">
          <div className='w-8 h-8 bg-cyan-900/20 border border-cyan-400/50 flex items-center justify-center rounded-sm'>
            <Shield className="w-4 h-4 text-red-700 dark:text-red-500" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold text-neutral-50 dark:text-neutral-50 tracking-[0.2em]">BLVCKWHIP <span className="text-red-700 dark:text-red-500">SENTINELX</span></h1>
            <div className="flex items-center gap-3 text-[10px] text-neutral-600 dark:text-neutral-400 font-mono uppercase tracking-widest mt-0.5">
              {isConnected ? (
                <>
                  <span className="flex items-center gap-1 text-red-700 dark:text-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
                    SYS.ONLINE
                  </span>
                  <button
                    onClick={onToggleMode}
                    className="bg-black dark:bg-black px-1.5 py-0.5 rounded border border-red-500/20 dark:border-red-500/20 text-red-700 dark:text-red-500 hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    MODE: {state.mode}
                  </button>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-red-700 dark:text-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                    SYS.OFFLINE
                  </span>
                  <span className="bg-red-500/10 dark:bg-red-700/30 px-1.5 py-0.5 rounded border border-rose-900 text-red-700 dark:text-red-500">
                    MODE: DISCONNECTED
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Main Navigation Tabs */}
        <div className="flex items-center gap-2 border-l border-red-500/20 pl-6 h-10">
          <button 
            onClick={() => onTabChange?.('dashboard')}
            className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${
              activeMainTab === 'dashboard' 
                ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => onTabChange?.('workflows')}
            className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${
              activeMainTab === 'workflows' 
                ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Workflows
          </button>
          <button 
            onClick={() => onTabChange?.('sensors')}
            className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${
              activeMainTab === 'sensors' 
                ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Sensors
          </button>
          <button 
            onClick={() => onTabChange?.('cases')}
            className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${
              activeMainTab === 'cases' 
                ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Cases
          </button>
          <button 
            onClick={() => onTabChange?.('hunting')}
            className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${
              activeMainTab === 'hunting' 
                ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Hunting
          </button>
          <button 
            onClick={() => onTabChange?.('rules')}
            className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${
              activeMainTab === 'rules' 
                ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Rules
          </button>
        </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 mr-4">
          <button 
            onClick={toggleDefense}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest border transition-all ${
              state.autonomousDefense 
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                : 'bg-zinc-950/40 text-neutral-500 border-zinc-800 hover:text-neutral-300 dark:text-neutral-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            AUTONOMOUS DEFENSE {state.autonomousDefense ? 'ON' : 'OFF'}
          </button>
          
          
          </div>
        </div>

        <div className="flex gap-4 text-[10px] font-mono text-neutral-600 dark:text-neutral-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5"><div className="w-1 h-1 bg-red-700/30 animate-ping"></div> Telemetry</div>
          <div className="flex items-center gap-1.5"><div className="w-1 h-1 bg-red-700/30"></div> PAUL.CORE</div>
        </div>

        <div className="flex items-center gap-6 text-neutral-600 dark:text-neutral-400 border-l border-red-500/20 dark:border-red-500/20/40 pl-6">
          {/* Notifications */}
          <div className="relative group">
            <button className="p-1 hover:text-red-700 dark:text-red-500 transition-colors flex items-center relative">
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
              )}
            </button>
            <div className="absolute right-0 top-full pt-4 w-64 hidden group-hover:block z-50">
              <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-sm shadow-xl">
                <div className="p-3 flex justify-between items-center border-b border-red-500/20 dark:border-red-500/20 bg-black dark:bg-black/80">
                  <span className="text-[10px] font-bold text-red-700 dark:text-red-500 uppercase tracking-widest">System Notifications</span>
                  {notifications.length > 0 && (
                    <button 
                      onClick={() => setNotifications([])} 
                      className="text-[9px] font-bold text-neutral-500 hover:text-red-700 dark:text-red-500 transition-colors uppercase"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-[10px] font-mono text-neutral-600 dark:text-neutral-400">NO ACTIVE ALERTS</div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className="px-4 py-3 relative group/item hover:bg-black dark:hover:bg-neutral-800 border-b border-red-500/20 dark:border-red-500/20 transition-colors">
                        <button 
                          onClick={(e) => dismissNotification(notif.id, e)}
                          className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-700 dark:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${notif.type === 'alert' ? 'text-red-700 dark:text-red-500' : 'text-neutral-300 dark:text-neutral-300'}`}>
                          {notif.title}
                        </div>
                        <div className="text-[9px] text-neutral-600 dark:text-neutral-400/80 font-mono pr-4">{notif.desc}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Theme Toggle */}
          <button 
            onClick={onToggleDarkMode}
            className="p-1 text-neutral-500 hover:text-red-700 dark:hover:text-red-500 transition-colors"
            title="Toggle Day/Night Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {/* Settings */}
          <div className="relative group">
            <button className="p-1 hover:text-red-700 dark:text-red-500 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full pt-4 w-48 hidden group-hover:block z-50">
              <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-sm shadow-xl">
                <div className="p-3 text-[10px] font-bold text-red-700 dark:text-red-500 uppercase tracking-widest border-b border-red-500/20 dark:border-red-500/20 bg-black dark:bg-black/80">
                  Platform Settings
                </div>
                <div className="flex flex-col py-1">
                  <button onClick={() => onOpenSettings?.('Global Config')} className="px-4 py-2 text-left text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-500 hover:bg-black dark:hover:bg-neutral-800 transition-colors uppercase tracking-widest">Global Config</button>
                  <button onClick={() => onOpenSettings?.('API Management')} className="px-4 py-2 text-left text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-500 hover:bg-black dark:hover:bg-neutral-800 transition-colors uppercase tracking-widest">API Management</button>
                  <button onClick={() => onOpenSettings?.('Paul Thresholds')} className="px-4 py-2 text-left text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-500 hover:bg-black dark:hover:bg-neutral-800 transition-colors uppercase tracking-widest">Paul Thresholds</button>
                  <button onClick={() => onOpenSettings?.('Audit Logs')} className="px-4 py-2 text-left text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-500 hover:bg-black dark:hover:bg-neutral-800 transition-colors uppercase tracking-widest">Audit Logs</button>
                </div>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="relative group">
            {user?.photoURL ? (
              <button className="w-7 h-7 rounded-full overflow-hidden border border-red-500/20 dark:border-red-500/20 hover:border-red-500 transition-colors">
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              </button>
            ) : (
              <button className="p-1 hover:text-red-700 dark:text-red-500 transition-colors bg-black dark:bg-black rounded-full border border-red-500/20 dark:border-red-500/20">
                <User className="w-4 h-4" />
              </button>
            )}
            <div className="absolute right-0 top-full pt-4 w-48 hidden group-hover:block z-50">
              <div className="bg-black dark:bg-black border border-red-500/20 dark:border-red-500/20 rounded-sm shadow-xl">
                <div className="p-3 border-b border-red-500/20 dark:border-red-500/20 bg-black dark:bg-black/80 flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-red-700 dark:text-red-500 uppercase tracking-widest">{user?.displayName || 'SYSTEM_ADMIN'}</span>
                  <span className="text-[9px] text-neutral-600 dark:text-neutral-400 font-mono overflow-hidden text-ellipsis">{user?.email}</span>
                  <span className="text-[9px] font-bold text-cyan-500 bg-cyan-900/20 border border-cyan-500/20 px-1 py-0.5 rounded w-fit mt-1">{role}</span>
                </div>
                <div className="flex flex-col py-1">
                  <button onClick={() => onOpenProfile?.('Access Control')} className="px-4 py-2 text-left text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-500 hover:bg-black dark:hover:bg-neutral-800 transition-colors uppercase tracking-widest">Access Control</button>
                  <button onClick={() => onOpenProfile?.('Agent Preferences')} className="px-4 py-2 text-left text-[10px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-500 hover:bg-black dark:hover:bg-neutral-800 transition-colors uppercase tracking-widest">Agent Preferences</button>
                  <div className="h-px bg-red-900/30 my-1"></div>
                  <button onClick={logOut} className="px-4 py-2 text-left text-[10px] font-bold text-red-700 dark:text-red-500 hover:text-rose-300 hover:bg-rose-950/30 transition-colors uppercase tracking-widest flex items-center justify-between">
                    Log Out <LogOut className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

