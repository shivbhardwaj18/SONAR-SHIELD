import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  MapPin, 
  FileImage, 
  Info, 
  Maximize2, 
  HardDrive, 
  RefreshCw, 
  FolderOpen,
  Compass,
  PlusCircle,
  ChevronDown
} from 'lucide-react';
import { loadDemoSurvey, uploadSurveyImages, getImageFileUrl } from '../api';

export default function IngestionPanel({ 
  currentSurvey, 
  surveyImages, 
  surveysList, 
  onSurveySelect, 
  onSurveyLoaded 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null);

  // Custom Survey Form State
  const [surveyName, setSurveyName] = useState('');
  const [surveyDesc, setSurveyDesc] = useState('');
  const [startLat, setStartLat] = useState('18.9220');
  const [startLon, setStartLon] = useState('72.8340');
  const [selectedFiles, setSelectedFiles] = useState([]);

  const fileInputRef = useRef(null);

  const handleLoadDemo = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await loadDemoSurvey();
      setSuccessMsg(`Successfully loaded ${res.data.total_images} pre-packaged demo sonar frames!`);
      if (onSurveyLoaded) {
        onSurveyLoaded(res.data.survey_id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load demo survey');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const nameToUse = surveyName.trim() || `Acoustic Survey (${new Date().toLocaleTimeString()})`;
      const descToUse = surveyDesc.trim() || `Geotagged Survey at ${startLat}°N, ${startLon}°E`;

      const res = await uploadSurveyImages(files, nameToUse, descToUse);
      setSuccessMsg(`Created Survey ${res.survey_id} and ingested ${res.total_uploaded} sonar frame(s)!`);
      
      // Reset form
      setSurveyName('');
      setSurveyDesc('');
      setSelectedFiles([]);

      if (onSurveyLoaded) {
        onSurveyLoaded(res.survey_id);
      }
    } catch (err) {
      setError(err.message || 'Failed to upload files');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="space-y-6">
      {/* Notice Banner: Scientific Transparency & Geotagging */}
      <div className="bg-slate-900/90 border border-cyan-500/20 rounded-xl p-4 flex items-start gap-3 shadow-lg">
        <Info className="text-cyan-400 shrink-0 mt-0.5" size={18} />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-slate-200">
            Phase 1 Active: Standardized Acoustic Ingestion & Automatic Geotagging Engine
          </p>
          <p className="text-slate-400 leading-relaxed">
            Side-Scan Sonar (SSS) imagery is ingested, validated for raw byte integrity, assigned deterministic frame identifiers, and registered with consistent <strong>Simulated Survey Coordinates</strong>. Each frame gets sequential GPS trackline geometry along the swath corridor automatically.
          </p>
        </div>
      </div>

      {/* Action Strip & Survey Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Actions & Custom Ingestion Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-tech text-base font-bold text-white tracking-wide flex items-center gap-2">
                  <PlusCircle className="text-cyan-400" size={18} />
                  CREATE NEW ACOUSTIC SURVEY
                </h3>
                <p className="text-xs text-slate-400">
                  Upload new sonar image batches with custom survey labels and starting coordinates.
                </p>
              </div>

              {/* 1-Click Demo Button */}
              <button
                onClick={handleLoadDemo}
                disabled={loading}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 hover:from-cyan-500/30 hover:to-teal-500/30 text-cyan-300 border border-cyan-500/50 rounded-lg text-xs font-semibold shadow-md shadow-cyan-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={14} className={loading ? "animate-spin" : "text-cyan-400"} />
                <span>{loading ? 'Ingesting...' : 'Load Pre-packaged Demo Survey'}</span>
              </button>
            </div>

            {/* Custom Survey Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Survey Name / Label:</label>
                <input 
                  type="text" 
                  placeholder="e.g. Coastal Survey Mumbai #02"
                  value={surveyName}
                  onChange={(e) => setSurveyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Survey Description (Optional):</label>
                <input 
                  type="text" 
                  placeholder="e.g. Shallow water debris audit"
                  value={surveyDesc}
                  onChange={(e) => setSurveyDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Starting Latitude (°N):</label>
                <input 
                  type="text" 
                  value={startLat}
                  onChange={(e) => setStartLat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Starting Longitude (°E):</label>
                <input 
                  type="text" 
                  value={startLon}
                  onChange={(e) => setStartLon(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                dragActive 
                  ? 'border-cyan-400 bg-cyan-950/30' 
                  : 'border-slate-800 hover:border-cyan-500/40 bg-slate-950/40 hover:bg-slate-900/40'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                accept=".png,.jpg,.jpeg,.bmp,.tif,.tiff" 
                className="hidden" 
                onChange={handleFileInputChange} 
              />
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400 mb-0.5">
                <FolderOpen size={20} />
              </div>
              <p className="text-xs font-medium text-slate-200">
                {selectedFiles.length > 0 ? (
                  <span className="text-cyan-300 font-bold">{selectedFiles.length} sonar image(s) selected</span>
                ) : (
                  <>Drag & drop sonar images here, or <span className="text-cyan-400 underline">browse files</span></>
                )}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                PNG, JPG, JPEG, BMP, TIF, TIFF (Single or Multi-Frame Batch)
              </p>
            </div>

            {/* Ingest Action Button */}
            {selectedFiles.length > 0 && (
              <button
                onClick={() => handleFileUpload(selectedFiles)}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold font-mono shadow-lg shadow-cyan-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <UploadCloud size={16} />
                <span>{loading ? 'Ingesting & Geotagging...' : `Ingest & Launch Survey (${selectedFiles.length} Frames)`}</span>
              </button>
            )}

            {/* Notification messages */}
            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg flex items-center gap-2 text-xs text-red-300 font-mono">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg flex items-center gap-2 text-xs text-emerald-300 font-mono">
                <CheckCircle2 size={15} />
                <span>{successMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Survey Status & Telemetry */}
        <div className="space-y-4">
          <div className="glass-panel p-5 border border-slate-800 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h4 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <HardDrive size={14} className="text-cyan-400" />
                  ACTIVE SURVEY TELEMETRY
                </h4>
                {currentSurvey?.is_demo && (
                  <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded">
                    DEMO MODE
                  </span>
                )}
              </div>

              {currentSurvey ? (
                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Survey ID</span>
                    <span className="text-cyan-300 font-semibold">{currentSurvey.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Survey Label</span>
                    <span className="text-slate-200">{currentSurvey.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Total Frames</span>
                    <span className="text-white font-bold">{currentSurvey.total_images}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Ingestion Status</span>
                    <span className="text-emerald-400 font-bold uppercase">{currentSurvey.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Simulated Base Grid</span>
                    <span className="text-slate-400 text-[11px]">18.9220° N, 72.8340° E (Coastal Grid)</span>
                  </div>

                  {/* Survey Switcher Dropdown */}
                  {surveysList && surveysList.length > 1 && (
                    <div className="pt-2">
                      <label className="text-slate-500 block text-[10px] uppercase mb-1">Switch Survey:</label>
                      <select 
                        value={currentSurvey.id} 
                        onChange={(e) => onSurveySelect(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                      >
                        {surveysList.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.total_images} frames)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <RefreshCw className="animate-spin mx-auto mb-2 text-slate-600" size={20} />
                  <span>No survey loaded. Click "Load Demo" or upload images above.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ingested Frames Gallery Grid */}
      <div className="glass-panel p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-tech text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Layers className="text-cyan-400" size={16} />
              INGESTED ACOUSTIC FRAMES ({surveyImages.length})
            </h3>
            <p className="text-xs text-slate-400">
              Each frame is standardized with deterministic indexing and simulated spatial coordinates.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded">
            {surveyImages.length} Model-Ready Frames
          </span>
        </div>

        {surveyImages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            No frames available in this survey.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {surveyImages.map((img) => (
              <div 
                key={img.id}
                onClick={() => setSelectedPreviewImage(img)}
                className="group bg-slate-950/70 border border-slate-800/90 hover:border-cyan-500/50 rounded-lg p-2 transition-all cursor-pointer space-y-2 relative"
              >
                <div className="aspect-[4/3] bg-black rounded overflow-hidden relative border border-slate-800">
                  <img 
                    src={getImageFileUrl(img.id)} 
                    alt={img.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <Maximize2 size={16} className="text-cyan-300 drop-shadow" />
                  </div>
                </div>

                <div className="font-mono text-[10px] space-y-0.5">
                  <div className="text-cyan-400 font-bold truncate">{img.frame_id}</div>
                  <div className="text-slate-400 truncate">{img.filename}</div>
                  <div className="text-slate-500 flex items-center gap-1">
                    <MapPin size={9} className="text-teal-400" />
                    <span>{img.simulated_lat?.toFixed(4)}°N, {img.simulated_lon?.toFixed(4)}°E</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Frame Preview Modal */}
      {selectedPreviewImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-cyan-500/50 rounded-xl max-w-3xl w-full p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-mono">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileImage size={16} className="text-cyan-400" />
                FRAME PREVIEW: {selectedPreviewImage.frame_id} ({selectedPreviewImage.filename})
              </h3>
              <button 
                onClick={() => setSelectedPreviewImage(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="bg-black rounded-lg overflow-hidden border border-slate-800 max-h-[60vh] flex items-center justify-center">
              <img 
                src={getImageFileUrl(selectedPreviewImage.id)} 
                alt={selectedPreviewImage.filename}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px]">Dimensions</span>
                <span className="text-slate-200">{selectedPreviewImage.width} x {selectedPreviewImage.height} px</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">File Size</span>
                <span className="text-slate-200">{selectedPreviewImage.file_size_kb} KB</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Simulated GPS</span>
                <span className="text-cyan-300 font-bold">{selectedPreviewImage.simulated_lat?.toFixed(5)}°N, {selectedPreviewImage.simulated_lon?.toFixed(5)}°E</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
