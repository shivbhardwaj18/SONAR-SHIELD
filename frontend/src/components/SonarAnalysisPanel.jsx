import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Play, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Target, 
  Eye, 
  MapPin, 
  Filter,
  Maximize2,
  ChevronRight,
  RefreshCw,
  Wand2,
  BarChart2,
  SunMedium
} from 'lucide-react';
import { 
  runSurveyDetection, 
  runImageDetection, 
  fetchImageDetections, 
  fetchSurveyDetections,
  getImageFileUrl,
  getDetectionCropUrl,
  getPreprocessedImageUrl,
  fetchImageAcousticStats
} from '../api';

const CLASS_COLORS = {
  'shipwreck': { border: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c' },
  'tyre': { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24' },
  'artificial reef': { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)', text: '#22d3ee' },
  'rock': { border: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
  'sand ripple': { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)', text: '#818cf8' }
};

export default function SonarAnalysisPanel({ 
  currentSurvey, 
  surveyImages, 
  onSelectEvidenceDetection 
}) {
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [currentFrameData, setCurrentFrameData] = useState(null);
  const [acousticStats, setAcousticStats] = useState(null);
  const [preprocessMode, setPreprocessMode] = useState('raw'); // raw, clahe, denoised, enhanced
  const [confThreshold, setConfThreshold] = useState(0.20);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedDetectionId, setSelectedDetectionId] = useState(null);
  
  const [loadingDetection, setLoadingDetection] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Set initial selected image
  useEffect(() => {
    if (surveyImages && surveyImages.length > 0 && !selectedImageId) {
      setSelectedImageId(surveyImages[0].id);
    }
  }, [surveyImages]);

  // Load detections & acoustic stats when selected image changes
  const loadDetectionsAndStats = async (imageId) => {
    if (!imageId) return;
    try {
      const [detRes, statsRes] = await Promise.allSettled([
        fetchImageDetections(imageId),
        fetchImageAcousticStats(imageId)
      ]);

      if (detRes.status === 'fulfilled') {
        setCurrentFrameData(detRes.value);
        if (detRes.value.detections && detRes.value.detections.length > 0) {
          setSelectedDetectionId(detRes.value.detections[0].id);
        } else {
          setSelectedDetectionId(null);
        }
      }

      if (statsRes.status === 'fulfilled') {
        setAcousticStats(statsRes.value.acoustic_stats);
      }
    } catch (err) {
      console.error('Failed to load image telemetry:', err);
    }
  };

  useEffect(() => {
    if (selectedImageId) {
      loadDetectionsAndStats(selectedImageId);
    }
  }, [selectedImageId]);

  // Run detection on single frame
  const handleDetectSingle = async () => {
    if (!selectedImageId) return;
    setLoadingDetection(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await runImageDetection(selectedImageId, confThreshold);
      await loadDetectionsAndStats(selectedImageId);
      setSuccessMsg(`YOLO inference completed on current frame!`);
    } catch (err) {
      setError(err.message || 'Detection failed');
    } finally {
      setLoadingDetection(false);
    }
  };

  // Run batch detection across entire survey
  const handleDetectSurvey = async () => {
    if (!currentSurvey) return;
    setLoadingDetection(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await runSurveyDetection(currentSurvey.id, confThreshold);
      await loadDetectionsAndStats(selectedImageId);
      setSuccessMsg(`Batch inference completed: ${res.data.total_detections} objects detected across ${res.data.total_frames_processed} frames.`);
    } catch (err) {
      setError(err.message || 'Batch detection failed');
    } finally {
      setLoadingDetection(false);
    }
  };

  const selectedImageMeta = surveyImages.find(img => img.id === selectedImageId);
  const detections = currentFrameData?.detections || [];
  
  const filteredDetections = detections.filter(d => {
    const classMatch = selectedClass === 'ALL' || d.class_name === selectedClass;
    const confMatch = d.confidence >= confThreshold;
    return classMatch && confMatch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="glass-panel p-5 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="text-cyan-400 animate-pulse" size={20} />
              <h2 className="font-tech text-lg font-bold text-white tracking-wide">
                SONAR ANALYSIS & ACOUSTIC PREPROCESSING
              </h2>
              <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono px-2 py-0.5 rounded">
                YOLO v8 + CLAHE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Standardized acoustic raster preprocessing, dynamic contrast equalization, and multi-class anomaly bounding boxes.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDetectSingle}
              disabled={loadingDetection || !selectedImageId}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={loadingDetection ? "animate-spin" : ""} />
              <span>Detect Current Frame</span>
            </button>

            <button
              onClick={handleDetectSurvey}
              disabled={loadingDetection || !currentSurvey}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play size={14} className={loadingDetection ? "animate-spin" : "fill-current"} />
              <span>{loadingDetection ? 'Running Inference...' : 'Run All Frames (Batch)'}</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar & Acoustic Modes */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/80 text-xs font-mono">
          {/* Class Filter Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 mr-1 flex items-center gap-1">
              <Filter size={12} /> CLASS:
            </span>
            {['ALL', 'shipwreck', 'tyre', 'artificial reef', 'rock', 'sand ripple'].map((cls) => {
              const isSelected = selectedClass === cls;
              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-2.5 py-1 rounded text-[11px] uppercase transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold' 
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cls}
                </button>
              );
            })}
          </div>

          {/* Confidence Slider */}
          <div className="flex items-center gap-3 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
            <Sliders size={13} className="text-cyan-400" />
            <span className="text-slate-400">Min Conf:</span>
            <input 
              type="range" 
              min="0.10" 
              max="0.95" 
              step="0.05" 
              value={confThreshold}
              onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
              className="w-24 accent-cyan-400 cursor-pointer" 
            />
            <span className="text-cyan-300 font-bold w-10 text-right">{Math.round(confThreshold * 100)}%</span>
          </div>
        </div>

        {/* Preprocessing Filter Modes Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/60 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Wand2 size={13} className="text-cyan-400" />
            <span className="text-slate-400">ACOUSTIC FILTER MODE:</span>
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-md border border-slate-800">
              {[
                { id: 'raw', label: 'Raw Sonar' },
                { id: 'clahe', label: 'CLAHE Enhanced' },
                { id: 'denoised', label: 'Speckle Denoised' },
                { id: 'enhanced', label: 'Combined (CLAHE+Denoise)' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setPreprocessMode(mode.id)}
                  className={`px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer ${
                    preprocessMode === mode.id
                      ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Real-Time Acoustic Histogram Telemetry */}
          {acousticStats && (
            <div className="flex items-center gap-4 text-[11px] text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1">
                <SunMedium size={12} className="text-amber-400" />
                Mean: <strong className="text-slate-200">{acousticStats.mean_intensity}</strong>
              </span>
              <span className="flex items-center gap-1">
                <BarChart2 size={12} className="text-cyan-400" />
                Contrast Ratio: <strong className="text-slate-200">{acousticStats.contrast_ratio}</strong>
              </span>
              <span>
                Shadow: <strong className="text-indigo-300">{acousticStats.shadow_pixel_pct}%</strong>
              </span>
            </div>
          )}
        </div>

        {/* Alert / Notification */}
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
        {/* Left Column: Frame Navigator (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="glass-panel p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Layers size={14} className="text-cyan-400" />
                SURVEY FRAMES ({surveyImages.length})
              </h3>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {surveyImages.map((img) => {
                const isSelected = img.id === selectedImageId;
                return (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImageId(img.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center gap-3 cursor-pointer ${
                      isSelected 
                        ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950' 
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="w-12 h-12 rounded bg-black flex-shrink-0 overflow-hidden border border-slate-800">
                      <img 
                        src={getPreprocessedImageUrl(img.id, 'raw')} 
                        alt={img.filename} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="flex-1 min-w-0 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                          {img.frame_id}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{img.filename}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Column: Main Sonar Viewport with Bounding Boxes (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold">{selectedImageMeta?.frame_id}</span>
                <span className="text-slate-400">({selectedImageMeta?.width}x{selectedImageMeta?.height})</span>
                <span className="text-[10px] bg-slate-900 text-cyan-300 px-1.5 py-0.5 rounded uppercase font-semibold">
                  MODE: {preprocessMode}
                </span>
              </div>
              <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                <MapPin size={12} className="text-cyan-400" />
                <span>{selectedImageMeta?.simulated_lat}°N, {selectedImageMeta?.simulated_lon}°E</span>
              </div>
            </div>

            {/* Interactive Image Container */}
            <div className="relative bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center min-h-[420px] select-none">
              {selectedImageId ? (
                <div className="relative inline-block max-w-full max-h-[580px]">
                  <img 
                    src={getPreprocessedImageUrl(selectedImageId, preprocessMode)} 
                    alt={selectedImageMeta?.filename}
                    className="max-w-full max-h-[580px] object-contain block mx-auto transition-opacity duration-200"
                    id="sonar-viewport-image"
                  />

                  {/* SVG Overlay for Bounding Boxes */}
                  {selectedImageMeta && (
                    <svg 
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox={`0 0 ${selectedImageMeta.width} ${selectedImageMeta.height}`}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {filteredDetections.map((det) => {
                        const [x1, y1, x2, y2] = det.bbox;
                        const w = x2 - x1;
                        const h = y2 - y1;
                        const isSelected = det.id === selectedDetectionId;
                        const colors = CLASS_COLORS[det.class_name] || { border: '#00ffc8', bg: 'rgba(0,255,200,0.2)', text: '#00ffc8' };

                        return (
                          <g key={det.id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedDetectionId(det.id)}>
                            {/* Bounding Box Rectangle */}
                            <rect
                              x={x1}
                              y={y1}
                              width={w}
                              height={h}
                              fill={isSelected ? colors.bg : 'rgba(0,0,0,0.1)'}
                              stroke={colors.border}
                              strokeWidth={isSelected ? 4 : 2.5}
                              className="transition-all"
                            />
                            {/* Label Tag Background */}
                            <rect
                              x={x1}
                              y={Math.max(0, y1 - 24)}
                              width={Math.max(80, det.class_name.length * 10 + 45)}
                              height={22}
                              fill="#070c18"
                              stroke={colors.border}
                              strokeWidth={1.5}
                              rx={3}
                            />
                            {/* Label Text */}
                            <text
                              x={x1 + 6}
                              y={Math.max(0, y1 - 24) + 15}
                              fill={colors.text}
                              fontSize={12}
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="bold"
                            >
                              {det.class_name.toUpperCase()} {Math.round(det.confidence * 100)}%
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select a frame from the left panel</p>
              )}
            </div>

            {/* Viewport Status Footer */}
            <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Candidates in View: <strong className="text-cyan-300">{filteredDetections.length}</strong></span>
              <span className="text-[11px] text-slate-500">Click any detection box to inspect candidate details</span>
            </div>
          </div>
        </div>

        {/* Right Column: Target Candidates & Object Crops (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Target size={14} className="text-cyan-400" />
                TARGET CROPS ({filteredDetections.length})
              </h3>
            </div>

            {filteredDetections.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                <p>No candidates detected at current confidence threshold ({Math.round(confThreshold * 100)}%).</p>
                <p className="text-[11px] text-slate-600 mt-1">Click "Detect Current Frame" or lower the threshold.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {filteredDetections.map((det) => {
                  const isSelected = det.id === selectedDetectionId;
                  const colors = CLASS_COLORS[det.class_name] || { border: '#00ffc8', text: '#00ffc8' };
                  const boxW = det.bbox[2] - det.bbox[0];
                  const boxH = det.bbox[3] - det.bbox[1];

                  return (
                    <div
                      key={det.id}
                      onClick={() => setSelectedDetectionId(det.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-900 border-cyan-400/80 shadow-lg shadow-cyan-950' 
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Target Crop Preview */}
                      <div className="h-28 bg-black rounded overflow-hidden mb-2.5 flex items-center justify-center border border-slate-800 relative">
                        <img 
                          src={getDetectionCropUrl(det.id)} 
                          alt={det.class_name} 
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <span 
                          className="absolute top-1.5 left-1.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase"
                          style={{ backgroundColor: 'rgba(7, 13, 28, 0.85)', color: colors.text, border: `1px solid ${colors.border}` }}
                        >
                          {det.class_name}
                        </span>
                      </div>

                      {/* Candidate Metrics */}
                      <div className="space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">AI Confidence</span>
                          <span className="text-cyan-300 font-bold">{Math.round(det.confidence * 100)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Target Size</span>
                          <span>{boxW} × {boxH} px</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                          <span>Status</span>
                          <span className="text-amber-400 uppercase font-semibold">{det.status}</span>
                        </div>
                      </div>

                      {/* Evidence Link */}
                      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Evidence Layer:</span>
                        <span className="text-cyan-400 flex items-center gap-1 font-semibold hover:underline">
                          Ready for Phase 4 <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
