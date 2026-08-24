import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Compass, 
  ChevronRight, 
  Info,
  CircleDot,
  Moon,
  Maximize2,
  BoxSelect,
  Waves,
  UserCheck,
  XCircle,
  Flag,
  FileEdit,
  Send
} from 'lucide-react';
import { 
  fetchSurveyDetections, 
  fetchDetectionDossier, 
  fuseSurveyEvidence,
  submitOperatorReview,
  fetchReviewSummary,
  getDetectionCropUrl,
  getShapeOverlayUrl,
  getShadowOverlayUrl,
  getContextOverlayUrl
} from '../api';

const CLASS_COLORS = {
  'shipwreck': { border: '#f97316', text: '#fb923c' },
  'tyre': { border: '#f59e0b', text: '#fbbf24' },
  'artificial reef': { border: '#06b6d4', text: '#22d3ee' },
  'rock': { border: '#10b981', text: '#34d399' },
  'sand ripple': { border: '#6366f1', text: '#818cf8' }
};

export default function EvidenceIntelligencePanel({ 
  currentSurvey 
}) {
  const [detections, setDetections] = useState([]);
  const [selectedDetectionId, setSelectedDetectionId] = useState(null);
  const [activeDossier, setActiveDossier] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [activeOverlayTab, setActiveOverlayTab] = useState('shape'); // shape, shadow, context
  
  // Dynamic Weights Configuration
  const [weights, setWeights] = useState({ ai: 0.40, shape: 0.25, shadow: 0.20, context: 0.15 });
  const [showWeightCustomizer, setShowWeightCustomizer] = useState(false);

  // Operator Review State
  const [operatorNoteInput, setOperatorNoteInput] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Load all detections and review summary in survey
  const loadDetectionsAndSummary = async () => {
    if (!currentSurvey) return;
    try {
      const [detsRes, sumRes] = await Promise.allSettled([
        fetchSurveyDetections(currentSurvey.id),
        fetchReviewSummary(currentSurvey.id)
      ]);

      if (detsRes.status === 'fulfilled') {
        setDetections(detsRes.value.detections || []);
        if (detsRes.value.detections && detsRes.value.detections.length > 0 && !selectedDetectionId) {
          setSelectedDetectionId(detsRes.value.detections[0].id);
        }
      }

      if (sumRes.status === 'fulfilled') {
        setReviewSummary(sumRes.value.data.metrics);
      }
    } catch (err) {
      console.error('Failed to load detections or summary:', err);
    }
  };

  useEffect(() => {
    loadDetectionsAndSummary();
  }, [currentSurvey]);

  // Load dossier when selected detection changes
  const loadDossier = async (detId) => {
    if (!detId) return;
    setLoadingDossier(true);
    try {
      const res = await fetchDetectionDossier(detId);
      setActiveDossier(res.dossier);
      setOperatorNoteInput('');
    } catch (err) {
      console.error('Failed to load dossier:', err);
    } finally {
      setLoadingDossier(false);
    }
  };

  useEffect(() => {
    if (selectedDetectionId) {
      loadDossier(selectedDetectionId);
    }
  }, [selectedDetectionId]);

  // Run Batch Evidence Fusion
  const handleBatchFuse = async () => {
    if (!currentSurvey) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fuseSurveyEvidence(currentSurvey.id, weights);
      setSuccessMsg(`Evidence Fusion completed for ${res.data.total_fused} candidates!`);
      await loadDetectionsAndSummary();
      if (selectedDetectionId) {
        await loadDossier(selectedDetectionId);
      }
    } catch (err) {
      setError(err.message || 'Evidence fusion failed');
    } finally {
      setLoading(false);
    }
  };

  // Submit Operator Review Action
  const handleOperatorAction = async (action) => {
    if (!selectedDetectionId) return;
    setReviewActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await submitOperatorReview(selectedDetectionId, action, operatorNoteInput);
      setSuccessMsg(`Operator Action Logged: ${action}`);
      await loadDetectionsAndSummary();
      await loadDossier(selectedDetectionId);
      setOperatorNoteInput('');
    } catch (err) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setReviewActionLoading(false);
    }
  };

  // Recalculate score live with slider adjustments
  const liveArtificialityScore = activeDossier ? (
    Math.round((
      (activeDossier.confidence * (weights.ai / (weights.ai + weights.shape + weights.shadow + weights.context))) +
      ((activeDossier.shape_score || 0.5) * (weights.shape / (weights.ai + weights.shape + weights.shadow + weights.context))) +
      ((activeDossier.shadow_score || 0.1) * (weights.shadow / (weights.ai + weights.shape + weights.shadow + weights.context))) +
      ((activeDossier.context_score || 0.5) * (weights.context / (weights.ai + weights.shape + weights.shadow + weights.context)))
    ) * 100)
  ) : 0;

  const getStatusBadge = (score, className, reviewStatus) => {
    if (reviewStatus === 'OPERATOR_APPROVED') {
      return { label: 'OPERATOR APPROVED (VALIDATED DEBRIS)', bg: 'bg-emerald-950/90', text: 'text-emerald-300', border: 'border-emerald-500' };
    }
    if (reviewStatus === 'OPERATOR_REJECTED') {
      return { label: 'OPERATOR REJECTED (FALSE POSITIVE)', bg: 'bg-red-950/90', text: 'text-red-300', border: 'border-red-500' };
    }
    if (className === 'rock' || className === 'sand ripple') {
      return { label: 'NATURAL ANOMALY', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-700' };
    }
    if (className === 'artificial reef') {
      return { label: 'ARTIFICIAL STRUCTURE (PROTECTED)', bg: 'bg-cyan-950/80', text: 'text-cyan-300', border: 'border-cyan-700' };
    }
    if (score >= 80) {
      return { label: 'VALIDATED CANDIDATE (>=80%)', bg: 'bg-teal-950/80', text: 'text-teal-300', border: 'border-teal-600' };
    }
    if (score >= 60) {
      return { label: 'NEEDS HUMAN REVIEW (60-79%)', bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-600' };
    }
    return { label: 'LOW ARTIFICIALITY (<60%)', bg: 'bg-slate-900', text: 'text-slate-400', border: 'border-slate-800' };
  };

  const statusBadge = activeDossier ? getStatusBadge(liveArtificialityScore, activeDossier.class_name, activeDossier.review_status) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Strip */}
      <div className="glass-panel p-5 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="text-cyan-400 animate-pulse" size={20} />
              <h2 className="font-tech text-lg font-bold text-white tracking-wide">
                EVIDENCE INTELLIGENCE & HUMAN-IN-THE-LOOP COCKPIT
              </h2>
              <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono px-2 py-0.5 rounded">
                Multi-Evidence Reasoning
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="text-cyan-300 font-semibold italic">“YOLO tells us what it sees. SONAR-SHIELD evaluates why that detection should be trusted.”</span>
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWeightCustomizer(!showWeightCustomizer)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              <Sliders size={13} className="text-cyan-400" />
              <span>{showWeightCustomizer ? 'Hide Weights' : 'Configure Weights'}</span>
            </button>

            <button
              onClick={handleBatchFuse}
              disabled={loading || detections.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles size={14} className={loading ? "animate-spin" : "text-cyan-200"} />
              <span>{loading ? 'Evaluating Fusion...' : 'Run Full Evidence Fusion'}</span>
            </button>
          </div>
        </div>

        {/* Survey-Wide Triage Status Telemetry Strip */}
        {reviewSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-800 text-xs font-mono">
            <div className="bg-slate-950/80 p-2 rounded border border-teal-900/60">
              <span className="text-slate-500 text-[10px] block">VALIDATED CANDIDATES</span>
              <span className="text-teal-400 font-bold text-sm">{reviewSummary.validated_candidates}</span>
            </div>
            <div className="bg-slate-950/80 p-2 rounded border border-amber-900/60">
              <span className="text-slate-500 text-[10px] block">NEEDS HUMAN REVIEW</span>
              <span className="text-amber-400 font-bold text-sm">{reviewSummary.needs_review}</span>
            </div>
            <div className="bg-slate-950/80 p-2 rounded border border-cyan-900/60">
              <span className="text-slate-500 text-[10px] block">ARTIFICIAL REEFS</span>
              <span className="text-cyan-400 font-bold text-sm">{reviewSummary.artificial_structures}</span>
            </div>
            <div className="bg-slate-950/80 p-2 rounded border border-emerald-900/60">
              <span className="text-slate-500 text-[10px] block">NATURAL SEABED</span>
              <span className="text-emerald-400 font-bold text-sm">{reviewSummary.natural_seabed}</span>
            </div>
            <div className="bg-slate-950/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">OPERATOR VERDICTS</span>
              <span className="text-slate-200 font-bold text-sm">
                +{reviewSummary.operator_approved} / -{reviewSummary.operator_rejected}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Weight Adjuster Drawer */}
        {showWeightCustomizer && (
          <div className="p-4 bg-slate-950/90 border border-cyan-500/30 rounded-xl space-y-3 font-mono text-xs animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                <Sliders size={13} /> DYNAMIC EVIDENCE WEIGHT CUSTOMIZER (PROTOTYPE FORMULA)
              </span>
              <span className="text-slate-400 text-[11px]">Weights sum to 100% (Normalized)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">1. AI Confidence:</span>
                  <span className="text-cyan-400 font-bold">{Math.round(weights.ai * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.0" max="1.0" step="0.05" value={weights.ai}
                  onChange={(e) => setWeights({...weights, ai: parseFloat(e.target.value)})}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">2. Shape Geometry:</span>
                  <span className="text-amber-400 font-bold">{Math.round(weights.shape * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.0" max="1.0" step="0.05" value={weights.shape}
                  onChange={(e) => setWeights({...weights, shape: parseFloat(e.target.value)})}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">3. Acoustic Shadow:</span>
                  <span className="text-purple-400 font-bold">{Math.round(weights.shadow * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.0" max="1.0" step="0.05" value={weights.shadow}
                  onChange={(e) => setWeights({...weights, shadow: parseFloat(e.target.value)})}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">4. Seabed Context:</span>
                  <span className="text-blue-400 font-bold">{Math.round(weights.context * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.0" max="1.0" step="0.05" value={weights.context}
                  onChange={(e) => setWeights({...weights, context: parseFloat(e.target.value)})}
                  className="w-full accent-blue-400 cursor-pointer"
                />
              </div>
            </div>
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
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Detected Candidates Selector (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="glass-panel p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Layers size={14} className="text-cyan-400" />
                CANDIDATES ({detections.length})
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Click to inspect</span>
            </div>

            {detections.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                <p>No detections loaded.</p>
                <p className="text-[11px] text-slate-600 mt-1">Run YOLO detection in the Sonar Analysis tab first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                {detections.map((det) => {
                  const isSelected = det.id === selectedDetectionId;
                  const colors = CLASS_COLORS[det.class_name] || { border: '#00ffc8', text: '#00ffc8' };
                  const artScore = det.artificiality_score ? Math.round(det.artificiality_score * 100) : null;

                  return (
                    <button
                      key={det.id}
                      onClick={() => setSelectedDetectionId(det.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center gap-3 cursor-pointer ${
                        isSelected 
                          ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950' 
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="w-12 h-12 rounded bg-black flex-shrink-0 overflow-hidden border border-slate-800">
                        <img 
                          src={getDetectionCropUrl(det.id)} 
                          alt={det.class_name} 
                          className="w-full h-full object-contain" 
                        />
                      </div>
                      <div className="flex-1 min-w-0 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span 
                            className="font-bold uppercase text-[11px]"
                            style={{ color: colors.text }}
                          >
                            {det.class_name}
                          </span>
                          {artScore !== null ? (
                            <span className="text-[10px] font-bold bg-slate-950 px-1.5 py-0.2 rounded border border-cyan-800 text-cyan-300">
                              {artScore}%
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500">Unfused</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">Status: {det.status}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center & Right: Evidence Dossier & Human Review Controls (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          {activeDossier ? (
            <>
              {/* Grand Artificiality Score Hero Card */}
              <div className="glass-panel p-6 border border-cyan-500/40 relative overflow-hidden bg-gradient-to-r from-[#0a1329] to-[#070c18]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Left: Target Crop */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center space-y-2">
                    <div className="w-40 h-32 bg-black rounded-lg border-2 border-cyan-500/50 p-1 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                      <img 
                        src={getDetectionCropUrl(activeDossier.detection_id)} 
                        alt={activeDossier.class_name}
                        className="max-w-full max-h-full object-contain rounded" 
                      />
                    </div>
                    <div className="font-mono text-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200 block">
                        {activeDossier.class_name}
                      </span>
                      <span className="text-[10px] text-slate-500">{activeDossier.detection_id}</span>
                    </div>
                  </div>

                  {/* Right: Artificiality Score Gauge & Status */}
                  <div className="md:col-span-8 space-y-3 font-mono">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 uppercase tracking-widest font-tech">
                        CENTRAL REASONING OUTPUT
                      </span>
                      {statusBadge && (
                        <span className={`px-2.5 py-1 rounded text-[11px] font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                          {statusBadge.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-3">
                      <span className="font-tech text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
                        {liveArtificialityScore}%
                      </span>
                      <span className="text-xs text-slate-300 font-sans">
                        PROTOTYPE ARTIFICIALITY SCORE
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-500"
                        style={{ width: `${liveArtificialityScore}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Formula: 0.40(AI) + 0.25(Shape) + 0.20(Shadow) + 0.15(Context)</span>
                      <span className="text-cyan-400">Multi-Evidence Fusion</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Channel Evidence Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. AI Confidence */}
                <div className="glass-panel p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-cyan-400" /> 1. AI CONF
                    </span>
                    <span className="text-cyan-300 font-bold text-sm">{Math.round(activeDossier.confidence * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${activeDossier.confidence * 100}%` }}></div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    YOLO v8 raw detection score
                  </p>
                </div>

                {/* 2. Shape Evidence */}
                <div className="glass-panel p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <CircleDot size={13} className="text-amber-400" /> 2. SHAPE
                    </span>
                    <span className="text-amber-300 font-bold text-sm">{Math.round((activeDossier.shape_score || 0.5) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full rounded-full" style={{ width: `${(activeDossier.shape_score || 0.5) * 100}%` }}></div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    Circularity: {activeDossier.metrics?.shape?.circularity || 'N/A'} | AR: {activeDossier.metrics?.shape?.aspect_ratio || 'N/A'}
                  </p>
                </div>

                {/* 3. Shadow Evidence */}
                <div className="glass-panel p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Moon size={13} className="text-purple-400" /> 3. SHADOW
                    </span>
                    <span className="text-purple-300 font-bold text-sm">{Math.round((activeDossier.shadow_score || 0.1) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-400 h-full rounded-full" style={{ width: `${(activeDossier.shadow_score || 0.1) * 100}%` }}></div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    Contrast Drop: {activeDossier.metrics?.shadow?.contrast_drop || 'N/A'}
                  </p>
                </div>

                {/* 4. Context Evidence */}
                <div className="glass-panel p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Waves size={13} className="text-blue-400" /> 4. CONTEXT
                    </span>
                    <span className="text-blue-300 font-bold text-sm">{Math.round((activeDossier.context_score || 0.5) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-400 h-full rounded-full" style={{ width: `${(activeDossier.context_score || 0.5) * 100}%` }}></div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    Local Saliency: {activeDossier.metrics?.context?.local_contrast || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Human-in-the-Loop Operator Review Cockpit */}
              <div className="glass-panel p-5 border border-cyan-500/30 space-y-4 bg-slate-950/60">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <UserCheck size={16} className="text-cyan-400" />
                    HUMAN-IN-THE-LOOP OPERATOR VERDICT & AUDIT ACTION
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Audit Status: <strong className="text-cyan-300">{activeDossier.review_status || 'PENDING'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Left: 1-Click Action Buttons */}
                  <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleOperatorAction('APPROVE_DEBRIS')}
                      disabled={reviewActionLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      <span>Validate Debris (Approve)</span>
                    </button>

                    <button
                      onClick={() => handleOperatorAction('REJECT_FALSE_POSITIVE')}
                      disabled={reviewActionLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-600 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      <span>Reject False Positive</span>
                    </button>

                    <button
                      onClick={() => handleOperatorAction('FLAG_FOR_INSPECTION')}
                      disabled={reviewActionLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                    >
                      <Flag size={14} />
                      <span>Flag for Field Inspection</span>
                    </button>
                  </div>

                  {/* Right: Operator Notes Input */}
                  <div className="lg:col-span-5 flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="Add operator notes / reason..."
                      value={operatorNoteInput}
                      onChange={(e) => setOperatorNoteInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      onClick={() => handleOperatorAction('APPROVE_DEBRIS')}
                      disabled={reviewActionLoading || !operatorNoteInput.trim()}
                      className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs cursor-pointer disabled:opacity-40"
                      title="Save Note & Approve"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>

                {/* Audit Log / Existing Notes */}
                {activeDossier.operator_notes && (
                  <div className="p-2.5 bg-slate-900/90 rounded border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                    <span className="text-slate-500 block text-[10px] uppercase">Operator Audit Trail:</span>
                    <p className="text-slate-300 whitespace-pre-line">{activeDossier.operator_notes}</p>
                  </div>
                )}
              </div>

              {/* Diagnostic Visualizer Window */}
              <div className="glass-panel p-5 border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <h3 className="font-tech text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <BoxSelect size={16} className="text-cyan-400" />
                    EVIDENCE DIAGNOSTIC VISUALIZATION
                  </h3>

                  {/* Tab Selector */}
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
                    <button
                      onClick={() => setActiveOverlayTab('shape')}
                      className={`px-3 py-1 rounded transition-all cursor-pointer ${
                        activeOverlayTab === 'shape' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Contour & Hull
                    </button>
                    <button
                      onClick={() => setActiveOverlayTab('shadow')}
                      className={`px-3 py-1 rounded transition-all cursor-pointer ${
                        activeOverlayTab === 'shadow' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Target vs Shadow
                    </button>
                    <button
                      onClick={() => setActiveOverlayTab('context')}
                      className={`px-3 py-1 rounded transition-all cursor-pointer ${
                        activeOverlayTab === 'context' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Seabed Context Annulus
                    </button>
                  </div>
                </div>

                {/* Diagnostic Display Canvas */}
                <div className="bg-black rounded-lg p-3 min-h-[300px] flex items-center justify-center border border-slate-800">
                  {activeOverlayTab === 'shape' && (
                    <img 
                      src={getShapeOverlayUrl(activeDossier.detection_id)} 
                      alt="Shape Diagnostic Overlay"
                      className="max-h-[360px] max-w-full object-contain rounded" 
                    />
                  )}
                  {activeOverlayTab === 'shadow' && (
                    <img 
                      src={getShadowOverlayUrl(activeDossier.detection_id)} 
                      alt="Shadow Diagnostic Overlay"
                      className="max-h-[360px] max-w-full object-contain rounded" 
                    />
                  )}
                  {activeOverlayTab === 'context' && (
                    <img 
                      src={getContextOverlayUrl(activeDossier.detection_id)} 
                      alt="Context Diagnostic Overlay"
                      className="max-h-[360px] max-w-full object-contain rounded" 
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 border border-slate-800 rounded-xl glass-panel text-slate-500 text-sm">
              <Eye size={36} className="mx-auto text-slate-600 mb-2" />
              <p>Select a candidate from the left panel to inspect its evidence dossier.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
