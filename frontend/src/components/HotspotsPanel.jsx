import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  MapPin, 
  Layers, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Sliders, 
  Anchor, 
  Wrench, 
  Clock, 
  Maximize2, 
  ExternalLink, 
  Sparkles,
  Info,
  ChevronRight,
  X
} from 'lucide-react';
import { 
  fetchSurveyHotspots, 
  computeSurveyHotspots, 
  computeSurveySpatial,
  evaluateSurveyBioThreat, 
  computeSurveyCleanupPriority,
  fuseSurveyEvidence,
  runSurveyDetection,
  fetchSurveyDetections,
  getDetectionCropUrl
} from '../api';

const CLASS_COLORS = {
  'shipwreck': { bg: 'bg-orange-950/70', border: 'border-orange-600', text: 'text-orange-300' },
  'tyre': { bg: 'bg-amber-950/70', border: 'border-amber-600', text: 'text-amber-300' },
  'artificial reef': { bg: 'bg-cyan-950/70', border: 'border-cyan-600', text: 'text-cyan-300' },
  'rock': { bg: 'bg-emerald-950/70', border: 'border-emerald-600', text: 'text-emerald-300' },
  'sand ripple': { bg: 'bg-indigo-950/70', border: 'border-indigo-600', text: 'text-indigo-300' }
};

