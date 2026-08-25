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
  'shipwreck': { border: '#ea580c', bg: 'rgba(234, 88, 12, 0.15)', text: '#c2410c' },
  'tyre': { border: '#d97706', bg: 'rgba(217, 119, 6, 0.15)', text: '#b45309' },
  'ghost net': { border: '#0284c7', bg: 'rgba(2, 132, 199, 0.15)', text: '#0369a1' },
  'ghost_net': { border: '#0284c7', bg: 'rgba(2, 132, 199, 0.15)', text: '#0369a1' },
  'artificial reef': { border: '#0891b2', bg: 'rgba(8, 145, 178, 0.15)', text: '#0e7490' },
  'rock': { border: '#059669', bg: 'rgba(5, 150, 105, 0.15)', text: '#047857' },
  'sand ripple': { border: '#4f46e5', bg: 'rgba(79, 70, 229, 0.15)', text: '#4338ca' }
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
  
  // Filter detections only by confidence threshold (Class filter bar removed per Image 2)
  const filteredDetections = detections.filter(d => d.confidence >= confThreshold);

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="glass-panel p-6 border border-slate-200 space-y-4 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="text-sky-600 animate-pulse" size={20} />
              <h2 className="font-tech text-lg font-bold text-slate-900 tracking-tight">
                SONAR ANALYSIS & ACOUSTIC PREPROCESSING
              </h2>
              <span className="bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                YOLO v8 + CLAHE
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardized acoustic raster preprocessing, dynamic contrast equalization, and multi-class anomaly bounding boxes.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDetectSingle}
              disabled={loadingDetection || !selectedImageId}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={13} className={loadingDetection ? "animate-spin text-sky-600" : ""} />
              <span>Detect Current Frame</span>
            </button>

            <button
              onClick={handleDetectSurvey}
              disabled={loadingDetection || !currentSurvey}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play size={14} className={loadingDetection ? "animate-spin" : "fill-current"} />
              <span>{loadingDetection ? 'Running Inference...' : 'Run All Frames (Batch)'}</span>
            </button>
          </div>
        </div>

        {/* Streamlined Preprocessing Filter Toolbar & Confidence Slider (Class filter bar removed per Image 2) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs">
          {/* Preprocessing Filter Modes */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-semibold text-[11px] flex items-center gap-1.5 mr-1">
              <Wand2 size={13} className="text-sky-600" /> ACOUSTIC FILTER MODE:
            </span>
            {[
              { id: 'raw', label: 'Raw Sonar' },
              { id: 'clahe', label: 'CLAHE Enhanced' },
              { id: 'denoised', label: 'Speckle Denoised' },
              { id: 'enhanced', label: 'Combined (CLAHE+Denoise)' }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setPreprocessMode(mode.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  preprocessMode === mode.id
                    ? 'bg-sky-600 text-white shadow-sm font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Confidence Slider & Telemetry */}
          <div className="flex items-center gap-4">
            {acousticStats && (
              <div className="hidden md:flex items-center gap-3 text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
                <span>Mean: <strong className="text-slate-800">{acousticStats.mean_intensity}</strong></span>
                <span>Contrast: <strong className="text-slate-800">{acousticStats.contrast_ratio}</strong></span>
                <span>Shadow: <strong className="text-sky-700">{acousticStats.shadow_pixel_pct}%</strong></span>
              </div>
            )}

            <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Sliders size={13} className="text-sky-600" />
              <span className="text-slate-600 font-medium text-[11px]">Min Conf:</span>
              <input 
                type="range" 
                min="0.10" 
                max="0.95" 
                step="0.05" 
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                className="w-24 accent-sky-600 cursor-pointer" 
              />
              <span className="text-sky-700 font-bold font-mono w-9 text-right text-xs">
                {Math.round(confThreshold * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Notification alerts */}
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
      </div>

      {/* Main Analysis Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Frames Carousel Selector */}
        <div className="space-y-4">
          <div className="glass-panel p-4 border border-slate-200 space-y-3 bg-white shadow-soft">
            <h4 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <Layers size={14} className="text-sky-600" /> SURVEY FRAMES ({surveyImages.length})
              </span>
            </h4>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {surveyImages.map((img) => {
                const isSelected = img.id === selectedImageId;
                return (
                  <div
                    key={img.id}
                    onClick={() => setSelectedImageId(img.id)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'bg-sky-50 border-sky-400 shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <div className="w-12 h-10 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-300">
                      <img 
                        src={getImageFileUrl(img.id)} 
                        alt={img.filename}
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="text-[11px] truncate flex-1">
                      <div className="font-mono font-bold text-slate-800">{img.frame_id}</div>
                      <div className="text-slate-500 truncate text-[10px]">{img.filename}</div>
                    </div>
                    <ChevronRight size={14} className={isSelected ? 'text-sky-600' : 'text-slate-300'} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Interactive Acoustic Canvas with Bounding Box Overlays */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-4 border border-slate-200 space-y-3 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-800 font-bold">{selectedImageMeta?.frame_id || 'FRAME'}</span>
                <span className="text-slate-400">({selectedImageMeta?.width}x{selectedImageMeta?.height})</span>
                <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  MODE: {preprocessMode}
                </span>
              </div>
              <div className="text-slate-500 flex items-center gap-1 text-[11px]">
                <MapPin size={11} className="text-sky-600" />
                <span>{selectedImageMeta?.simulated_lat?.toFixed(5)}°N, {selectedImageMeta?.simulated_lon?.toFixed(5)}°E</span>
              </div>
            </div>

            {/* Main Interactive Sonar Viewport */}
            <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-300 shadow-inner flex items-center justify-center min-h-[460px] p-2">
              {selectedImageId ? (
                <div className="relative inline-block max-h-[580px] max-w-full">
                  <img 
                    src={getPreprocessedImageUrl(selectedImageId, preprocessMode)} 
                    alt="Sonar Viewport"
                    className="max-h-[580px] w-auto max-w-full object-contain block mx-auto select-none"
                  />

                  {/* SVG Overlay for Bounding Boxes */}
                  {selectedImageMeta && (
                    <svg 
                      viewBox={`0 0 ${selectedImageMeta.width} ${selectedImageMeta.height}`}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ width: '100%', height: '100%' }}
                      preserveAspectRatio="none"
                    >
                      {filteredDetections.map((det) => {
                        const style = CLASS_COLORS[det.class_name.toLowerCase()] || { border: '#0284c7', bg: 'rgba(2, 132, 199, 0.2)', text: '#0284c7' };
                        const isSelected = det.id === selectedDetectionId;
                        const x1 = det.bbox_x1 !== undefined ? det.bbox_x1 : (det.bbox ? det.bbox[0] : 0);
                        const y1 = det.bbox_y1 !== undefined ? det.bbox_y1 : (det.bbox ? det.bbox[1] : 0);
                        const x2 = det.bbox_x2 !== undefined ? det.bbox_x2 : (det.bbox ? det.bbox[2] : 0);
                        const y2 = det.bbox_y2 !== undefined ? det.bbox_y2 : (det.bbox ? det.bbox[3] : 0);
                        const bw = Math.max(1, x2 - x1);
                        const bh = Math.max(1, y2 - y1);

                        return (
                          <g key={det.id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedDetectionId(det.id)}>
                            <rect
                              x={x1}
                              y={y1}
                              width={bw}
                              height={bh}
                              fill={isSelected ? style.bg : 'rgba(2, 132, 199, 0.12)'}
                              stroke={style.border}
                              strokeWidth={isSelected ? "4" : "3"}
                              strokeDasharray={isSelected ? "none" : "none"}
                              rx="4"
                            />
                            {/* Class Label Badge */}
                            <g transform={`translate(${x1}, ${Math.max(18, y1 - 6)})`}>
                              <rect
                                x="0"
                                y="-18"
                                width={Math.max(80, det.class_name.length * 9 + 45)}
                                height="22"
                                fill={style.border}
                                rx="4"
                              />
                              <text
                                x="8"
                                y="-3"
                                fill="#ffffff"
                                fontSize="12"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {det.class_name.toUpperCase()} {Math.round(det.confidence * 100)}%
                              </text>
                            </g>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              ) : (
                <div className="text-slate-400 text-xs font-mono">No Image Selected</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detected Targets & Quick Crops Drawer */}
        <div className="space-y-4">
          <div className="glass-panel p-4 border border-slate-200 space-y-3 bg-white shadow-soft">
            <h4 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <Target size={14} className="text-sky-600" /> TARGET CROPS ({filteredDetections.length})
              </span>
            </h4>

            {filteredDetections.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                <Target size={24} className="mx-auto text-slate-300 opacity-60" />
                <p>No objects detected above {Math.round(confThreshold * 100)}% confidence.</p>
                <p className="text-[10px] text-slate-400">Click "Detect Current Frame" to run YOLO inference.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {filteredDetections.map((det) => {
                  const isSelected = det.id === selectedDetectionId;
                  const style = CLASS_COLORS[det.class_name.toLowerCase()] || { border: '#0284c7', text: '#0284c7' };
                  const x1 = det.bbox_x1 !== undefined ? det.bbox_x1 : (det.bbox ? det.bbox[0] : 0);
                  const y1 = det.bbox_y1 !== undefined ? det.bbox_y1 : (det.bbox ? det.bbox[1] : 0);
                  const x2 = det.bbox_x2 !== undefined ? det.bbox_x2 : (det.bbox ? det.bbox[2] : 0);
                  const y2 = det.bbox_y2 !== undefined ? det.bbox_y2 : (det.bbox ? det.bbox[3] : 0);
                  const bw = Math.max(1, x2 - x1);
                  const bh = Math.max(1, y2 - y1);
                  
                  return (
                    <div
                      key={det.id}
                      onClick={() => setSelectedDetectionId(det.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                        isSelected 
                          ? 'bg-sky-50 border-sky-400 shadow-sm ring-1 ring-sky-400/30' 
                          : 'bg-slate-50 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      {/* Crop Image & Label Header */}
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 bg-black rounded-lg overflow-hidden border border-slate-300 shrink-0 relative">
                          <img 
                            src={getDetectionCropUrl(det.id)} 
                            alt={det.class_name}
                            className="w-full h-full object-cover" 
                          />
                        </div>

                        <div className="text-xs space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                            <span 
                              className="font-mono font-bold text-[11px] uppercase px-1.5 py-0.2 rounded"
                              style={{ color: style.text, backgroundColor: 'rgba(240, 249, 255, 0.9)' }}
                            >
                              {det.class_name}
                            </span>
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {Math.round(det.confidence * 100)}%
                            </span>
                          </div>

                          <div className="text-[10px] font-mono text-slate-500">
                            Size: {bw} × {bh} px
                          </div>

                          <div className="text-[10px] font-mono text-slate-600">
                            Status: <strong className="text-sky-700">{det.status}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Action Button: Jump to Evidence Intelligence */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectEvidenceDetection) {
                            onSelectEvidenceDetection(det.id);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-sky-600 text-sky-700 hover:text-white border border-sky-200 rounded-lg text-[11px] font-semibold transition-all shadow-xs cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>Inspect in Evidence Cockpit</span>
                        <ChevronRight size={12} />
                      </button>
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
