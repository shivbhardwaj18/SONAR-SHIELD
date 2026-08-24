import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  MapPin, 
  Compass, 
  Printer, 
  Table, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  ExternalLink, 
  Eye, 
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  fetchSurveyDetections, 
  fetchSurveyHotspots, 
  getDetectionCropUrl 
} from '../api';

const CLASS_COLORS = {
  'shipwreck': { border: '#f97316', text: '#fb923c', fill: 'rgba(249, 115, 22, 0.2)' },
  'tyre': { border: '#f59e0b', text: '#fbbf24', fill: 'rgba(245, 158, 11, 0.2)' },
  'artificial reef': { border: '#06b6d4', text: '#22d3ee', fill: 'rgba(6, 182, 212, 0.2)' },
  'rock': { border: '#10b981', text: '#34d399', fill: 'rgba(16, 185, 129, 0.2)' },
  'sand ripple': { border: '#6366f1', text: '#818cf8', fill: 'rgba(99, 102, 241, 0.2)' }
};

export default function ReportsPanel({ currentSurvey }) {
  const [detections, setDetections] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [loading, setLoading] = useState(false);

  // Load survey data
  const loadData = async () => {
    if (!currentSurvey) return;
    setLoading(true);
    try {
      const [detRes, hsRes] = await Promise.allSettled([
        fetchSurveyDetections(currentSurvey.id),
        fetchSurveyHotspots(currentSurvey.id)
      ]);
      if (detRes.status === 'fulfilled') {
        setDetections(detRes.value.detections || []);
      }
      if (hsRes.status === 'fulfilled') {
        setHotspots(hsRes.value.hotspots || []);
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentSurvey]);

  // Filtered Table Data
  const filteredDetections = useMemo(() => {
    return detections.filter(d => {
      const matchesSearch = !searchQuery || 
        d.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.class_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.operator_notes && d.operator_notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesClass = classFilter === 'ALL' || d.class_name.toLowerCase() === classFilter.toLowerCase();
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [detections, searchQuery, classFilter, statusFilter]);

  // Coordinate normalization for Tactical Map projection
  const mapBounds = useMemo(() => {
    if (detections.length === 0) {
      return { minLat: 18.920, maxLat: 18.926, minLon: 72.830, maxLon: 72.840 };
    }
    const lats = detections.map(d => d.simulated_lat || 18.922);
    const lons = detections.map(d => d.simulated_lon || 72.834);
    const pad = 0.0008;
    return {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLon: Math.min(...lons) - pad,
      maxLon: Math.max(...lons) + pad
    };
  }, [detections]);

  // Project (lat, lon) to (x, y) % on SVG canvas
  const projectCoords = (lat, lon) => {
    const { minLat, maxLat, minLon, maxLon } = mapBounds;
    const xPct = Math.max(5, Math.min(95, ((lon - minLon) / (maxLon - minLon || 0.001)) * 90 + 5));
    const yPct = Math.max(5, Math.min(95, ((maxLat - lat) / (maxLat - minLat || 0.001)) * 90 + 5));
    return { xPct, yPct };
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Actions Bar */}
      <div className="glass-panel p-5 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="text-cyan-400" size={20} />
              <h2 className="font-tech text-lg font-bold text-white tracking-wide">
                GEOSPATIAL TACTICAL MAP & MULTI-FORMAT EXPORT CENTER
              </h2>
              <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono px-2 py-0.5 rounded">
                GIS & Executive Reports
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="text-cyan-300 font-semibold italic">“Interactive nautical spatial mapping and 1-click downloads for maritime operations.”</span>
            </p>
          </div>

          {/* 1-Click Export Buttons */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {currentSurvey && (
              <>
                <a
                  href={`/api/surveys/${currentSurvey.id}/export/csv`}
                  download
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold transition-all cursor-pointer"
                >
                  <Download size={13} className="text-cyan-400" />
                  <span>Download CSV</span>
                </a>

                <a
                  href={`/api/surveys/${currentSurvey.id}/export/geojson`}
                  download
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold transition-all cursor-pointer"
                >
                  <Download size={13} className="text-teal-400" />
                  <span>QGIS / GeoJSON</span>
                </a>

                <a
                  href={`/api/surveys/${currentSurvey.id}/export/json`}
                  download
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold transition-all cursor-pointer"
                >
                  <Download size={13} className="text-amber-400" />
                  <span>JSON Dossier</span>
                </a>

                <a
                  href={`/api/surveys/${currentSurvey.id}/export/report-html`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print Executive Report</span>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Scientific Honesty Disclaimer Banner */}
        <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <Info size={14} className="text-cyan-400 flex-shrink-0" />
          <span>
            <strong className="text-slate-300">SCIENTIFIC HONESTY & SIMULATED COORDINATES:</strong> All latitude/longitude points are deterministically generated on the simulated Arabian Sea Coastal Survey Grid (18.92°N, 72.83°E) for SIH 2026 evaluation.
          </span>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Tactical Nautical GIS Map (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Compass size={16} className="text-cyan-400" />
                INTERACTIVE NAUTICAL GIS TACTICAL MAP
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                Grid: EPSG:4326 (WGS 84)
              </span>
            </div>

            {/* Nautical Radar Canvas */}
            <div className="w-full h-[460px] bg-[#050914] rounded-xl border border-cyan-500/30 relative overflow-hidden flex items-center justify-center p-4">
              {/* Radar Grid Overlay */}
              <div 
                className="absolute inset-0 opacity-15 pointer-events-none" 
                style={{
                  backgroundImage: 'radial-gradient(circle, #00f0ff 1px, transparent 1px)',
                  backgroundSize: '30px 30px'
                }}
              ></div>

              {/* Range Rings */}
              <div className="absolute w-[360px] h-[360px] rounded-full border border-cyan-500/10 pointer-events-none"></div>
              <div className="absolute w-[240px] h-[240px] rounded-full border border-cyan-500/15 pointer-events-none"></div>
              <div className="absolute w-[120px] h-[120px] rounded-full border border-cyan-500/20 pointer-events-none"></div>

              {/* Trackline Navigation Axis */}
              <div className="absolute w-full h-[1px] bg-cyan-500/20 top-1/2 left-0 pointer-events-none"></div>
              <div className="absolute w-[1px] h-full bg-cyan-500/20 left-1/2 top-0 pointer-events-none"></div>

              {/* SVG Canvas for Tracklines, Hotspots & Detections */}
              <svg className="w-full h-full absolute inset-0">
                {/* Survey Transect Path */}
                {detections.length > 1 && (
                  <polyline
                    points={detections
                      .slice(0, 15)
                      .map(d => {
                        const { xPct, yPct } = projectCoords(d.simulated_lat || 18.922, d.simulated_lon || 72.834);
                        return `${xPct}%,${yPct}%`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    className="opacity-40"
                  />
                )}

                {/* Hotspot Cluster Circles */}
                {hotspots.map((hs, idx) => {
                  const { xPct, yPct } = projectCoords(hs.center_lat, hs.center_lon);
                  const isProtected = hs.dominant_class?.toLowerCase() === 'artificial reef';
                  const isP1 = hs.cleanup_priority_level === 'PRIORITY 1';
                  const circleColor = isProtected ? '#06b6d4' : isP1 ? '#ef4444' : '#f59e0b';

                  return (
                    <g key={hs.id} className="cursor-pointer">
                      <circle
                        cx={`${xPct}%`}
                        cy={`${yPct}%`}
                        r="28"
                        fill={circleColor}
                        fillOpacity="0.15"
                        stroke={circleColor}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={`${xPct}%`}
                        y={`${yPct - 3}%`}
                        textAnchor="middle"
                        fill={circleColor}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {hs.id}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Interactive Target Marker Pins */}
              {detections.map(d => {
                const { xPct, yPct } = projectCoords(d.simulated_lat || 18.922, d.simulated_lon || 72.834);
                const colors = CLASS_COLORS[d.class_name] || { border: '#00ffc8', text: '#00ffc8' };
                const isSelected = selectedTarget?.id === d.id;

                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedTarget(d)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border transition-all z-10 cursor-pointer ${
                      isSelected 
                        ? 'w-6 h-6 ring-4 ring-cyan-400/50 z-20 scale-125' 
                        : 'hover:scale-125'
                    }`}
                    style={{
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      backgroundColor: isSelected ? '#00f0ff' : colors.border,
                      borderColor: '#ffffff'
                    }}
                    title={`${d.class_name} (${d.id})`}
                  />
                );
              })}

              {/* Map Telemetry Watermark */}
              <div className="absolute bottom-2 left-3 font-mono text-[10px] text-slate-500 pointer-events-none">
                <div>SWATH: 100m LATERAL &bull; DEPTH: 20-35m</div>
                <div>TRANSECT HEADING: 135° SE</div>
              </div>
            </div>

            {/* Selected Target Quick Dossier Card */}
            {selectedTarget && (
              <div className="p-3 bg-slate-950 rounded-xl border border-cyan-500/50 flex items-center justify-between gap-4 font-mono text-xs animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black rounded border border-slate-700 overflow-hidden flex-shrink-0">
                    <img 
                      src={getDetectionCropUrl(selectedTarget.id)} 
                      alt={selectedTarget.class_name} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-cyan-300 font-bold uppercase block">{selectedTarget.class_name}</span>
                    <span className="text-[10px] text-slate-400">{selectedTarget.simulated_lat.toFixed(5)}°N, {selectedTarget.simulated_lon.toFixed(5)}°E</span>
                    <div className="text-[10px] text-teal-400 mt-0.5">
                      Artificiality: {selectedTarget.artificiality_score ? Math.round(selectedTarget.artificiality_score * 100) : 'N/A'}% | Status: {selectedTarget.status}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedTarget(null)}
                  className="text-xs text-slate-500 hover:text-white px-2 py-1 bg-slate-900 rounded border border-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Searchable Tabular Target Explorer (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Table size={16} className="text-cyan-400" />
                SURVEY TARGET EXPLORER ({filteredDetections.length})
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Live Telemetry</span>
            </div>

            {/* Filter & Search Bar */}
            <div className="space-y-2 font-mono text-xs">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search by ID, class, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Classes</option>
                  <option value="shipwreck">Shipwreck</option>
                  <option value="tyre">Tyre</option>
                  <option value="artificial reef">Artificial Reef</option>
                  <option value="rock">Rock</option>
                  <option value="sand ripple">Sand Ripple</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="VALIDATED">Validated</option>
                  <option value="NEEDS REVIEW">Needs Review</option>
                  <option value="ARTIFICIAL_STRUCTURE">Artificial Structure</option>
                  <option value="NATURAL">Natural</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* Detections Mini Table */}
            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 font-mono">
              {filteredDetections.map((d) => {
                const colors = CLASS_COLORS[d.class_name] || { border: '#00ffc8', text: '#00ffc8' };
                const isSelected = selectedTarget?.id === d.id;

                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedTarget(d)}
                    className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected 
                        ? 'bg-cyan-950/40 border-cyan-500/60' 
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 bg-black rounded border border-slate-800 overflow-hidden flex-shrink-0">
                        <img 
                          src={getDetectionCropUrl(d.id)} 
                          alt={d.class_name} 
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <span 
                          className="text-xs font-bold uppercase block truncate"
                          style={{ color: colors.text }}
                        >
                          {d.class_name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">{d.id}</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 text-[11px]">
                      <span className="text-cyan-300 font-bold block">
                        {d.artificiality_score ? `${Math.round(d.artificiality_score * 100)}%` : 'N/A'}
                      </span>
                      <span className="text-[9px] text-slate-500 block uppercase">{d.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
