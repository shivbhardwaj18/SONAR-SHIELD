import React from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Cpu, 
  Database, 
  Layers, 
  Radio, 
  Eye, 
  Compass, 
  FileText,
  Sparkles,
  BookOpen,
  HelpCircle
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, health, currentSurvey, onOpenGuide }) {
  const tabs = [
    { id: 'ingestion', label: 'Survey Ingestion', icon: Layers, badge: currentSurvey?.total_images || 0 },
    { id: 'analysis', label: 'Sonar Analysis', icon: Radio, phase: 'Phase 2-3' },
    { id: 'evidence', label: 'Evidence Intelligence', icon: Eye, phase: 'Phase 4-7' },
    { id: 'hotspots', label: 'Debris Hotspots', icon: Compass, phase: 'Phase 10-12' },
    { id: 'reports', label: 'Reports & Export', icon: FileText, phase: 'Phase 14' }
  ];

  return (
    <header className="border-b border-cyan-950/60 bg-[#070d1c]/90 backdrop-blur-md sticky top-0 z-50">
      {/* Top Status Strip */}
      <div className="px-6 py-2 border-b border-slate-800/40 flex flex-wrap items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${health?.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${health?.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-slate-400">CORE API:</span>
            <span className="text-emerald-400 font-semibold">{health?.status || 'CONNECTING...'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Cpu size={13} className="text-cyan-400" />
            <span className="text-slate-400">YOLO DETECTOR:</span>
            <span className={health?.model_loaded ? "text-cyan-300 font-medium" : "text-amber-400"}>
              {health?.model_loaded ? 'ONLINE (best.pt)' : 'UNAVAILABLE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Database size={13} className="text-blue-400" />
            <span className="text-slate-400">PERSISTENCE:</span>
            <span className="text-blue-300 font-medium">{health?.database || 'SQLite'}</span>
          </div>
        </div>

        {/* Right Header Status Strip */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600/30 to-teal-600/30 hover:from-cyan-600/50 hover:to-teal-600/50 border border-cyan-400/50 text-cyan-200 rounded-full font-bold text-[11px] shadow-sm shadow-cyan-500/20 transition-all cursor-pointer animate-pulse"
          >
            <Sparkles size={12} className="text-yellow-300" />
            <span>Judge Guide & System Architecture</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-0.5 rounded text-[11px] text-cyan-300">
            <span>GEOLOCATION: <strong>DEMO / SIMULATED COORDINATES</strong></span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10">
            <ShieldAlert size={22} className="text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-tech text-xl font-bold tracking-wider text-white">
                SONAR<span className="text-cyan-400">-SHIELD</span>
              </h1>
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold">
                SIH 2026 #26057
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans tracking-wide">
              Automated Marine Debris & Sonar Evidence Intelligence System
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-cyan-400' : 'text-slate-500'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="bg-cyan-950 text-cyan-300 text-[10px] font-mono px-1.5 py-0.2 rounded border border-cyan-800">
                    {tab.badge}
                  </span>
                )}
                {tab.phase && (
                  <span className="text-[9px] font-mono text-slate-500 bg-slate-950/80 px-1 rounded">
                    {tab.phase}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
