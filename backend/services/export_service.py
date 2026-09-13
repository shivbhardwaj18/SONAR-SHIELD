"""
Multi-Format Export Engine for SONAR-SHIELD.
Generates CSV tabular datasets, comprehensive JSON dossiers, standard GeoJSON,
and printable executive HTML briefing reports.
"""

import io
import csv
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from backend.database.db import get_db
from backend.spatial.geolocator import generate_survey_geojson
from backend.intelligence.cleanup import evaluate_survey_cleanup_priorities


def generate_survey_csv(survey_id: str) -> str:
    """
    Generates an RFC 4180 compliant CSV string containing all detection telemetry and scores.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT d.*, i.filename, i.frame_id 
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE d.survey_id = ?
        ORDER BY d.created_at ASC
        """, (survey_id,))
        rows = cursor.fetchall()

    output = io.StringIO()
    fieldnames = [
        "detection_id",
        "survey_id",
        "frame_id",
        "filename",
        "class_name",
        "confidence",
        "shape_score",
        "shadow_score",
        "context_score",
        "artificiality_score",
        "status",
        "review_status",
        "operator_notes",
        "simulated_lat",
        "simulated_lon",
        "depth_m",
        "coordinate_type"
    ]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for r in rows:
        writer.writerow({
            "detection_id": r["id"],
            "survey_id": r["survey_id"],
            "frame_id": r["frame_id"],
            "filename": r["filename"],
            "class_name": r["class_name"],
            "confidence": round(float(r["confidence"]), 4),
            "shape_score": round(float(r["shape_score"]), 4) if r["shape_score"] is not None else "",
            "shadow_score": round(float(r["shadow_score"]), 4) if r["shadow_score"] is not None else "",
            "context_score": round(float(r["context_score"]), 4) if r["context_score"] is not None else "",
            "artificiality_score": round(float(r["artificiality_score"]), 4) if r["artificiality_score"] is not None else "",
            "status": r["status"] or "CANDIDATE",
            "review_status": r["review_status"] or "PENDING",
            "operator_notes": (r["operator_notes"] or "").replace("\n", " "),
            "simulated_lat": round(float(r["simulated_lat"]), 7) if r["simulated_lat"] is not None else "",
            "simulated_lon": round(float(r["simulated_lon"]), 7) if r["simulated_lon"] is not None else "",
            "depth_m": round(float(r["depth_m"]), 2) if "depth_m" in r.keys() and r["depth_m"] is not None else 24.0,
            "coordinate_type": "SIMULATED SURVEY METADATA"
        })

    return output.getvalue()


