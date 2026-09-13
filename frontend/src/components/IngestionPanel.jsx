import React, { useState, useRef, useMemo } from 'react';
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

  // Custom Survey Form State (Defaults to Mumbai Harbor South Deepwater Fairway)
  const [surveyName, setSurveyName] = useState('');
  const [surveyDesc, setSurveyDesc] = useState('');
  const [startLat, setStartLat] = useState('18.9150');
  const [startLon, setStartLon] = useState('72.8700');
  const [selectedFiles, setSelectedFiles] = useState([]);

  const fileInputRef = useRef(null);

  // Deduplicate and filter surveys for clean compact dropdown (Image 1 fix)
  const cleanSurveysList = useMemo(() => {
    if (!surveysList || surveysList.length === 0) return [];
    
    const seen = new Set();
    const unique = [];
    for (const s of surveysList) {
      const key = `${s.id}_${s.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }
    return unique.slice(0, 6);
  }, [surveysList]);

  // Inspect uploaded/dropped files for survey_info.json to auto-fill form fields
  const processFiles = (fileArray) => {
    setSelectedFiles(fileArray);
    setError(null);

    const jsonFile = fileArray.find(f => f.name.toLowerCase().endsWith('.json'));
    if (jsonFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const info = JSON.parse(e.target.result);
          if (info.survey_name || info.name) {
            setSurveyName(info.survey_name || info.name);
          }
          if (info.description || info.desc) {
            setSurveyDesc(info.description || info.desc);
          }
          if (info.base_latitude !== undefined || info.latitude !== undefined || info.start_lat !== undefined) {
            const lat = info.base_latitude ?? info.latitude ?? info.start_lat;
            setStartLat(String(lat));
          }
          if (info.base_longitude !== undefined || info.longitude !== undefined || info.start_lon !== undefined) {
            const lon = info.base_longitude ?? info.longitude ?? info.start_lon;
            setStartLon(String(lon));
          }
          setSuccessMsg(`Auto-filled survey parameters from '${jsonFile.name}'! (Name: ${info.survey_name || info.name || 'Loaded'})`);
        } catch (err) {
          console.warn('Failed to parse survey JSON:', err);
        }
      };
      reader.readAsText(jsonFile);
    }
  };

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

      const res = await uploadSurveyImages(
        files, 
        nameToUse, 
        descToUse, 
        parseFloat(startLat) || 18.9150, 
        parseFloat(startLon) || 72.8700
      );
      setSuccessMsg(`Created Survey '${res.survey_name || res.survey_id}' and ingested ${res.total_uploaded} sonar frame(s)!`);
      
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
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="space-y-6">
      {/* Notice Banner: Scientific Transparency & Geotagging */}
      <div className="bg-sky-50/80 border border-sky-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <Info className="text-sky-600 shrink-0 mt-0.5" size={18} />
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-800">
            Standardized Acoustic Ingestion & Automatic Swath Geotagging Engine
          </p>
          <p className="text-slate-600 leading-relaxed">
            Side-Scan Sonar (SSS) imagery is ingested, validated for raw byte integrity, assigned deterministic frame identifiers, and registered with consistent <strong>Simulated Survey Coordinates</strong>. Each frame gets sequential GPS trackline geometry along the swath corridor automatically.
          </p>
        </div>
      </div>

      {/* Action Strip & Survey Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Actions & Custom Ingestion Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-6 border border-slate-200 space-y-4 bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-tech text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <PlusCircle className="text-sky-600" size={18} />
                  CREATE NEW ACOUSTIC SURVEY
                </h3>
                <p className="text-xs text-slate-500">
                  Upload new sonar image batches with custom survey labels and starting coordinates.
                </p>
              </div>

              {/* 1-Click Demo Button */}
              <button
                onClick={handleLoadDemo}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-sky-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={14} className={loading ? "animate-spin" : "text-amber-200"} />
                <span>{loading ? 'Ingesting...' : 'Load Pre-packaged Demo Survey'}</span>
              </button>
            </div>

            {/* Custom Survey Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-600 font-medium text-[11px] block mb-1">Survey Name / Label:</label>
                <input 
                  type="text" 
                  placeholder="e.g. Coastal Survey Mumbai #02"
                  value={surveyName}
                  onChange={(e) => setSurveyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium text-[11px] block mb-1">Survey Description (Optional):</label>
                <input 
                  type="text" 
                  placeholder="e.g. Shallow water debris audit"
                  value={surveyDesc}
                  onChange={(e) => setSurveyDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium text-[11px] block mb-1">Starting Latitude (°N):</label>
                <input 
                  type="text" 
                  value={startLat}
                  onChange={(e) => setStartLat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium text-[11px] block mb-1">Starting Longitude (°E):</label>
                <input 
                  type="text" 
                  value={startLon}
                  onChange={(e) => setStartLon(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
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
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                dragActive 
                  ? 'border-sky-500 bg-sky-50' 
                  : 'border-slate-200 hover:border-sky-400 bg-slate-50/60 hover:bg-sky-50/30'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                accept=".png,.jpg,.jpeg,.bmp,.tif,.tiff,.csv,.json" 
                className="hidden" 
                onChange={handleFileInputChange} 
              />
              <div className="w-11 h-11 rounded-full bg-white border border-sky-100 shadow-sm flex items-center justify-center text-sky-600 mb-0.5">
                <FolderOpen size={20} />
              </div>
              <p className="text-xs font-semibold text-slate-700">
                {selectedFiles.length > 0 ? (
                  <span className="text-sky-700 font-bold">{selectedFiles.length} file(s) selected (Images, metadata.csv, survey_info.json)</span>
                ) : (
                  <>Drag & drop sonar images + optional <span className="text-sky-600 underline font-bold">metadata.csv / survey_info.json</span>, or browse files</>
                )}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Supports Sonar Images (.png, .jpg, .jpeg) + Optional <strong className="text-slate-600">metadata.csv</strong> & <strong className="text-slate-600">survey_info.json</strong>
              </p>
            </div>

            {/* Ingest Action Button */}
            {selectedFiles.length > 0 && (
              <button
                onClick={() => handleFileUpload(selectedFiles)}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <UploadCloud size={16} />
                <span>{loading ? 'Ingesting & Geotagging...' : `Ingest & Launch Survey (${selectedFiles.length} Frames)`}</span>
              </button>
            )}

            {/* Notification messages */}
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
        </div>

        {/* Right: Active Survey Status & Telemetry */}
        <div className="space-y-4">
          <div className="glass-panel p-6 border border-slate-200 h-full flex flex-col justify-between bg-white shadow-soft">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h4 className="font-tech text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <HardDrive size={14} className="text-sky-600" />
                  ACTIVE SURVEY TELEMETRY
                </h4>
                {currentSurvey?.is_demo && (
                  <span className="text-[10px] font-mono bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-full font-bold">
                    DEMO MODE
                  </span>
                )}
              </div>

              {currentSurvey ? (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Survey ID</span>
                    <span className="text-sky-700 font-mono font-bold text-sm">{currentSurvey.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Survey Label</span>
                    <span className="text-slate-800 font-medium">{currentSurvey.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Frames</span>
                    <span className="text-slate-900 font-bold text-base">{currentSurvey.total_images}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ingestion Status</span>
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[11px] uppercase inline-block">
                      {currentSurvey.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Simulated Base Grid</span>
                    <span className="text-slate-600 text-[11px] font-mono">18.9220° N, 72.8340° E (Coastal Grid)</span>
                  </div>

                  {/* Clean Compact Survey Switcher Dropdown (Image 1 fix) */}
                  {cleanSurveysList && cleanSurveysList.length > 1 && (
                    <div className="pt-2 border-t border-slate-100">
                      <label className="text-slate-500 block text-[10px] uppercase font-semibold mb-1.5">Switch Survey:</label>
                      <select 
                        value={currentSurvey.id} 
                        onChange={(e) => onSurveySelect(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-sky-800 font-medium focus:outline-none focus:border-sky-500 focus:bg-white transition-all shadow-sm"
                      >
                        {cleanSurveysList.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name.length > 32 ? s.name.substring(0, 32) + '...' : s.name} ({s.total_images} frames)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <RefreshCw className="animate-spin mx-auto mb-2 text-slate-300" size={20} />
                  <span>No survey loaded. Click "Load Demo" or upload images above.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ingested Frames Gallery Grid */}
      <div className="glass-panel p-6 border border-slate-200 space-y-4 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-tech text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="text-sky-600" size={16} />
              INGESTED ACOUSTIC FRAMES ({surveyImages.length})
            </h3>
            <p className="text-xs text-slate-500">
              Each frame is standardized with deterministic indexing and simulated spatial coordinates.
            </p>
          </div>
          <span className="text-xs font-mono text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1 rounded-full font-bold">
            {surveyImages.length} Model-Ready Frames
          </span>
        </div>

        {surveyImages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-mono">
            No frames available in this survey.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {surveyImages.map((img) => (
              <div 
                key={img.id}
                onClick={() => setSelectedPreviewImage(img)}
                className="group bg-slate-50 border border-slate-200 hover:border-sky-400 hover:shadow-md rounded-xl p-2.5 transition-all cursor-pointer space-y-2 relative"
              >
                <div className="aspect-[4/3] bg-black rounded-lg overflow-hidden relative border border-slate-200">
                  <img 
                    src={getImageFileUrl(img.id)} 
                    alt={img.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-sky-500/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <Maximize2 size={16} className="text-white drop-shadow" />
                  </div>
                </div>

                <div className="text-[11px] space-y-0.5">
                  <div className="text-sky-700 font-mono font-bold truncate">{img.frame_id}</div>
                  <div className="text-slate-600 truncate text-[10px]">{img.filename}</div>
                  <div className="text-slate-500 flex items-center gap-1 font-mono text-[10px]">
                    <MapPin size={9} className="text-sky-600" />
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 font-mono">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileImage size={16} className="text-sky-600" />
                FRAME PREVIEW: {selectedPreviewImage.frame_id} ({selectedPreviewImage.filename})
              </h3>
              <button 
                onClick={() => setSelectedPreviewImage(null)}
                className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer font-sans"
              >
                Close
              </button>
            </div>

            <div className="bg-black rounded-xl overflow-hidden border border-slate-200 max-h-[60vh] flex items-center justify-center">
              <img 
                src={getImageFileUrl(selectedPreviewImage.id)} 
                alt={selectedPreviewImage.filename}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[11px] bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">Dimensions</span>
                <span className="text-slate-800 font-semibold">{selectedPreviewImage.width} x {selectedPreviewImage.height} px</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">File Size</span>
                <span className="text-slate-800 font-semibold">{selectedPreviewImage.file_size_kb} KB</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Simulated GPS</span>
                <span className="text-sky-700 font-bold">{selectedPreviewImage.simulated_lat?.toFixed(5)}°N, {selectedPreviewImage.simulated_lon?.toFixed(5)}°E</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
