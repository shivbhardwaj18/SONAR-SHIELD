import React, { useState } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  ShieldCheck, 
  Eye, 
  Compass, 
  Layers, 
  Wrench, 
  MapPin, 
  FileText,
  Activity,
  Zap,
  CheckCircle2
} from 'lucide-react';

const SLIDES = [
  {
    title: "1. The Challenge & Core Innovation",
    subtitle: "Why pure YOLO fails in sonar — and how SAGAR NETRA solves it.",
    badge: "THE PROBLEM & INNOVATION",
    icon: Sparkles,
    content: (
      <div className="space-y-4 text-xs text-slate-700">
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl space-y-1.5">
          <span className="text-red-700 font-bold block uppercase text-[11px]">The Core Sonar AI Bottleneck:</span>
          <p className="leading-relaxed">
            Side-scan sonar imagery suffers from acoustic speckle noise, gain variations, and bottom reverberations. Standard YOLO models trained on limited data frequently hallucinate high-confidence false alarms on natural rock formations and sand ripples.
          </p>
        </div>

        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl space-y-1.5">
          <span className="text-sky-800 font-bold block uppercase text-[11px]">The SAGAR NETRA Solution:</span>
          <p className="leading-relaxed">
            <strong className="text-slate-900">“YOLO proposes a candidate; SAGAR NETRA questions why it should be trusted.”</strong> We introduce a multi-feature physics evidence layer (Shape Geometry, Acoustic Shadow analysis, and Seabed Context variation) fused into a transparent <strong>Prototype Artificiality Score</strong>.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1 text-center">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-sky-700 font-bold block text-base">100%</span>
            <span className="text-[10px] text-slate-500 font-medium">Autonomous Reasoning</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-amber-600 font-bold block text-base">4-Channel</span>
            <span className="text-[10px] text-slate-500 font-medium">Evidence Fusion</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-teal-600 font-bold block text-base">DBSCAN</span>
            <span className="text-[10px] text-slate-500 font-medium">Spatial Hotspots</span>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "2. Acoustic Preprocessing & YOLO Detection",
    subtitle: "Enhancing raw acoustic echoes before neural object extraction.",
    badge: "ACOUSTIC PIPELINE",
    icon: Activity,
    content: (
      <div className="space-y-4 text-xs text-slate-700">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <span className="text-sky-800 font-bold block uppercase text-[10px]">Acoustic Filters</span>
            <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px]">
              <li><strong>CLAHE Enhancement</strong> (adaptive localized contrast)</li>
              <li><strong>Bilateral Denoising</strong> (edge-preserving speckle filter)</li>
              <li><strong>Dynamic Range Normalization</strong></li>
            </ul>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <span className="text-amber-700 font-bold block uppercase text-[10px]">Fine-Tuned YOLO</span>
            <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px]">
              <li>3 Target Classes (Shipwreck, Tyre, Ghost Net)</li>
              <li>Context-Padded Object Crop Extraction</li>
              <li>Confidence Thresholding</li>
            </ul>
          </div>
        </div>

        <div className="p-3.5 bg-sky-50 rounded-xl border border-sky-200 text-[11px] text-slate-700 space-y-1">
          <span className="text-sky-800 font-bold block">Acoustic Telemetry Widget:</span>
          <p>Real-time calculation of Mean Signal Intensity, Noise Standard Deviation, Dynamic Range Spread, and Signal-to-Noise Ratio (SNR) for every acoustic frame.</p>
        </div>
      </div>
    )
  },
  {
    title: "3. Physics Evidence Layer: Shape, Shadow & Context",
    subtitle: "Extracting geometric, acoustic occlusion, and benthic contrast proofs.",
    badge: "EVIDENCE EXTRACTION",
    icon: Eye,
    content: (
      <div className="space-y-3 text-xs text-slate-700">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
          <span className="text-amber-600 font-bold text-sm">1.</span>
          <div>
            <strong className="text-slate-900 block font-sans">Shape Evidence (Circularity, Aspect Ratio, Solidity):</strong>
            <span className="text-slate-600 text-[11px]">Evaluates whether the contour matches man-made geometry (e.g. circular tyre rims, long rectangular ship keels, or porous ghost nets).</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
          <span className="text-purple-600 font-bold text-sm">2.</span>
          <div>
            <strong className="text-slate-900 block font-sans">Acoustic Shadow Evidence (Occlusion & Contrast Drop):</strong>
            <span className="text-slate-600 text-[11px]">Analyzes lateral dark acoustic void zones behind protruding subsea structures caused by sound wave blockage.</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
          <span className="text-blue-600 font-bold text-sm">3.</span>
          <div>
            <strong className="text-slate-900 block font-sans">Seabed Context Evidence (Annular Local Saliency):</strong>
            <span className="text-slate-600 text-[11px]">Compares target intensity against surrounding annular seabed sediment to ensure it is a foreign object.</span>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "4. Multi-Evidence Fusion & False-Positive Triage",
    subtitle: "Transparent mathematical scoring and human operator review audit trail.",
    badge: "FUSION & TRIAGE",
    icon: ShieldCheck,
    content: (
      <div className="space-y-4 text-xs text-slate-700">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <span className="text-sky-800 font-bold block uppercase text-[11px]">The Mathematical Fusion Formula:</span>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-center text-xs font-bold text-slate-800 shadow-xs">
            Artificiality = 0.40·AI + 0.25·Shape + 0.20·Shadow + 0.15·Context
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <span className="font-bold text-emerald-800 block text-xs">Score ≥ 80%:</span>
            <span className="text-[11px] text-emerald-700">VALIDATED DEBRIS — Passes directly to Remediation Matrix.</span>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="font-bold text-amber-800 block text-xs">Score 60% – 79%:</span>
            <span className="text-[11px] text-amber-700">NEEDS REVIEW — Sent to Human Operator Cockpit with audit trail.</span>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "5. Spatial Hotspots, Bio-Threat & Multi-Format Exports",
    subtitle: "DBSCAN clustering, habitat protection, and actionable recovery dispatch.",
    badge: "MISSION DISPATCH",
    icon: Compass,
    content: (
      <div className="space-y-3.5 text-xs text-slate-700">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-sky-800 font-bold block uppercase text-[10px]">DBSCAN Hotspots</span>
            <p className="text-[11px] text-slate-600">Groups isolated targets within 55m into coherent Debris Fields with Shoelace footprint area estimates.</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-amber-700 font-bold block uppercase text-[10px]">Bio-Threat Index</span>
            <p className="text-[11px] text-slate-600">Evaluates toxicity hazard (Ghost Nets: 0.90, Tyres: 0.85, Shipwrecks: 0.75, Reefs: Protected 0.00).</p>
          </div>
        </div>

        <div className="p-3.5 bg-sky-50 rounded-xl border border-sky-200 space-y-1">
          <span className="text-sky-900 font-bold block uppercase text-[11px]">Multi-Format Export Support:</span>
          <p className="text-[11px] text-slate-700">1-Click export to Tabular CSV streams, QGIS/ArcGIS GeoJSON, JSON Dossiers, and Printable Executive Briefings.</p>
        </div>
      </div>
    )
  }
];

export default function JudgeWalkthroughModal({ isOpen, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slide = SLIDES[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700">
              <Icon size={16} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-sky-800 uppercase tracking-wide">
                {slide.badge} ({currentSlide + 1}/{SLIDES.length})
              </span>
              <h3 className="font-tech text-base font-bold text-slate-900">
                {slide.title}
              </h3>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-slate-500 font-sans -mt-2">
          {slide.subtitle}
        </p>

        {/* Slide Content Body */}
        <div className="min-h-[240px] flex flex-col justify-center">
          {slide.content}
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft size={14} />
            <span>Previous</span>
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentSlide === idx ? 'w-6 bg-sky-600' : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (currentSlide < SLIDES.length - 1) {
                setCurrentSlide(currentSlide + 1);
              } else {
                onClose();
              }
            }}
            className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 cursor-pointer"
          >
            <span>{currentSlide === SLIDES.length - 1 ? 'Close Guide' : 'Next Slide'}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
