import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
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
  'shipwreck': { border: '#ea580c', text: '#c2410c', bg: '#fff7ed' },
  'tyre': { border: '#d97706', text: '#b45309', bg: '#fffbeb' },
  'ghost net': { border: '#0284c7', text: '#0369a1', bg: '#f0f9ff' },
  'ghost_net': { border: '#0284c7', text: '#0369a1', bg: '#f0f9ff' },
  'artificial reef': { border: '#0891b2', text: '#0e7490', bg: '#ecfeff' },
  'rock': { border: '#059669', text: '#047857', bg: '#ecfdf5' },
  'sand ripple': { border: '#4f46e5', text: '#4338ca', bg: '#eef2ff' }
};

export default function EvidenceIntelligencePanel({ 
  currentSurvey 
}) {
  const [detections, setDetections] = useState([]);
  const [selectedDetectionId, setSelectedDetectionId] = useState(null);
  const [activeDossier, setActiveDossier] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [activeOverlayTab, setActiveOverlayTab] = useState('shape'); // shape, shadow, context

  // Fixed Standard Mathematical Evidence Weights (0.40 AI, 0.25 Shape, 0.20 Shadow, 0.15 Context)
  const weights = { ai: 0.40, shape: 0.25, shadow: 0.20, context: 0.15 };

  // Operator Review State
  const [operatorNoteInput, setOperatorNoteInput] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [forceShowReview, setForceShowReview] = useState(false);

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

      let loadedDets = [];
      if (detsRes.status === 'fulfilled') {
        loadedDets = detsRes.value.detections || [];
        setDetections(loadedDets);
        if (loadedDets.length > 0 && !selectedDetectionId) {
          setSelectedDetectionId(loadedDets[0].id);
        }
      }

      if (sumRes.status === 'fulfilled') {
        setReviewSummary(sumRes.value.data.metrics);
      }

      // Auto-fuse if any detection has no artificiality score yet
      const hasUnfused = loadedDets.some(d => d.artificiality_score === null || d.artificiality_score === undefined);
      if (hasUnfused && loadedDets.length > 0) {
        fuseSurveyEvidence(currentSurvey.id, weights).then(async () => {
          const [updatedDets, updatedSum] = await Promise.allSettled([
            fetchSurveyDetections(currentSurvey.id),
            fetchReviewSummary(currentSurvey.id)
          ]);
          if (updatedDets.status === 'fulfilled') {
            setDetections(updatedDets.value.detections || []);
          }
          if (updatedSum.status === 'fulfilled') {
            setReviewSummary(updatedSum.value.data.metrics);
          }
        }).catch(err => console.warn('Background auto-fusion skipped:', err));
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
    setForceShowReview(false);
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

  const isGhostNetClass = (name) => {
    if (!name) return false;
    const c = name.toLowerCase().replace('_', ' ').trim();
    return c === 'ghost net' || c === 'ghostnet' || c === 'net' || c === 'fishing net';
  };

  const activeIsGhostNet = activeDossier ? isGhostNetClass(activeDossier.class_name) : false;

  // Automated Formula Score Calculation (Ghost Net specialized 0.50 AI + 0.30 Shape + 0.20 Context, Shadow Exempt)
  const liveArtificialityScore = activeDossier ? (
    activeIsGhostNet ? (
      Math.round((
        (activeDossier.confidence * 0.50) +
        ((activeDossier.shape_score || 0.85) * 0.30) +
        ((activeDossier.context_score || 0.85) * 0.20)
      ) * 100)
    ) : (
      Math.round((
        (activeDossier.confidence * weights.ai) +
        ((activeDossier.shape_score || 0.5) * weights.shape) +
        (((activeDossier.shadow_score !== null && activeDossier.shadow_score !== undefined) ? activeDossier.shadow_score : 0.4) * weights.shadow) +
        ((activeDossier.context_score || 0.5) * weights.context)
      ) * 100)
    )
  ) : 0;

  const getStatusBadge = (score, className, reviewStatus) => {
    if (reviewStatus === 'OPERATOR_APPROVED') {
      return { label: 'OPERATOR APPROVED (VALIDATED DEBRIS)', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' };
    }
    if (reviewStatus === 'OPERATOR_REJECTED') {
      return { label: 'OPERATOR REJECTED (FALSE POSITIVE)', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' };
    }
    if (className === 'rock' || className === 'sand ripple') {
      return { label: 'NATURAL ANOMALY', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' };
    }
    if (className === 'artificial reef') {
      return { label: 'ARTIFICIAL STRUCTURE (PROTECTED)', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300' };
    }
    if (score >= 80) {
      return { label: 'VALIDATED CANDIDATE (>=80%)', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300' };
    }
    if (score >= 60) {
      return { label: 'NEEDS HUMAN REVIEW (60-79%)', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' };
    }
    return { label: 'LOW ARTIFICIALITY (<60%)', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' };
  };

  const statusBadge = activeDossier ? getStatusBadge(liveArtificialityScore, activeDossier.class_name, activeDossier.review_status) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Strip */}
      <div className="glass-panel p-6 border border-slate-200 space-y-4 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="text-sky-600 animate-pulse" size={20} />
              <h2 className="font-tech text-lg font-bold text-slate-900 tracking-tight">
                EVIDENCE INTELLIGENCE & HUMAN-IN-THE-LOOP COCKPIT
              </h2>
              <span className="bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                Physics Reasoning + Operator Audit
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="text-sky-700 font-semibold italic">“YOLO tells us what it sees. SONAR-SHIELD evaluates why that detection should be trusted.”</span>
            </p>
          </div>

          {/* Action Bar (Manual Weight Customizer removed per Image 3) */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleBatchFuse}
              disabled={loading || detections.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles size={14} className={loading ? "animate-spin" : "text-amber-200"} />
              <span>{loading ? 'Evaluating Fusion...' : 'Run Full Evidence Fusion'}</span>
            </button>
          </div>
        </div>

        {/* Survey-Wide Triage Status Telemetry Strip (Natural Seabed & Reefs removed per class specification) */}
        {reviewSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[10px] block font-semibold uppercase tracking-wider">VALIDATED CANDIDATES (≥80%)</span>
              <span className="text-sky-700 font-bold text-lg">{reviewSummary.validated_candidates}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[10px] block font-semibold uppercase tracking-wider">NEEDS HUMAN REVIEW (60-79%)</span>
              <span className="text-amber-600 font-bold text-lg">{reviewSummary.needs_review}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[10px] block font-semibold uppercase tracking-wider">LOW ARTIFICIALITY (&lt;60%)</span>
              <span className="text-slate-600 font-bold text-lg">{reviewSummary.low_artificiality || reviewSummary.natural_seabed || 0}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[10px] block font-semibold uppercase tracking-wider">OPERATOR VERDICTS</span>
              <span className="text-slate-800 font-bold text-lg">
                +{reviewSummary.operator_approved} / -{reviewSummary.operator_rejected}
              </span>
            </div>
          </div>
        )}

        {/* Notification alerts */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-mono">
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
      </div>

      {/* Main Workspace: Candidate Selector + Dossier Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Candidate Targets List */}
        <div className="space-y-4">
          <div className="glass-panel p-4 border border-slate-200 space-y-3 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers size={14} className="text-sky-600" /> CANDIDATES ({detections.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Click to inspect</span>
            </div>

            {detections.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-mono">
                No detections available. Run YOLO inference in Sonar Analysis first.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {detections.map((det) => {
                  const isSelected = det.id === selectedDetectionId;
                  const style = CLASS_COLORS[det.class_name.toLowerCase()] || { border: '#0284c7', text: '#0284c7' };
                  const confPercent = Math.round((det.confidence || 0.85) * 100);
                  const fusedPercent = det.artificiality_score !== null && det.artificiality_score !== undefined 
                    ? Math.round(det.artificiality_score * 100) 
                    : null;

                  return (
                    <div
                      key={det.id}
                      onClick={() => setSelectedDetectionId(det.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected 
                          ? 'bg-sky-50 border-sky-400 shadow-sm ring-1 ring-sky-400/30' 
                          : 'bg-slate-50 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      <div className="w-12 h-12 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-300">
                        <img 
                          src={getDetectionCropUrl(det.id)} 
                          alt={det.class_name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>

                      <div className="text-xs truncate flex-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold uppercase text-[11px]" style={{ color: style.text }}>
                            {det.class_name}
                          </span>
                          <div className="text-right">
                            {fusedPercent !== null ? (
                              <>
                                <span className="font-mono text-xs font-bold text-sky-800 block">
                                  {fusedPercent}%
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  AI: {confPercent}%
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-xs font-bold text-slate-800 block">
                                  {confPercent}%
                                </span>
                                <span className="text-[9px] text-sky-600 font-mono font-semibold">
                                  AI CONF
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Status: <strong className="text-slate-700">{det.status || 'CANDIDATE'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Multi-Evidence Deep Dive & Operator Verdict */}
        <div className="lg:col-span-2 space-y-4">
          {activeDossier ? (() => {
            const currentDetId = activeDossier.id || activeDossier.detection_id || selectedDetectionId;
            return (
            <div className="space-y-4">
              {/* Grand Hero Gauge: Central Artificiality Reasoning Output */}
              <div className="glass-panel p-6 border border-slate-200 bg-white shadow-soft relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Left: Target Thumbnail */}
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 bg-black rounded-2xl overflow-hidden border-2 border-sky-200 shadow-sm shrink-0">
                      <img 
                        src={getDetectionCropUrl(currentDetId)} 
                        alt="Crop" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div>
                      <span className="font-mono text-[11px] text-slate-400 block">{currentDetId}</span>
                      <h3 className="font-tech text-xl font-bold uppercase tracking-wide text-slate-900">
                        {activeDossier.class_name}
                      </h3>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        Frame: {activeDossier.frame_id || 'FRAME'} {activeDossier.frame_filename ? `(${activeDossier.frame_filename})` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Right: Artificiality Score Gauge */}
                  <div className="text-right space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 block uppercase">
                      CENTRAL REASONING OUTPUT
                    </span>
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-tech text-5xl font-black tracking-tight text-sky-700">
                        {liveArtificialityScore}%
                      </span>
                    </div>
                    {statusBadge && (
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                        {statusBadge.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Mathematical Formulation */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-sky-500 to-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${liveArtificialityScore}%` }}
                    ></div>
                  </div>
                  {activeIsGhostNet ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-sky-900 font-mono bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200">
                      <span className="font-semibold">Ghost Net Physics Formula: 0.50(AI) + 0.30(Mesh Geometry) + 0.20(Context)</span>
                      <span className="text-[10px] font-bold text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-300">
                        Shadow Exempt (Porous Mesh)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Formula: 0.40(AI) + 0.25(Shape) + 0.20(Shadow) + 0.15(Context)</span>
                      <span className="text-sky-700 font-semibold">Multi-Evidence Fusion</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4-Channel Evidence Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. AI Confidence */}
                <div className="glass-panel p-4 border border-slate-200 space-y-2 bg-white shadow-soft">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                      <Sparkles size={13} className="text-sky-600" /> 1. AI CONF ({activeIsGhostNet ? '50%' : '40%'})
                    </span>
                    <span className="text-sky-800 font-bold text-sm">{Math.round(activeDossier.confidence * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-sky-600 h-full rounded-full" style={{ width: `${activeDossier.confidence * 100}%` }}></div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 truncate">
                    YOLO v8 raw score
                  </p>
                </div>

                {/* 2. Shape Evidence */}
                <div className="glass-panel p-4 border border-slate-200 space-y-2 bg-white shadow-soft">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                      <CircleDot size={13} className="text-amber-600" /> 2. {activeIsGhostNet ? 'MESH SHAPE (30%)' : 'SHAPE (25%)'}
                    </span>
                    <span className="text-amber-700 font-bold text-sm">{Math.round((activeDossier.shape_score || 0.85) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(activeDossier.shape_score || 0.85) * 100}%` }}></div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 truncate">
                    {activeIsGhostNet ? 'Tangled Fiber / Netting Mesh' : `Circ: ${activeDossier.metrics?.shape?.circularity || 'N/A'} | AR: ${activeDossier.metrics?.shape?.aspect_ratio || 'N/A'}`}
                  </p>
                </div>

                {/* 3. Shadow Evidence */}
                {activeIsGhostNet ? (
                  <div className="glass-panel p-4 border border-dashed border-sky-300 space-y-2 bg-sky-50/60 shadow-soft">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-sky-800 font-medium flex items-center gap-1.5">
                        <Moon size={13} className="text-sky-600" /> 3. SHADOW
                      </span>
                      <span className="text-sky-700 font-bold text-[10px] bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-full">
                        EXEMPT (0%)
                      </span>
                    </div>
                    <div className="w-full bg-sky-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-400 h-full rounded-full" style={{ width: '0%' }}></div>
                    </div>
                    <p className="text-[10px] font-mono text-sky-700 leading-tight">
                      Porous mesh allows acoustic penetration; shadow omitted.
                    </p>
                  </div>
                ) : (
                  <div className="glass-panel p-4 border border-slate-200 space-y-2 bg-white shadow-soft">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600 font-medium flex items-center gap-1.5">
                        <Moon size={13} className="text-purple-600" /> 3. SHADOW (20%)
                      </span>
                      <span className="text-purple-700 font-bold text-sm">{Math.round((activeDossier.shadow_score || 0.7) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-purple-600 h-full rounded-full" style={{ width: `${(activeDossier.shadow_score || 0.7) * 100}%` }}></div>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 truncate">
                      Contrast Drop: {activeDossier.metrics?.shadow?.contrast_drop || 'N/A'}
                    </p>
                  </div>
                )}

                {/* 4. Context Evidence */}
                <div className="glass-panel p-4 border border-slate-200 space-y-2 bg-white shadow-soft">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                      <Waves size={13} className="text-blue-600" /> 4. CONTEXT ({activeIsGhostNet ? '20%' : '15%'})
                    </span>
                    <span className="text-blue-700 font-bold text-sm">{Math.round((activeDossier.context_score || 0.85) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${(activeDossier.context_score || 0.85) * 100}%` }}></div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 truncate">
                    Local Saliency: {activeDossier.metrics?.context?.local_contrast || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Diagnostic Visualizer Overlay Tabs */}
              <div className="glass-panel p-4 border border-slate-200 space-y-3 bg-white shadow-soft">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-tech flex items-center gap-2">
                    <BoxSelect size={14} className="text-sky-600" /> DIAGNOSTIC EVIDENCE OVERLAYS
                  </span>

                  <div className="flex items-center gap-1.5 text-xs">
                    {[
                      { id: 'shape', label: 'Shape Contour' },
                      { id: 'shadow', label: 'Acoustic Shadow' },
                      { id: 'context', label: 'Seabed Context' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveOverlayTab(tab.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          activeOverlayTab === tab.id
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Diagnostic Image Display */}
                <div className="bg-black rounded-xl overflow-hidden min-h-[220px] max-h-[300px] flex items-center justify-center border border-slate-300">
                  {activeOverlayTab === 'shape' && (
                    <img 
                      src={getShapeOverlayUrl(currentDetId)} 
                      alt="Shape Overlay"
                      className="max-h-[290px] w-auto object-contain mx-auto" 
                    />
                  )}
                  {activeOverlayTab === 'shadow' && (
                    <img 
                      src={getShadowOverlayUrl(currentDetId)} 
                      alt="Shadow Overlay"
                      className="max-h-[290px] w-auto object-contain mx-auto" 
                    />
                  )}
                  {activeOverlayTab === 'context' && (
                    <img 
                      src={getContextOverlayUrl(currentDetId)} 
                      alt="Context Overlay"
                      className="max-h-[290px] w-auto object-contain mx-auto" 
                    />
                  )}
                </div>
              </div>

              {/* Conditional Human-in-the-Loop Cockpit */}
              {(() => {
                const isHighConf = liveArtificialityScore >= 80;
                const isLowConf = liveArtificialityScore < 60;
                const isBorderline = !isHighConf && !isLowConf;
                const showHITLForm = isBorderline || forceShowReview || activeDossier.review_status === 'FLAGGED_FOR_INSPECTION' || activeDossier.review_status === 'OPERATOR_APPROVED' || activeDossier.review_status === 'OPERATOR_REJECTED';

                if (isHighConf && !showHITLForm) {
                  return (
                    <div className="glass-panel p-5 border border-emerald-200 bg-emerald-50/40 shadow-soft rounded-2xl">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-300 shrink-0">
                            <ShieldCheck size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-950 font-tech text-xs uppercase tracking-wide">
                                AUTONOMOUSLY VALIDATED CANDIDATE ({liveArtificialityScore}%)
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-bold font-mono">
                                ≥80% AUTO-CERTIFIED
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800 mt-0.5">
                              Physics heuristics confirm high artificiality. <strong>Human validation not required.</strong>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setForceShowReview(true)}
                          className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                        >
                          Manual Audit Override
                        </button>
                      </div>
                    </div>
                  );
                }

                if (isLowConf && !showHITLForm) {
                  return (
                    <div className="glass-panel p-5 border border-slate-200 bg-slate-50 shadow-soft rounded-2xl">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-slate-200 text-slate-700 rounded-xl border border-slate-300 shrink-0">
                            <AlertCircle size={24} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 font-tech text-xs uppercase tracking-wide">
                                LOW ARTIFICIALITY / NATURAL SEABED ({liveArtificialityScore}%)
                              </span>
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px] font-bold font-mono">
                                &lt;60% AUTO-DISMISSED
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Acoustic parameters match natural seabed background. <strong>Validation not requested.</strong>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setForceShowReview(true)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                        >
                          Manual Audit Override
                        </button>
                      </div>
                    </div>
                  );
                }

                // Borderline (60-79%) OR Operator Forced Review
                return (
                  <div className="glass-panel p-5 border-2 border-amber-300 space-y-3.5 bg-amber-50/30 shadow-soft rounded-2xl ring-2 ring-amber-400/20">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-100 text-amber-800 rounded-xl border border-amber-300 animate-pulse">
                          <UserCheck size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-950 tracking-wide font-tech text-xs uppercase block">
                              HUMAN-IN-THE-LOOP OPERATOR AUDIT REQUIRED ({liveArtificialityScore}%)
                            </span>
                            <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold font-mono">
                              60–79% BORDERLINE ZONE
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-800 font-medium">
                            Ambiguous acoustic candidate. Manual operator decision required before ROV remediation.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-amber-900 font-semibold">Audit Status:</span>
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                          activeDossier.review_status === 'OPERATOR_APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : activeDossier.review_status === 'OPERATOR_REJECTED'
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : activeDossier.review_status === 'FLAGGED_FOR_INSPECTION'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-white text-amber-900 border-amber-300'
                        }`}>
                          {activeDossier.review_status || 'PENDING_OPERATOR_VERDICT'}
                        </span>
                      </div>
                    </div>

                    {/* Operator Verdict Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => handleOperatorAction('APPROVE_DEBRIS')}
                        disabled={reviewActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        <span>Validate Debris (Approve)</span>
                      </button>

                      <button
                        onClick={() => handleOperatorAction('REJECT_FALSE_POSITIVE')}
                        disabled={reviewActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <XCircle size={14} />
                        <span>Reject False Positive</span>
                      </button>

                      <button
                        onClick={() => handleOperatorAction('FLAG_FOR_INSPECTION')}
                        disabled={reviewActionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Flag size={14} />
                        <span>Flag for Field Inspection</span>
                      </button>
                    </div>

                    {/* Operator Audit Note Input Form */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add operator audit notes or reason for decision..."
                        value={operatorNoteInput}
                        onChange={(e) => setOperatorNoteInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && operatorNoteInput.trim() && !reviewActionLoading) {
                            handleOperatorAction(activeDossier.review_status || 'FLAG_FOR_INSPECTION');
                          }
                        }}
                        className="flex-1 bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-all font-mono"
                      />
                      <button
                        onClick={() => handleOperatorAction(activeDossier.review_status || 'FLAG_FOR_INSPECTION')}
                        disabled={!operatorNoteInput.trim() || reviewActionLoading}
                        title="Submit Operator Audit Note"
                        className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all disabled:opacity-40 cursor-pointer shadow-sm"
                      >
                        <Send size={15} />
                      </button>
                    </div>

                    {/* Audit Trail Monospace Log if notes exist */}
                    {activeDossier.operator_notes && (
                      <div className="mt-2 p-2.5 bg-white border border-amber-200 rounded-xl">
                        <span className="text-[10px] font-bold text-amber-800 block uppercase font-mono mb-1">
                          AUDIT TRAIL LOG:
                        </span>
                        <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                          {activeDossier.operator_notes}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            );
          })() : (
            <div className="glass-panel p-12 border border-slate-200 text-center text-slate-400 text-xs bg-white shadow-soft">
              <RefreshCw className="animate-spin mx-auto mb-2 text-slate-300" size={24} />
              <span>Select a candidate target on the left to inspect multi-evidence reasoning.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