def generate_survey_json_dossier(survey_id: str) -> Dict[str, Any]:
    """
    Generates a full structured JSON dossier containing survey metadata, detections,
    hotspots, bio-threat metrics, cleanup priorities, and disclaimers.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM surveys WHERE id = ?", (survey_id,))
        survey = cursor.fetchone()
        if not survey:
            raise ValueError(f"Survey {survey_id} not found")

        cursor.execute("""
        SELECT d.*, i.filename, i.frame_id 
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE d.survey_id = ?
        """, (survey_id,))
        detections = cursor.fetchall()

    geojson = generate_survey_geojson(survey_id)
    cleanup = evaluate_survey_cleanup_priorities(survey_id)

    return {
        "system": "SONAR-SHIELD Automated Sonar Intelligence System",
        "sih_problem_statement": "26057 - AI-Powered Automated Underwater Marine Debris Detection",
        "generated_at": datetime.utcnow().isoformat(),
        "survey_metadata": {
            "id": survey["id"],
            "name": survey["name"],
            "description": survey["description"],
            "total_images": survey["total_images"],
            "is_demo": bool(survey["is_demo"]),
            "created_at": survey["created_at"]
        },
        "summary_metrics": {
            "total_detections": len(detections),
            "total_debris_hotspots": cleanup["total_ranked"],
            "priority_1_immediate_targets": cleanup["priority_1_count"],
            "priority_2_scheduled_targets": cleanup["priority_2_count"],
            "protected_sanctuary_habitats": cleanup["protected_habitats_count"]
        },
        "remediation_rankings": cleanup["rankings"],
        "detections_geojson": geojson,
        "scientific_honesty_disclaimer": (
            "All geographic coordinates are simulated survey metadata (Arabian Sea Grid). "
            "Artificiality Scores and Bio-Threat Indices are transparent prototype proxy models."
        )
    }


def generate_executive_report_html(survey_id: str) -> str:
    """
    Generates a printable HTML executive briefing document.
    """
    dossier = generate_survey_json_dossier(survey_id)
    s = dossier["survey_metadata"]
    m = dossier["summary_metrics"]
    rankings = dossier["remediation_rankings"]

    hotspots_rows = ""
    for idx, r in enumerate(rankings, 1):
        tier_color = "#ef4444" if "PRIORITY 1" in r["tier_display"] else "#f59e0b" if "PRIORITY 2" in r["tier_display"] else "#06b6d4" if "PROTECTED" in r["tier_display"] else "#10b981"
        hotspots_rows += f"""
        <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 10px; font-weight: bold;">#{idx} {r['hotspot_id']}</td>
            <td style="padding: 10px; color: {tier_color}; font-weight: bold;">{r['tier_display']}</td>
            <td style="padding: 10px; text-transform: uppercase;">{r['dominant_class']} ({r['detection_count']} items)</td>
            <td style="padding: 10px;">{r['center_lat']:.5f}&deg;N, {r['center_lon']:.5f}&deg;E</td>
            <td style="padding: 10px;">~{r['estimated_area_m2']} m&sup2;</td>
            <td style="padding: 10px; font-size: 11px;">{r['recommended_equipment']}</td>
        </tr>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SAGAR NETRA Executive Briefing: {s['name']}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #070c18; color: #f1f5f9; padding: 40px; margin: 0; line-height: 1.5; }}
        .header {{ border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }}
        .title {{ font-size: 24px; font-weight: 800; color: #0284c7; letter-spacing: 1px; }}
        .subtitle {{ font-size: 13px; color: #94a3b8; margin-top: 4px; }}
        .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }}
        .card {{ background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 15px; }}
        .card-label {{ font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; }}
        .card-val {{ font-size: 24px; font-weight: bold; margin-top: 5px; color: #f8fafc; }}
        table {{ width: 100%; border-collapse: collapse; background: #0f172a; border-radius: 8px; overflow: hidden; border: 1px solid #1e293b; margin-top: 15px; font-size: 13px; }}
        th {{ background: #1e293b; text-align: left; padding: 12px 10px; font-size: 11px; text-transform: uppercase; color: #94a3b8; }}
        .disclaimer {{ margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 15px; font-size: 11px; color: #64748b; font-style: italic; }}
        @media print {{
            body {{ background: #ffffff; color: #000000; padding: 20px; }}
            .card, table {{ background: #ffffff; border-color: #cbd5e1; color: #000000; }}
            th {{ background: #f1f5f9; color: #334155; }}
            .title {{ color: #0284c7; }}
            .header {{ border-bottom-color: #0284c7; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="title">SAGAR NETRA &bull; EXECUTIVE REMEDIATION BRIEFING</div>
            <div class="subtitle">Smart India Hackathon 2026 &bull; Problem Statement #26057 &bull; Automated Sonar Intelligence</div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #94a3b8;">
            <div>Survey: <strong>{s['name']}</strong></div>
            <div>Generated: {dossier['generated_at'][:19].replace('T', ' ')} UTC</div>
        </div>
    </div>

    <div class="grid">
        <div class="card">
            <div class="card-label">Total Detections</div>
            <div class="card-val">{m['total_detections']}</div>
        </div>
        <div class="card" style="border-left: 4px solid #ef4444;">
            <div class="card-label">Priority 1 Cleanup Targets</div>
            <div class="card-val" style="color: #ef4444;">{m['priority_1_immediate_targets']}</div>
        </div>
        <div class="card" style="border-left: 4px solid #f59e0b;">
            <div class="card-label">Debris Fields (Hotspots)</div>
            <div class="card-val" style="color: #f59e0b;">{m['total_debris_hotspots']}</div>
        </div>
        <div class="card" style="border-left: 4px solid #06b6d4;">
            <div class="card-label">Protected Habitats</div>
            <div class="card-val" style="color: #06b6d4;">{m['protected_sanctuary_habitats']}</div>
        </div>
    </div>

    <h3 style="font-size: 16px; margin-bottom: 5px; color: #e2e8f0;">Ranked Subsea Remediation & Protection Task List</h3>
    <table>
        <thead>
            <tr>
                <th>Hotspot ID</th>
                <th>Operational Tier</th>
                <th>Dominant Class</th>
                <th>Centroid Coordinates</th>
                <th>Footprint Area</th>
                <th>Recommended Recovery Protocol</th>
            </tr>
        </thead>
        <tbody>
            {hotspots_rows}
        </tbody>
    </table>

    <div class="disclaimer">
        <strong>Scientific Honesty & Prototype Disclosure:</strong> {dossier['scientific_honesty_disclaimer']}
    </div>
</body>
</html>
"""
    return html
