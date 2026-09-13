import React from 'react';
import { 
  Eye, 
  Activity, 
  Cpu, 
  Database, 
  Layers, 
  Radio, 
  Compass, 
  FileText,
  Sparkles,
  BookOpen,
  ScanEye,
  Waves
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
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      {/* Top Status Strip */}
      <div className="px-6 py-1.5 bg-slate-50/80 border-b border-slate-200/60 flex flex-wrap items-center justify-between text-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${health?.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-red-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${health?.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-slate-500 font-medium text-[11px]">CORE API:</span>
            <span className="text-emerald-600 font-bold text-[11px]">{health?.status || 'ONLINE'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Cpu size={12} className="text-sky-600" />
            <span className="text-slate-500 font-medium text-[11px]">YOLO DETECTOR:</span>
            <span className="text-sky-700 font-semibold text-[11px] bg-sky-100/70 px-1.5 py-0.2 rounded border border-sky-200">
              {health?.model_loaded ? 'ONLINE (best.pt)' : 'READY'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Database size={12} className="text-blue-600" />
            <span className="text-slate-500 font-medium text-[11px]">PERSISTENCE:</span>
            <span className="text-slate-700 font-semibold text-[11px]">{health?.database || 'SQLite'}</span>
          </div>
        </div>

        {/* Right Header Status Strip */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-full font-semibold text-[11px] shadow-sm shadow-sky-500/25 transition-all cursor-pointer"
          >
            <Sparkles size={12} className="text-amber-200" />
            <span>Judge Guide & System Architecture</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 bg-sky-50 border border-sky-200/80 px-2.5 py-0.5 rounded-full text-[10px] text-sky-800 font-medium">
            <span>GEOLOCATION: <strong>SIMULATED SURVEY GRID</strong></span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand: SAGAR NETRA */}
        <div className="flex items-center gap-3">
          {/* Unique Oceanic Eye (Netra) Logo Icon */}
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-sky-500/25 border border-white/40 overflow-hidden group">
            {/* Background Subsea Radar Ping Ring */}
            <div className="absolute inset-0 bg-sky-400/20 rounded-2xl animate-ping opacity-25"></div>
            
            {/* Custom Netra / Oceanic Eye SVG Icon */}
            <svg 
              viewBox="0 0 24 24" 
              className="w-6 h-6 text-white relative z-10 transition-transform group-hover:scale-110"
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {/* Outer Eye Outline */}
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
              {/* Iris & Pupil */}
              <circle cx="12" cy="12" r="3.5" fill="rgba(255, 255, 255, 0.25)" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              {/* Radar Sonar Arc Waves */}
              <path d="M12 2.5a9.5 9.5 0 0 1 7 3" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
              <path d="M12 21.5a9.5 9.5 0 0 1-7-3" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-tech text-xl font-extrabold tracking-tight text-slate-900">
                SAGAR <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-blue-600">NETRA</span>
              </h1>
              <span className="bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                SIH 2026 #26057
              </span>
            </div>
            <p className="text-[11px] text-slate-500 tracking-normal font-sans font-medium">
              AI-Powered Underwater Marine Debris & Sonar Evidence Intelligence
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-white text-sky-700 shadow-sm border border-slate-200/90 font-bold' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-sky-600' : 'text-slate-400'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {tab.phase && (
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-200/60 px-1 rounded">
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
