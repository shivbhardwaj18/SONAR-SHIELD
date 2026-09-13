"""
API Routes for Data Export, CSV Downloads, JSON Dossiers, and Printable Reports.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response, HTMLResponse

from backend.services.export_service import (
    generate_survey_csv,
    generate_survey_json_dossier,
    generate_executive_report_html
)
from backend.spatial.geolocator import generate_survey_geojson

router = APIRouter(prefix="/api/surveys", tags=["Data Export & Reports"])


@router.get("/{survey_id}/export/csv")
def export_survey_csv_endpoint(survey_id: str):
    """
    Downloads complete survey detections dataset in RFC 4180 CSV format.
    """
    try:
        csv_data = generate_survey_csv(survey_id)
        filename = f"sonar_shield_detections_{survey_id}.csv"
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CSV export failed: {str(e)}"
        )


@router.get("/{survey_id}/export/json")
def export_survey_json_endpoint(survey_id: str):
    """
    Downloads comprehensive survey dossier in structured JSON format.
    """
    try:
        dossier = generate_survey_json_dossier(survey_id)
        filename = f"sonar_shield_dossier_{survey_id}.json"
        import json
        return Response(
            content=json.dumps(dossier, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"JSON export failed: {str(e)}"
        )


@router.get("/{survey_id}/export/geojson")
def export_survey_geojson_endpoint(survey_id: str):
    """
    Downloads standard RFC 7946 GeoJSON FeatureCollection for GIS software (ArcGIS / QGIS).
    """
    try:
        geojson_data = generate_survey_geojson(survey_id)
        filename = f"sonar_shield_spatial_{survey_id}.geojson"
        import json
        return Response(
            content=json.dumps(geojson_data, indent=2),
            media_type="application/geo+json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GeoJSON export failed: {str(e)}"
        )


@router.get("/{survey_id}/export/report-html", response_class=HTMLResponse)
@router.get("/{survey_id}/export/printable", response_class=HTMLResponse)
def export_survey_report_html_endpoint(survey_id: str):
    """
    Renders styled printable executive HTML briefing document.
    """
    try:
        html = generate_executive_report_html(survey_id)
        return HTMLResponse(content=html)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HTML report generation failed: {str(e)}"
        )
