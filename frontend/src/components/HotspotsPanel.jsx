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
  X,
  Map,
  Grid
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
import NauticalOSMMap from './NauticalOSMMap';

const CLASS_COLORS = {
  'shipwreck': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  'tyre': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  'ghost net': { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
  'ghost_net': { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
  'artificial reef': { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  'rock': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  'sand ripple': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' }
};

export default function HotspotsPanel({ currentSurvey }) {
  const [hotspots, setHotspots] = useState([]);
  const [allDetections, setAllDetections] = useState([]);
  const [filterTier, setFilterTier] = useState('ALL'); // ALL, PRIORITY 1, PRIORITY 2, PRIORITY 3, PROTECTED
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

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
      // Stage 1: Detection
      setPipelineStage('1/5: Running YOLO Inference & Verification...');
      await runSurveyDetection(currentSurvey.id, 0.20);

      // Stage 2: Evidence Fusion
      setPipelineStage('2/5: Fusing Multi-Feature Evidence (Shape, Shadow, Context)...');
      await fuseSurveyEvidence(currentSurvey.id);

      // Stage 3: Spatial Geolocation
      setPipelineStage('3/5: Computing Swath Geometry & OpenStreetMap Coordinates...');
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
      return { label: 'PROTECTED / DO NOT REMOVE', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300' };
    }
    if (level === 'PRIORITY 1') {
      return { label: 'PRIORITY 1: IMMEDIATE CLEANUP', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' };
    }
    if (level === 'PRIORITY 2') {
      return { label: 'PRIORITY 2: SCHEDULED REMEDIATION', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' };
    }
    if (level === 'NATURAL_FEATURE') {
      return { label: 'NATURAL / NO ACTION', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' };
    }
    return { label: 'PRIORITY 3: MONITOR & RE-SURVEY', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Autonomous Pipeline Strip */}
      <div className="glass-panel p-6 border border-slate-200 space-y-4 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="text-sky-600 animate-spin-slow" size={20} />
              <h2 className="font-tech text-lg font-bold text-slate-900 tracking-tight">
                DEBRIS HOTSPOTS & REAL-WORLD OPENSTREETMAP GIS
              </h2>
              <span className="bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                OSM + DBSCAN + Bio-Threat Matrix
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="text-sky-700 font-semibold italic">�Geospatial aggregation of acoustic debris targets into actionable real-world nautical coordinates.�</span>
            </p>
          </div>

          {/* Autonomous Pipeline Trigger */}
          <button
            onClick={handleRunFullPipeline}
            disabled={pipelineRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={15} className={pipelineRunning ? "animate-spin" : "text-amber-200"} />
            <span>{pipelineRunning ? 'Executing Autonomous Pipeline...' : 'Run Full Autonomous Intelligence Pipeline'}</span>
          </button>
        </div>

        {/* Pipeline Progress Indicator */}
        {pipelineRunning && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-3 text-xs font-mono text-sky-800 animate-pulse">
            <Play size={14} className="text-sky-600 animate-bounce" />
            <span>{pipelineStage}</span>
          </div>
        )}

        {/* Notifications */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-medium">
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Executive Summary Metrics Counter Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[10px] block font-semibold uppercase">TOTAL DEBRIS FIELDS</span>
            <span className="text-slate-900 font-bold text-lg">{totalHotspots} Fields</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[10px] block font-semibold uppercase">PRIORITY 1 ACTION</span>
            <span className="text-red-600 font-bold text-lg">{priority1Count} Critical</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[10px] block font-semibold uppercase">HIGH BIO-THREAT</span>
            <span className="text-amber-600 font-bold text-lg">{criticalBioThreatCount} Hazards</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-slate-500 text-[10px] block font-semibold uppercase">PROTECTED REEFS</span>
            <span className="text-sky-700 font-bold text-lg">{protectedReefsCount} Sanctuaries</span>
          </div>
        </div>
      </div>

      {/* Interactive OpenStreetMap (OSM) Real-World Viewport */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Map size={16} className="text-sky-600" />
            <span>LIVE OPENSTREETMAP NAUTICAL CHART</span>
            <span className="text-[10px] font-mono text-slate-400">
              ({allDetections.length} Target Pins | {hotspots.length} Hotspot Zones)
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Click pins to inspect acoustic crop & telemetry
          </div>
        </div>

        <NauticalOSMMap
          detections={allDetections}
          hotspots={hotspots}
          survey={currentSurvey}
          selectedTarget={selectedTarget}
          onSelectTarget={(t) => setSelectedTarget(t)}
          height="480px"
        />
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 font-semibold text-[11px] mr-1 flex items-center gap-1">
            <Grid size={13} className="text-slate-400" />
            FILTER REMEDIATION FIELDS:
          </span>
          {[
            { id: 'ALL', label: 'All Fields' },
            { id: 'PRIORITY 1', label: 'Priority 1 (Immediate)' },
            { id: 'PRIORITY 2', label: 'Priority 2 (Scheduled)' },
            { id: 'PRIORITY 3', label: 'Priority 3 (Monitor)' },
            { id: 'PROTECTED', label: 'Protected Habitats' }
          ].map((tier) => (
            <button
              key={tier.id}
              onClick={() => setFilterTier(tier.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterTier === tier.id
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 font-mono">
          Showing {filteredHotspots.length} of {hotspots.length} Debris Fields
        </span>
      </div>

      {/* Hotspots Remediation Cards Grid */}
      {filteredHotspots.length === 0 ? (
        <div className="glass-panel p-12 border border-slate-200 text-center text-slate-400 text-xs bg-white shadow-soft space-y-2">
          <Compass size={32} className="mx-auto text-slate-300 opacity-60" />
          <p>No debris hotspots identified matching the active filter.</p>
          <p className="text-[10px] text-slate-400 font-mono">
            Click "Run Full Autonomous Intelligence Pipeline" above to compute spatial clusters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHotspots.map((hs, hIndex) => {
            const tierBadge = getTierBadge(hs.cleanup_priority_level, hs.dominant_class);
            const isCluster = (hs.detection_count || 1) >= 2;

            return (
              <div
                key={hs.hotspot_id || hIndex}
                className="glass-panel p-5 border border-slate-200 space-y-4 hover:border-sky-400 transition-all flex flex-col justify-between bg-white shadow-soft rounded-2xl"
              >
                <div className="space-y-3">
                  {/* Card Header & Tier Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="font-mono text-[10px] text-slate-400 block font-semibold">{hs.hotspot_id}</span>
                      <h3 className="font-tech text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <span>{isCluster ? '•' : '•'}</span>
                        <span>{isCluster ? `Debris Cluster #${hIndex + 1}` : `Single Target #${hIndex + 1}`}</span>
                      </h3>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}>
                      {hs.cleanup_priority_level || 'PRIORITY'}
                    </span>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Dominant Class</span>
                      <span className="font-bold uppercase text-[11px]" style={{ color: '#0369a1' }}>
                        {hs.dominant_class}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Objects Count</span>
                      <span className="font-bold text-slate-800 text-[11px]">{hs.detection_count} Items</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Footprint Area</span>
                      <span className="font-bold text-slate-800 text-[11px]">~{hs.estimated_area_m2} m�</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Centroid</span>
                      <span className="font-bold text-slate-800 text-[10px]">
                        {(hs.centroid_lat ?? hs.center_lat)?.toFixed(4)}�N
                      </span>
                    </div>
                  </div>

                  {/* Bio-Threat Severity & Priority Score Bars */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="text-slate-500">Bio-Threat Severity:</span>
                        <span className="font-bold text-slate-800">{Math.round((hs.bio_threat_score || 0) * 100)}% ({hs.bio_threat_level || 'LOW'})</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full" 
                          style={{ width: `${Math.round((hs.bio_threat_score || 0) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="text-slate-500">Cleanup Score:</span>
                        <span className="font-bold text-sky-700">{Math.round((hs.cleanup_priority_score || 0) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-sky-600 h-full rounded-full" 
                          style={{ width: `${Math.round((hs.cleanup_priority_score || 0) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Tailored Equipment & Protocol */}
                  <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl space-y-1.5 text-xs">
                    <div className="font-bold text-sky-900 flex items-center gap-1.5 text-[11px]">
                      <Wrench size={13} className="text-sky-700" />
                      <span>{hs.recommended_equipment || 'Standard Subsea Recovery Protocol'}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-sans">
                      {hs.action_protocol || 'Deploy marine salvage team with appropriate benthic rigging.'}
                    </p>
                  </div>
                </div>

                {/* Inspect Cluster Button */}
                <button
                  onClick={() => setSelectedHotspot(hs)}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-sky-600 text-slate-700 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>Inspect Zone Targets ({hs.detection_count})</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Clustered Targets Deep Dive Modal */}
      {selectedHotspot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-fadeIn max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-tech text-base font-bold text-slate-900 flex items-center gap-2">
                  <Compass size={18} className="text-sky-600" />
                  HOTSPOT #{selectedHotspot.hotspot_id} TARGETS INSPECTION
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  Centroid: {(selectedHotspot.centroid_lat ?? selectedHotspot.center_lat)?.toFixed(5)}�N, {(selectedHotspot.centroid_lon ?? selectedHotspot.center_lon)?.toFixed(5)}�E
                </span>
              </div>
              <button 
                onClick={() => setSelectedHotspot(null)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target List in Cluster */}
            <div className="space-y-3">
              {allDetections
                .filter(d => (selectedHotspot.detection_ids || []).length === 0 || (selectedHotspot.detection_ids || []).includes(d.id))
                .map((det) => (
                  <div 
                    key={det.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3"
                  >
                    <div className="w-14 h-14 bg-black rounded-lg overflow-hidden border border-slate-300 shrink-0">
                      <img 
                        src={getDetectionCropUrl(det.id)} 
                        alt={det.class_name}
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="text-xs font-mono space-y-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-800 uppercase">{det.class_name}</span>
                        <span className="text-slate-800 font-bold">{Math.round(det.confidence * 100)}% Conf</span>
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        Artificiality Score: <strong className="text-slate-800">{Math.round((det.artificiality_score || 0.5) * 100)}%</strong>
                      </div>
                      <div className="text-slate-500 text-[10px]">
                        Coordinates: <span className="text-sky-700 font-bold">{det.simulated_lat?.toFixed(5)}�N, {det.simulated_lon?.toFixed(5)}�E</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
