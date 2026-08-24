# SONAR-SHIELD 🛡️🌊
### AI-Powered Automated Underwater Marine Debris & Anomaly Detection System using Side-Scan Sonar Imagery

> **Smart India Hackathon 2026 • Problem Statement 26057**  
> *Ministry of Earth Sciences / Marine Environmental Protection / Ocean Acoustic Intelligence*

---

## 🎯 Executive Summary & The Core Innovation

Side-scan sonar imagery suffers from severe acoustic speckle noise, varying bottom reverberations, and dynamic gain shifts. Standard Computer Vision / YOLO models trained on limited acoustic imagery frequently hallucinate false positives on natural rock outcrops and sand ripples, wasting tens of thousands of dollars in vessel dispatch and diver deployment costs.

**SONAR-SHIELD** solves this fundamental bottleneck through a **Multi-Feature Physics Evidence Reasoning Layer**:

$$\text{"YOLO proposes a candidate detection } \longrightarrow \text{ SONAR-SHIELD questions why it should be trusted."}$$

Every bounding box is interrogated using three independent acoustic physics proofs:
1. **Geometric Shape Evidence:** Otsu thresholding and convex hull analysis measuring Circularity, Aspect Ratio, Solidity, and Extent against known structural templates.
2. **Acoustic Shadow Evidence:** Lateral sonar swath search evaluating relative acoustic occlusion, contrast drop, and dark void ratios ($<45$ pixel intensity) behind protruding objects.
3. **Seabed Context Evidence:** Annular context extraction evaluating local contrast saliency and background texture variance against uniform seabed sediment.

These features are fused into a transparent, configurable **Prototype Artificiality Score**, clustered into spatial **Debris Hotspots (DBSCAN)**, evaluated for **Ecological Bio-Threat**, and ranked into an operational **Cleanup Priority Task List** with tailored recovery equipment protocols.

---

## 🧠 Transparent Mathematical Models

### 1. Multi-Evidence Linear Fusion Model (Artificiality Score)
$$\text{Artificiality Score} = w_1 \cdot \text{AI Conf} + w_2 \cdot \text{Shape Score} + w_3 \cdot \text{Shadow Score} + w_4 \cdot \text{Context Score}$$

*Default Calibrated Weights:*
* $w_1 = 0.40$ (YOLO Confidence)
* $w_2 = 0.25$ (Geometric Shape Score)
* $w_3 = 0.20$ (Acoustic Shadow Occlusion)
* $w_4 = 0.15$ (Seabed Context Saliency)
$$\sum_{i=1}^4 w_i = 1.00$$

### 2. Automated Triage Classification
* **Validated Debris** ($\ge 0.80$): High-confidence artificial debris.
* **Needs Human Review** ($0.60 - 0.79$): Ambiguous target routed to operator cockpit.
* **Low Artificiality** ($< 0.60$): Probable acoustic artifact or natural formation.
* **Beneficial / Protected Habitat** (`Artificial Reef`): Excluded from removal operations.
* **Natural Seabed** (`Rock`, `Sand Ripple`): Dismissed with zero operational intervention.

### 3. Spatial Hotspot Clustering (Metric DBSCAN)
$$\text{Distance Metric: Cartesian } (x, y) \text{ projection with } \epsilon = 55\,\text{m}, \;\text{min\_samples} = 2$$
$$\text{Estimated Footprint Area} = \text{Shoelace Convex Hull Area } (\text{m}^2)$$

### 4. Prototype Bio-Threat Index
$$\text{Bio-Threat Score} = \min\left(1.0, \, T_{\text{mat}} \times \text{avg\_artificiality} \times D_{\text{mult}} \times A_{\text{scale}}\right)$$
* $T_{\text{mat}}$: Material Toxicity (`Tyre`: $0.85$ zinc/microplastics, `Shipwreck`: $0.75$ fuel/rust, `Artificial Reef`: $0.00$ Protected Nursery, `Rock`: $0.00$).
* $D_{\text{mult}} = \min(1.40, 1.0 + (\text{count} - 1) \times 0.10)$
* $A_{\text{scale}} = \min(1.25, 1.0 + (\text{area\_m}^2 / 500.0) \times 0.20)$

### 5. Actionable Cleanup Priority Ranking
$$\text{Cleanup Priority} = 0.35 \cdot \text{Bio-Threat} + 0.25 \cdot \text{Artificiality} + 0.20 \cdot \text{Density} + 0.20 \cdot \text{Accessibility}$$

