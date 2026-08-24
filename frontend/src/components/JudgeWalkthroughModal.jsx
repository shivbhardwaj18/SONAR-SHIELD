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
  Sliders, 
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
    subtitle: "Why pure YOLO fails in sonar — and how SONAR-SHIELD solves it.",
    badge: "THE PROBLEM & INNOVATION",
    icon: Sparkles,
    content: (
      <div className="space-y-4 text-xs font-mono text-slate-300">
        <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl space-y-1.5">
          <span className="text-red-300 font-bold block uppercase text-[11px]">The Core Sonar AI Bottleneck:</span>
          <p className="leading-relaxed">
            Side-scan sonar imagery suffers from acoustic speckle noise, gain variations, and bottom reverberations. Standard YOLO models trained on limited data frequently hallucinate high-confidence false positives on natural rock formations and sand ripples.
          </p>
        </div>

        <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/40 rounded-xl space-y-1.5">
          <span className="text-cyan-300 font-bold block uppercase text-[11px]">The SONAR-SHIELD Solution:</span>
          <p className="leading-relaxed">
            <strong className="text-white">"YOLO proposes a candidate; SONAR-SHIELD questions why it should be trusted."</strong> We introduce a multi-feature physics evidence layer (Shape Geometry, Acoustic Shadow analysis, and Seabed Context variation) fused into a transparent <strong>Prototype Artificiality Score</strong>.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-cyan-400 font-bold block">100%</span>
            <span className="text-[10px] text-slate-500">Autonomous Reasoning</span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-amber-400 font-bold block">4-Channel</span>
            <span className="text-[10px] text-slate-500">Evidence Fusion</span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-teal-400 font-bold block">DBSCAN</span>
            <span className="text-[10px] text-slate-500">Spatial Hotspots</span>
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
      <div className="space-y-4 text-xs font-mono text-slate-300">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-cyan-300 font-bold block uppercase text-[10px]">Acoustic Filters</span>
            <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
              <li><strong>CLAHE Enhancement</strong> (adaptive localized contrast)</li>
              <li><strong>Bilateral Denoising</strong> (edge-preserving speckle filter)</li>
              <li><strong>Dynamic Range Normalization</strong></li>
            </ul>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-amber-300 font-bold block uppercase text-[10px]">YOLO Detection</span>
            <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
              <li>5 Target Classes (Shipwreck, Tyre, Reef, Rock, Ripple)</li>
              <li>Context-Padded Object Crop Extraction</li>
              <li>Interactive Confidence Thresholding</li>
            </ul>
          </div>
        </div>

        <div className="p-3 bg-slate-900/90 rounded-xl border border-cyan-500/20 text-[11px] text-slate-300 space-y-1">
          <span className="text-cyan-400 font-bold block">Acoustic Telemetry Widget:</span>
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
      <div className="space-y-3 text-xs font-mono text-slate-300">
        <div className="p-2.5 bg-slate-950 rounded-lg border border-amber-900/50 flex items-start gap-2.5">
          <div className="w-6 h-6 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold flex-shrink-0 text-xs">1</div>
          <div>
            <span className="text-amber-300 font-bold block">Shape Geometry Evidence</span>
            <p className="text-[11px] text-slate-400">Otsu thresholding, contour & convex hull analysis measuring Circularity, Aspect Ratio, Solidity, and Extent against expected class templates.</p>
          </div>
        </div>

        <div className="p-2.5 bg-slate-950 rounded-lg border border-purple-900/50 flex items-start gap-2.5">
          <div className="w-6 h-6 rounded bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold flex-shrink-0 text-xs">2</div>
          <div>
            <span className="text-purple-300 font-bold block">Acoustic Shadow Evidence</span>
            <p className="text-[11px] text-slate-400">Lateral acoustic swath search evaluating relative contrast drop and dark pixel void ratio (&lt;45 intensity) behind protruding structures.</p>
          </div>
        </div>

        <div className="p-2.5 bg-slate-950 rounded-lg border border-blue-900/50 flex items-start gap-2.5">
          <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold flex-shrink-0 text-xs">3</div>
          <div>
            <span className="text-blue-300 font-bold block">Seabed Context Evidence</span>
            <p className="text-[11px] text-slate-400">Annular surrounding background extraction evaluating local contrast saliency and texture variance to detect foreign objects on uniform sediment.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "4. Artificiality Score & Human-in-the-Loop Review",
    subtitle: "Transparent mathematical fusion and operator audit decision strip.",
    badge: "CENTRAL REASONING",
    icon: Sliders,
    content: (
      <div className="space-y-4 text-xs font-mono text-slate-300">
        <div className="p-3 bg-gradient-to-r from-cyan-950/80 to-slate-950 border border-cyan-500/40 rounded-xl space-y-1.5">
          <span className="text-cyan-300 font-bold block uppercase text-[10px]">Transparent Formula:</span>
          <div className="p-2 bg-black/60 rounded border border-slate-800 text-cyan-200 text-center font-bold text-xs">
            0.40(AI Conf) + 0.25(Shape) + 0.20(Shadow) + 0.15(Context)
          </div>
          <span className="text-[10px] text-slate-400 block text-right">All weights dynamically customizable in real-time</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-teal-400 font-bold block uppercase text-[10px]">Automated Triage</span>
            <p className="text-slate-400">&ge;80%: Validated Debris<br/>60-79%: Needs Review<br/>&lt;60%: Low Artificiality</p>
          </div>

          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-amber-400 font-bold block uppercase text-[10px]">Human Review Cockpit</span>
            <p className="text-slate-400">1-click Approve, Reject, or Flag with timestamped operator audit logs.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "5. Hotspots, Bio-Threat & Cleanup Priorities",
    subtitle: "Spatial clustering, ecological impact modeling, and recovery equipment dispatch.",
    badge: "ACTIONABLE INTELLIGENCE",
    icon: Compass,
    content: (
      <div className="space-y-4 text-xs font-mono text-slate-300">
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
          <span className="text-teal-300 font-bold block uppercase text-[10px]">DBSCAN Spatial Hotspots:</span>
          <p className="leading-relaxed text-[11px] text-slate-400">
            Groups proximal detections into named <strong>Debris Fields</strong> (e.g. 55m radius), calculating centroid coordinates, footprint area in m&sup2;, and boundary GeoJSON polygons.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div className="p-2.5 bg-slate-950 rounded-lg border border-amber-900/50 space-y-1">
            <span className="text-amber-300 font-bold block uppercase text-[10px]">Bio-Threat Index</span>
            <p className="text-slate-400">Material toxicity (tyres: 0.85, shipwrecks: 0.75) scaled by cluster density and benthic area.</p>
          </div>

          <div className="p-2.5 bg-slate-950 rounded-lg border border-cyan-900/50 space-y-1">
            <span className="text-cyan-300 font-bold block uppercase text-[10px]">Habitat Protection</span>
            <p className="text-slate-400">Artificial Reefs explicitly exempted as <strong>Protected Sanctuaries (Do Not Remove)</strong>.</p>
          </div>
        </div>

        <div className="p-2.5 bg-slate-900/90 rounded-xl border border-cyan-500/20 text-[11px] text-slate-300 flex items-center justify-between">
          <span>Actionable Recovery Protocols:</span>
          <span className="text-cyan-300 font-bold">Winch Net Baskets & ROV Booms</span>
        </div>
      </div>
    )
  }
];

export default function JudgeWalkthroughModal({ isOpen, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slide = SLIDES[currentSlide];
  const IconComponent = slide.icon;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b1329] border border-cyan-500/50 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-fadeIn flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
              <IconComponent size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-tech text-base font-bold text-white tracking-wide">
                  {slide.title}
                </h3>
                <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px] font-mono px-2 py-0.5 rounded">
                  {slide.badge}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">{slide.subtitle}</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Slide Content Area */}
        <div className="flex-1 overflow-y-auto py-2">
          {slide.content}
        </div>

        {/* Slide Footer & Navigation */}
        <div className="border-t border-slate-800 pt-4 flex items-center justify-between font-mono text-xs">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentSlide === idx ? 'w-6 bg-cyan-400' : 'w-2 bg-slate-800 hover:bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
              disabled={currentSlide === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Prev</span>
            </button>

            {currentSlide < SLIDES.length - 1 ? (
              <button
                onClick={() => setCurrentSlide(currentSlide + 1)}
                className="flex items-center gap-1 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold shadow-lg shadow-cyan-600/20 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 text-white rounded-lg font-bold shadow-lg shadow-teal-600/20 cursor-pointer"
              >
                <span>Start Evaluation</span>
                <CheckCircle2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