export default function HotspotsPanel({ currentSurvey }) {
  const [hotspots, setHotspots] = useState([]);
  const [allDetections, setAllDetections] = useState([]);
  const [filterTier, setFilterTier] = useState('ALL'); // ALL, PRIORITY 1, PRIORITY 2, PRIORITY 3, PROTECTED
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStage, setPipelineStage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Load hotspots and detections
  const loadData = async () => {
    if (!currentSurvey) return;
    setLoading(true);
    try {
      const [hsRes, detRes] = await Promise.allSettled([
        fetchSurveyHotspots(currentSurvey.id),
        fetchSurveyDetections(currentSurvey.id)
      ]);

      if (hsRes.status === 'fulfilled') {
        setHotspots(hsRes.value.hotspots || []);
      }
      if (detRes.status === 'fulfilled') {
        setAllDetections(detRes.value.detections || []);
      }
    } catch (err) {
      console.error('Failed to load hotspot data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentSurvey]);

  // Run Full Autonomous Spatial & Prioritization Pipeline
  const handleRunFullPipeline = async () => {
    if (!currentSurvey) return;
    setPipelineRunning(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Stage 1: Detection (ensure detections exist)
      setPipelineStage('1/5: Running YOLO Inference & Verification...');
      await runSurveyDetection(currentSurvey.id, 0.20);

      // Stage 2: Evidence Fusion
      setPipelineStage('2/5: Fusing Multi-Feature Evidence (Shape, Shadow, Context)...');
      await fuseSurveyEvidence(currentSurvey.id);

      // Stage 3: Simulated Spatial Geolocation
      setPipelineStage('3/5: Computing Swath Geometry & Simulated Coordinates...');
      await computeSurveySpatial(currentSurvey.id);

      // Stage 4: DBSCAN Hotspot Clustering
      setPipelineStage('4/5: Running DBSCAN Spatial Clustering (55m radius)...');
      await computeSurveyHotspots(currentSurvey.id, 55.0, 2);

      // Stage 5: Bio-Threat & Cleanup Prioritization
      setPipelineStage('5/5: Evaluating Bio-Threat Index & Cleanup Priorities...');
      await evaluateSurveyBioThreat(currentSurvey.id);
      await computeSurveyCleanupPriority(currentSurvey.id);

      setSuccessMsg('Autonomous Spatial & Prioritization Pipeline Completed Successfully!');
      await loadData();
    } catch (err) {
      setError(err.message || 'Pipeline execution failed');
    } finally {
      setPipelineRunning(false);
      setPipelineStage('');
    }
  };

  // Telemetry Aggregates
  const totalHotspots = hotspots.length;
  const priority1Count = hotspots.filter(h => h.cleanup_priority_level === 'PRIORITY 1').length;
  const criticalBioThreatCount = hotspots.filter(h => h.bio_threat_level === 'CRITICAL' || h.bio_threat_level === 'HIGH').length;
  const protectedReefsCount = hotspots.filter(h => h.cleanup_priority_level === 'PROTECTED_HABITAT' || h.dominant_class?.toLowerCase() === 'artificial reef').length;

  // Filtered Hotspots
  const filteredHotspots = hotspots.filter(h => {
    if (filterTier === 'ALL') return true;
    if (filterTier === 'PRIORITY 1') return h.cleanup_priority_level === 'PRIORITY 1';
    if (filterTier === 'PRIORITY 2') return h.cleanup_priority_level === 'PRIORITY 2';
    if (filterTier === 'PRIORITY 3') return h.cleanup_priority_level === 'PRIORITY 3';
    if (filterTier === 'PROTECTED') return h.cleanup_priority_level === 'PROTECTED_HABITAT' || h.dominant_class?.toLowerCase() === 'artificial reef';
    return true;
  });

  const getTierBadge = (level, dominantClass) => {
    if (level === 'PROTECTED_HABITAT' || dominantClass?.toLowerCase() === 'artificial reef') {
      return { label: 'PROTECTED / DO NOT REMOVE', bg: 'bg-cyan-950/90', text: 'text-cyan-300', border: 'border-cyan-600' };
    }
    if (level === 'PRIORITY 1') {
      return { label: 'PRIORITY 1: IMMEDIATE CLEANUP', bg: 'bg-red-950/90', text: 'text-red-300', border: 'border-red-600' };
    }
    if (level === 'PRIORITY 2') {
      return { label: 'PRIORITY 2: SCHEDULED REMEDIATION', bg: 'bg-amber-950/90', text: 'text-amber-300', border: 'border-amber-600' };
    }
    if (level === 'NATURAL_FEATURE') {
      return { label: 'NATURAL / NO ACTION', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-700' };
    }
    return { label: 'PRIORITY 3: MONITOR & RE-SURVEY', bg: 'bg-slate-900', text: 'text-slate-400', border: 'border-slate-800' };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Autonomous Pipeline Strip */}
      <div className="glass-panel p-5 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="text-cyan-400 animate-spin-slow" size={20} />
              <h2 className="font-tech text-lg font-bold text-white tracking-wide">
                DEBRIS HOTSPOTS & ACTIONABLE REMEDIATION MATRIX
              </h2>
              <span className="bg-teal-950 text-teal-300 border border-teal-800 text-[10px] font-mono px-2 py-0.5 rounded">
                DBSCAN + Bio-Threat + Priority
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="text-cyan-300 font-semibold italic">“Aggregating isolated targets into coherent debris fields with tailored recovery protocols.”</span>
            </p>
          </div>

          {/* Autonomous Pipeline Trigger */}
          <button
            onClick={handleRunFullPipeline}
            disabled={pipelineRunning}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-cyan-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={15} className={pipelineRunning ? "animate-spin text-cyan-200" : "text-yellow-300"} />
            <span>{pipelineRunning ? 'Executing Autonomous Pipeline...' : 'Run Full Autonomous Intelligence Pipeline'}</span>
          </button>
        </div>

        {/* Pipeline Progress Indicator */}
        {pipelineRunning && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-lg flex items-center gap-3 text-xs font-mono text-cyan-300 animate-pulse">
            <Play size={14} className="text-cyan-400 animate-bounce" />
            <span>{pipelineStage}</span>
          </div>
        )}

        {/* Notifications */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg flex items-center gap-2 text-xs text-red-300">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Executive Telemetry Metric Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono text-xs">
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-500 text-[10px] block uppercase">Total Debris Fields</span>
            <span className="text-white font-bold text-xl">{totalHotspots}</span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-lg border border-red-900/50">
            <span className="text-red-400 text-[10px] block uppercase">Priority 1 (Immediate)</span>
            <span className="text-red-300 font-bold text-xl">{priority1Count}</span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-lg border border-amber-900/50">
            <span className="text-amber-400 text-[10px] block uppercase">High Bio-Threat Zones</span>
            <span className="text-amber-300 font-bold text-xl">{criticalBioThreatCount}</span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-lg border border-cyan-900/50">
            <span className="text-cyan-400 text-[10px] block uppercase">Protected Reef Sanctuaries</span>
            <span className="text-cyan-300 font-bold text-xl">{protectedReefsCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          {['ALL', 'PRIORITY 1', 'PRIORITY 2', 'PRIORITY 3', 'PROTECTED'].map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                filterTier === tier 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Showing <span className="text-cyan-300 font-bold">{filteredHotspots.length}</span> of {totalHotspots} hotspots
        </div>
      </div>

      {/* Ranked Hotspots Matrix Grid */}
      {filteredHotspots.length === 0 ? (
        <div className="text-center py-16 glass-panel border border-slate-800 rounded-xl text-slate-500 text-xs space-y-2">
          <Compass size={36} className="mx-auto text-slate-600 animate-spin-slow" />
          <p className="font-semibold text-slate-400">No Hotspots Found for this filter.</p>
          <p className="text-[11px] text-slate-600">Click "Run Full Autonomous Intelligence Pipeline" above to cluster detections.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredHotspots.map((hs) => {
            const badge = getTierBadge(hs.cleanup_priority_level, hs.dominant_class);
            const classColor = CLASS_COLORS[hs.dominant_class?.toLowerCase()] || { bg: 'bg-slate-900', border: 'border-slate-800', text: 'text-slate-300' };
            const priorityScorePct = Math.round((hs.cleanup_priority_score || 0.5) * 100);
            const bioThreatScorePct = Math.round((hs.bio_threat_score || 0.5) * 100);

            return (
              <div 
                key={hs.id}
                className="glass-panel p-5 border border-slate-800 hover:border-cyan-500/40 rounded-xl transition-all space-y-4 relative flex flex-col justify-between"
              >
                {/* Header: ID + Priority Tier Badge */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-tech text-sm font-bold text-white tracking-wider flex items-center gap-1.5">
                      <MapPin size={14} className="text-cyan-400" />
                      {hs.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Dominant Class & Item Count */}
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className={`px-2 py-0.5 rounded border uppercase text-[11px] font-bold ${classColor.bg} ${classColor.border} ${classColor.text}`}>
                      {hs.dominant_class}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {hs.detection_count} {hs.detection_count === 1 ? 'item' : 'items'} clustered
                    </span>
                  </div>
                </div>

                {/* Spatial Telemetry */}
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Centroid:</span>
                    <span className="text-cyan-300 font-bold">{hs.center_lat.toFixed(5)}°N, {hs.center_lon.toFixed(5)}°E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Footprint Area:</span>
                    <span>~{hs.estimated_area_m2} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Coordinate Grid:</span>
                    <span className="text-slate-400 text-[10px]">Arabian Sea (Simulated)</span>
                  </div>
                </div>

                {/* Score Gauges */}
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  {/* Bio-Threat */}
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>BIO-THREAT:</span>
                      <span className="font-bold text-amber-300">{bioThreatScorePct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-400 h-full rounded-full" 
                        style={{ width: `${bioThreatScorePct}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block truncate">
                      Level: {hs.bio_threat_level}
                    </span>
                  </div>

                  {/* Cleanup Priority */}
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>CLEANUP PRIORITY:</span>
                      <span className="font-bold text-teal-300">{priorityScorePct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-teal-400 h-full rounded-full" 
                        style={{ width: `${priorityScorePct}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block truncate">
                      Tier: {hs.cleanup_priority_level}
                    </span>
                  </div>
                </div>

                {/* Equipment Recommendation */}
                <div className="p-2.5 bg-slate-900/90 rounded border border-cyan-900/40 font-mono text-[11px] space-y-1">
                  <span className="text-cyan-400 font-bold flex items-center gap-1 text-[10px] uppercase">
                    <Wrench size={12} /> Recommended Recovery Equipment:
                  </span>
                  <p className="text-slate-300 text-[10px] leading-relaxed">
                    {hs.dominant_class?.toLowerCase() === 'artificial reef' 
                      ? 'Sanctuary Buoy Marker & Acoustic Monitoring Transponder'
                      : hs.dominant_class?.toLowerCase() === 'shipwreck'
                      ? 'Heavy Salvage ROV, Subsea Inflatable Lift Bags & Hydrocarbon Boom'
                      : 'Diver Recovery Net Basket, Winch Crane & Silt Curtain'}
                  </p>
                </div>

                {/* Inspect Button */}
                <button
                  onClick={() => setSelectedHotspot(hs)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer"
                >
                  <Maximize2 size={13} className="text-cyan-400" />
                  <span>Inspect Cluster Targets</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Cluster Detections Inspection Modal */}
      {selectedHotspot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-cyan-500/50 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-fadeIn max-h-[85vh] flex flex-col font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-tech text-base font-bold text-white flex items-center gap-2">
                  <MapPin size={16} className="text-cyan-400" />
                  HOTSPOT DOSSIER: {selectedHotspot.id}
                </h3>
                <p className="text-xs text-slate-400">
                  Dominant Class: <strong className="text-cyan-300 uppercase">{selectedHotspot.dominant_class}</strong> | Count: {selectedHotspot.detection_count}
                </p>
              </div>
              <button 
                onClick={() => setSelectedHotspot(null)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
                <span className="text-slate-500 text-[10px] block uppercase">Operational Action Protocol:</span>
                <p className="text-slate-200 text-[11px] leading-relaxed">
                  {selectedHotspot.dominant_class?.toLowerCase() === 'artificial reef'
                    ? 'DO NOT REMOVE. Log boundary coordinates as a marine ecological sanctuary. Deploy acoustic beacon marker.'
                    : 'Dispatch remediation vessel. Position recovery rig at coordinates, deploy diver net basket/ROV hoist, and record recovery weight.'}
                </p>
              </div>

              <span className="text-xs font-bold text-slate-300 block uppercase pt-2">
                Survey Targets in Hotspot Cluster:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allDetections
                  .filter(d => d.class_name?.toLowerCase() === selectedHotspot.dominant_class?.toLowerCase())
                  .slice(0, Math.max(2, selectedHotspot.detection_count))
                  .map(d => (
                    <div key={d.id} className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 flex items-center gap-3">
                      <div className="w-14 h-14 bg-black rounded border border-slate-700 overflow-hidden flex-shrink-0">
                        <img 
                          src={getDetectionCropUrl(d.id)} 
                          alt={d.class_name} 
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-[11px] min-w-0 flex-1">
                        <span className="font-bold uppercase text-slate-200 block truncate">{d.class_name}</span>
                        <p className="text-[10px] text-slate-400">Conf: {Math.round(d.confidence * 100)}%</p>
                        <p className="text-[10px] text-cyan-400">Art. Score: {d.artificiality_score ? Math.round(d.artificiality_score * 100) : 'N/A'}%</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedHotspot(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
