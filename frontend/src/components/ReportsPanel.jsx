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
  Info,
  Database
} from 'lucide-react';
import { 
  fetchSurveyDetections, 
  fetchSurveyHotspots, 
  getDetectionCropUrl 
} from '../api';
import NauticalOSMMap from './NauticalOSMMap';

const CLASS_COLORS = {
  'shipwreck': { border: '#ea580c', text: '#c2410c', fill: 'rgba(234, 88, 12, 0.15)' },
  'tyre': { border: '#d97706', text: '#b45309', fill: 'rgba(217, 119, 6, 0.15)' },
  'ghost net': { border: '#0284c7', text: '#0369a1', fill: 'rgba(2, 132, 199, 0.15)' },
  'ghost_net': { border: '#0284c7', text: '#0369a1', fill: 'rgba(2, 132, 199, 0.15)' },
  'artificial reef': { border: '#0891b2', text: '#0e7490', fill: 'rgba(8, 145, 178, 0.15)' },
  'rock': { border: '#059669', text: '#047857', fill: 'rgba(5, 150, 105, 0.15)' },
  'sand ripple': { border: '#4f46e5', text: '#4338ca', fill: 'rgba(79, 70, 229, 0.15)' }
};

export default function ReportsPanel({ currentSurvey }) {
  const [detections, setDetections] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [mapMode, setMapMode] = useState('osm'); // 'osm' | 'radar'

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
    const allCoords = [];
    detections.forEach(d => {
      const lat = d.simulated_lat ?? d.lat;
      const lon = d.simulated_lon ?? d.lon;
      if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
        allCoords.push({ lat: Number(lat), lon: Number(lon) });
      }
    });
    hotspots.forEach(h => {
      const lat = h.centroid_lat ?? h.center_lat ?? h.lat;
      const lon = h.centroid_lon ?? h.center_lon ?? h.lon;
      if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
        allCoords.push({ lat: Number(lat), lon: Number(lon) });
      }
    });

    if (allCoords.length === 0) {
      return { minLat: 15.495, maxLat: 15.505, minLon: 73.810, maxLon: 73.820 };
    }

    const lats = allCoords.map(c => c.lat);
    const lons = allCoords.map(c => c.lon);
    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lonMin = Math.min(...lons);
    const lonMax = Math.max(...lons);

    const padLat = Math.max(0.0003, (latMax - latMin) * 0.20);
    const padLon = Math.max(0.0003, (lonMax - lonMin) * 0.20);

    return {
      minLat: latMin - padLat,
      maxLat: latMax + padLat,
      minLon: lonMin - padLon,
      maxLon: lonMax + padLon
    };
  }, [detections, hotspots]);

  const projectToMap = (lat, lon) => {
    if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
      return { x: 250, y: 200 };
    }
    const { minLat, maxLat, minLon, maxLon } = mapBounds;
    const latSpan = (maxLat - minLat) || 0.001;
    const lonSpan = (maxLon - minLon) || 0.001;
    // Radar center is (250, 200). Margin [90, 410] x [50, 350]
    const x = 90 + ((Number(lon) - minLon) / lonSpan) * 320;
    const y = 350 - ((Number(lat) - minLat) / latSpan) * 300; // Inverted Y
    return { x: Math.max(40, Math.min(460, x)), y: Math.max(30, Math.min(370, y)) };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Action Strip */}
      <div className="glass-panel p-6 border border-slate-200 space-y-4 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="text-sky-600 animate-pulse" size={20} />
              <h2 className="font-tech text-lg font-bold text-slate-900 tracking-tight">
                GEOSPATIAL TACTICAL MAP & MULTI-FORMAT EXPORT CENTER
              </h2>
              <span className="bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                QGIS GeoJSON + CSV + Briefing Dossier
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive spatial canvas on the Arabian Sea coastal grid, structured dataset streams, and printable executive briefing reports.
            </p>
          </div>

          {/* Export Action Buttons */}
          {currentSurvey && (
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={`/api/surveys/${currentSurvey.id}/export/csv`}
                download
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all shadow-xs"
              >
                <Download size={13} className="text-sky-600" />
                <span>Download CSV</span>
              </a>

              <a
                href={`/api/surveys/${currentSurvey.id}/export/geojson`}
                download
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all shadow-xs"
              >
                <MapPin size={13} className="text-sky-600" />
                <span>Export GeoJSON</span>
              </a>

              <a
                href={`/api/surveys/${currentSurvey.id}/export/json`}
                download
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all shadow-xs"
              >
                <Database size={13} className="text-sky-600" />
                <span>JSON Dossier</span>
              </a>

              <button
                onClick={() => window.open(`/api/surveys/${currentSurvey.id}/export/printable`, '_blank')}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition-all cursor-pointer"
              >
                <Printer size={13} />
                <span>Print Executive Briefing</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tactical Intelligence Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Tactical Nautical Radar Map Canvas / OpenStreetMap */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 border border-slate-200 space-y-3 bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 text-xs font-mono gap-2">
              <div className="flex items-center gap-2">
                <Compass size={14} className="text-sky-600 animate-spin-slow" />
                <span className="font-bold text-slate-800">
                  {mapMode === 'osm' ? 'LIVE OPENSTREETMAP NAUTICAL GIS' : 'TACTICAL NAUTICAL RADAR'}
                </span>
                <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-full">
                  MUMBAI HARBOR CORRIDOR
                </span>
              </div>

              {/* View Switcher: OSM vs Radar */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setMapMode('osm')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    mapMode === 'osm'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  OpenStreetMap (OSM)
                </button>
                <button
                  onClick={() => setMapMode('radar')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    mapMode === 'radar'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sonar Radar
                </button>
              </div>
            </div>

            {/* Map Viewport */}
            {mapMode === 'osm' ? (
              <NauticalOSMMap
                detections={detections}
                hotspots={hotspots}
                survey={currentSurvey}
                selectedTarget={selectedTarget}
                onSelectTarget={(t) => setSelectedTarget(t)}
                height="420px"
              />
            ) : (
              <div className="relative bg-[#071326] rounded-2xl overflow-hidden border border-slate-300 shadow-inner min-h-[400px]">
                <svg viewBox="0 0 500 400" className="w-full h-full">
                  {/* Radar Grid Circles */}
                  <circle cx="250" cy="200" r="160" fill="none" stroke="rgba(14, 165, 233, 0.12)" strokeWidth="1" strokeDasharray="4 4" />
                  <circle cx="250" cy="200" r="110" fill="none" stroke="rgba(14, 165, 233, 0.15)" strokeWidth="1" />
                  <circle cx="250" cy="200" r="60" fill="none" stroke="rgba(14, 165, 233, 0.20)" strokeWidth="1" />
                  <line x1="250" y1="20" x2="250" y2="380" stroke="rgba(14, 165, 233, 0.15)" strokeWidth="1" strokeDasharray="2 4" />
                  <line x1="50" y1="200" x2="450" y2="200" stroke="rgba(14, 165, 233, 0.15)" strokeWidth="1" strokeDasharray="2 4" />

                  {/* Hotspot Footprint Polygons */}
                  {hotspots.map((hs) => {
                    const hLat = hs.centroid_lat ?? hs.center_lat;
                    const hLon = hs.centroid_lon ?? hs.center_lon;
                    const hId = hs.hotspot_id ?? hs.id;
                    const pt = projectToMap(hLat, hLon);
                    const isProt = hs.cleanup_priority_level === 'PROTECTED_HABITAT';

                    let enclosingRadius = 38;
                    if (hotspots.length === 1) {
                      let maxDist = 0;
                      detections.forEach(d => {
                        const dLat = d.simulated_lat ?? d.lat;
                        const dLon = d.simulated_lon ?? d.lon;
                        if (dLat !== undefined && dLon !== undefined) {
                          const dPt = projectToMap(dLat, dLon);
                          const dist = Math.hypot(dPt.x - pt.x, dPt.y - pt.y);
                          if (dist > maxDist) maxDist = dist;
                        }
                      });
                      enclosingRadius = Math.max(38, maxDist + 24);
                    } else {
                      let hsMaxDist = 0;
                      detections.forEach(d => {
                        const dLat = d.simulated_lat ?? d.lat;
                        const dLon = d.simulated_lon ?? d.lon;
                        if (dLat !== undefined && dLon !== undefined) {
                          const dPt = projectToMap(dLat, dLon);
                          const distToThis = Math.hypot(dPt.x - pt.x, dPt.y - pt.y);
                          const isClosest = hotspots.every(otherHs => {
                            const oId = otherHs.hotspot_id ?? otherHs.id;
                            if (oId === hId) return true;
                            const otherPt = projectToMap(otherHs.centroid_lat ?? otherHs.center_lat, otherHs.centroid_lon ?? otherHs.center_lon);
                            return distToThis <= Math.hypot(dPt.x - otherPt.x, dPt.y - otherPt.y);
                          });
                          if (isClosest && distToThis > hsMaxDist) {
                            hsMaxDist = distToThis;
                          }
                        }
                      });
                      enclosingRadius = Math.max(38, hsMaxDist + 24);
                    }

                    return (
                      <g key={hId}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={enclosingRadius}
                          fill={isProt ? "rgba(6, 182, 212, 0.18)" : "rgba(239, 68, 68, 0.16)"}
                          stroke={isProt ? "#06b6d4" : "#ef4444"}
                          strokeWidth="2"
                          strokeDasharray={isProt ? "none" : "5 3"}
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={enclosingRadius * 0.65}
                          fill="none"
                          stroke={isProt ? "rgba(6, 182, 212, 0.4)" : "rgba(239, 68, 68, 0.35)"}
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <rect
                          x={pt.x - 48}
                          y={pt.y - enclosingRadius - 18}
                          width="96"
                          height="16"
                          rx="4"
                          fill="rgba(15, 23, 42, 0.90)"
                          stroke={isProt ? "#06b6d4" : "#f43f5e"}
                          strokeWidth="1"
                        />
                        <text
                          x={pt.x}
                          y={pt.y - enclosingRadius - 6}
                          fill={isProt ? "#22d3ee" : "#fda4af"}
                          fontSize="9"
                          fontFamily="monospace"
                          textAnchor="middle"
                          fontWeight="bold"
                        >
                          {hId} ({hs.detection_count} items)
                        </text>
                      </g>
                    );
                  })}

                  {/* Survey Transect Path Line */}
                  {detections.length > 1 && (
                    <polyline
                      points={detections.map(d => {
                        const pt = projectToMap(d.simulated_lat || 18.922, d.simulated_lon || 72.834);
                        return `${pt.x},${pt.y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      opacity="0.75"
                    />
                  )}

                  {/* Detection Markers */}
                  {detections.map((det) => {
                    const pt = projectToMap(det.simulated_lat || 18.922, det.simulated_lon || 72.834);
                    const style = CLASS_COLORS[det.class_name.toLowerCase()] || { border: '#38bdf8', fill: 'rgba(56, 189, 248, 0.3)' };
                    const isSelected = selectedTarget?.id === det.id;

                    return (
                      <g
                        key={det.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedTarget(det)}
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? "7" : "5"}
                          fill={style.fill}
                          stroke={isSelected ? "#ffffff" : style.border}
                          strokeWidth={isSelected ? "2.5" : "1.5"}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Map Footer Disclaimer */}
                <div className="absolute bottom-2 left-3 text-[10px] font-mono text-sky-400/80 bg-slate-950/80 px-2.5 py-0.5 rounded border border-sky-900/60">
                  <span>MUMBAI HARBOR FAIRWAY: 18.9220°N, 72.8340°E</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Target Detail Card */}
        <div className="space-y-4">
          <div className="glass-panel p-5 border border-slate-200 space-y-4 bg-white shadow-soft h-full flex flex-col justify-between">
            <div>
              <h4 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
                <Eye size={14} className="text-sky-600" />
                <span>SPATIAL TARGET INSPECTOR</span>
              </h4>

              {selectedTarget ? (
                <div className="space-y-3.5 pt-2">
                  <div className="w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-300 relative shadow-inner">
                    <img 
                      src={getDetectionCropUrl(selectedTarget.id)} 
                      alt={selectedTarget.class_name} 
                      className="w-full h-full object-cover" 
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/95 text-sky-800 shadow-sm">
                      {selectedTarget.class_name}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Detection ID:</span>
                      <span className="text-slate-800 font-bold">{selectedTarget.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">AI Confidence:</span>
                      <span className="text-slate-800 font-bold">{Math.round(selectedTarget.confidence * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Artificiality Score:</span>
                      <span className="text-sky-700 font-bold">{Math.round((selectedTarget.artificiality_score || 0.5) * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Audit Status:</span>
                      <span className="text-slate-800 font-bold">{selectedTarget.status}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="text-slate-400">GPS Coordinates:</span>
                      <span className="text-sky-700 font-bold text-[11px]">
                        {selectedTarget.simulated_lat?.toFixed(5)}°N, {selectedTarget.simulated_lon?.toFixed(5)}°E
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400 text-xs space-y-2">
                  <MapPin size={24} className="mx-auto text-slate-300 opacity-60" />
                  <p>Click any target dot on the radar map to inspect its spatial coordinates and evidence breakdown.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Survey Detections Table Section */}
      <div className="glass-panel p-6 border border-slate-200 space-y-4 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-tech text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Table size={18} className="text-sky-600" />
              DETECTIONS & OPERATIONAL DOSSIER TABLE ({filteredDetections.length})
            </h3>
            <p className="text-xs text-slate-500">
              Tabular survey log containing AI confidence, multi-evidence scores, and operator review audit trails.
            </p>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by ID or Class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-mono"
              />
            </div>
          </div>
        </div>

        {/* Table Viewport */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase bg-slate-50">
                <th className="py-2.5 px-3">Target ID</th>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3">AI Conf</th>
                <th className="py-2.5 px-3">Artificiality</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">GPS Coordinates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDetections.map((d) => (
                <tr 
                  key={d.id} 
                  onClick={() => setSelectedTarget(d)}
                  className="hover:bg-sky-50/60 transition-all cursor-pointer"
                >
                  <td className="py-2.5 px-3 font-bold text-sky-800">{d.id}</td>
                  <td className="py-2.5 px-3 uppercase font-semibold text-slate-800">{d.class_name}</td>
                  <td className="py-2.5 px-3 text-slate-700">{Math.round(d.confidence * 100)}%</td>
                  <td className="py-2.5 px-3 text-sky-700 font-bold">{Math.round((d.artificiality_score || 0.5) * 100)}%</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {d.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                    {d.simulated_lat?.toFixed(5)}°N, {d.simulated_lon?.toFixed(5)}°E
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