* **Priority 1: Immediate Cleanup** ($\ge 0.75$): Critical debris concentration requiring urgent vessel dispatch.
* **Priority 2: Scheduled Remediation** ($0.45 - 0.74$): Planned recovery operation.
* **Priority 3: Monitor & Re-Survey** ($< 0.45$): Dispersed minor target.
* **Protected Sanctuary** (`Artificial Reef`): Preserved as fish nursery habitat.

---

## 🖥️ System Architecture & 5 Operational Cockpits

```
Raw Side-Scan Sonar Imagery (Upload / Demo)
          │
          ├──> Acoustic Preprocessing (CLAHE, Bilateral Denoising, SNR Telemetry)
          │
          ├──> YOLOv8 Neural Inference (Object Detection & Context Crop Extraction)
          │
          ├──> 3-Channel Physics Evidence Extraction
          │      ├── Shape Geometry (Circularity, Solidity, Aspect Ratio)
          │      ├── Acoustic Shadow (Lateral Void Ratio, Contrast Drop)
          │      └── Seabed Context (Annular Texture Variance, Saliency)
          │
          ├──> Multi-Evidence Fusion & Artificiality Scoring
          │
          ├──> False-Positive Filtering & Human-in-the-Loop Operator Review
          │
          ├──> Simulated Swath Geolocation (Arabian Sea Coastal Grid)
          │
          ├──> DBSCAN Hotspot Clustering (Debris Fields & Polygon Bounds)
          │
          ├──> Prototype Bio-Threat & Marine Habitat Protection Modeling
          │
          └──> Actionable Cleanup Prioritization & Multi-Format Exports (CSV/GeoJSON/HTML)
```

1. 📂 **Survey Ingestion Panel:** Multi-image upload, frame validation, and 1-click pre-loaded demo survey.
2. 📻 **Sonar Analysis Cockpit:** Side-by-side Raw vs CLAHE vs Bilateral views, interactive confidence slider, and acoustic histogram telemetry.
3. 👁️ **Evidence Intelligence Cockpit:** Candidate selector, grand hero gauge, 4-channel breakdown, 3 diagnostic overlays, dynamic weight sliders, and 1-click operator review audit strip.
4. 🧭 **Debris Hotspots Matrix:** 1-Click Autonomous Intelligence Pipeline, real-time telemetry counters, prioritized remediation cards, recovery equipment protocols, and cluster inspection drawer.
5. 📄 **Geospatial Map & Export Center:** Interactive tactical nautical radar map, 1-click CSV dataset export, QGIS/ArcGIS GeoJSON download, JSON executive dossier, and printable HTML briefing report.

---

## 🚀 Quickstart & Evaluation Guide

### Prerequisites
* **Python 3.10+**
* **Node.js 18+**

### Backend Setup
```bash
# 1. Navigate to project root
cd SONAR-SHIELD

# 2. Install Python dependencies
pip install -r backend/requirements.txt

# 3. Start FastAPI Server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API Docs:* `http://127.0.0.1:8000/docs`

### Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start Vite Dev Server
npm run dev
```
*Frontend Application:* `http://localhost:5173`

---

## 🧪 Master Test Suite Execution

To verify all 16 pipeline stages with the automated master test harness:
```bash
python tests/test_master_e2e.py
```

---

## ⚖️ Scientific Honesty & Prototype Disclaimers

1. **Simulated Geolocation:** The dataset contains synthetic and augmented sonar frames lacking hardware GPS tags. All geographic coordinates are generated on a deterministic, geographically consistent **Arabian Sea Coastal Survey Grid ($18.9220^\circ\text{N}, 72.8340^\circ\text{E}$)** for reproducible evaluation.
2. **Artificiality Score:** Represents a transparent multi-criteria heuristic proxy model designed to assist human hydrographers, not an infallible ground-truth probability.
3. **Bio-Threat Index:** Serves as a material hazard approximation based on marine debris taxonomy, not an in-situ biochemical laboratory assay.
4. **Artificial Reef Protection:** Man-made reef structures are explicitly recognized as **Protected Ecological Fish Sanctuaries** and are exempted from debris removal operations.

---

## 🏆 SIH 2026 Submission Credentials
* **Problem Statement:** 26057
* **Project Name:** SONAR-SHIELD
* **Domain:** AI-Powered Marine Debris & Sonar Evidence Intelligence
* **Version:** 1.0.0 (Production-Ready Decision Support System)
