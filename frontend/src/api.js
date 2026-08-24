/**
 * API Client for SONAR-SHIELD Backend.
 */

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function loadDemoSurvey() {
  const res = await fetch(`${API_BASE}/surveys/load-demo`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to load demo survey' }));
    throw new Error(err.detail || 'Failed to load demo survey');
  }
  return res.json();
}

export async function uploadSurveyImages(files, surveyName, surveyDesc) {
  const formData = new FormData();
  if (surveyName) formData.append('survey_name', surveyName);
  if (surveyDesc) formData.append('survey_description', surveyDesc);
  
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  const res = await fetch(`${API_BASE}/surveys/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function fetchSurveys() {
  const res = await fetch(`${API_BASE}/surveys`);
  if (!res.ok) throw new Error('Failed to fetch surveys');
  return res.json();
}

export async function fetchSurveyDetails(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}`);
  if (!res.ok) throw new Error(`Failed to fetch survey ${surveyId}`);
  return res.json();
}

export function getImageFileUrl(imageId) {
  return `${API_BASE}/images/${imageId}/file`;
}

// ---------------- Detection APIs ----------------

export async function runSurveyDetection(surveyId, confThreshold = 0.20) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/run-detection?conf_threshold=${confThreshold}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Detection run failed' }));
    throw new Error(err.detail || 'Detection run failed');
  }
  return res.json();
}

export async function runImageDetection(imageId, confThreshold = 0.20) {
  const res = await fetch(`${API_BASE}/images/${imageId}/run-detection?conf_threshold=${confThreshold}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Image detection failed' }));
    throw new Error(err.detail || 'Image detection failed');
  }
  return res.json();
}

export async function fetchImageDetections(imageId) {
  const res = await fetch(`${API_BASE}/images/${imageId}/detections`);
  if (!res.ok) throw new Error(`Failed to fetch detections for image ${imageId}`);
  return res.json();
}

export async function fetchSurveyDetections(surveyId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.className) params.append('class_name', filters.className);
  if (filters.minConf) params.append('min_confidence', filters.minConf);
  if (filters.status) params.append('status_filter', filters.status);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/detections${query}`);
  if (!res.ok) throw new Error(`Failed to fetch detections for survey ${surveyId}`);
  return res.json();
}

export function getDetectionCropUrl(detectionId) {
  return `${API_BASE}/detections/${detectionId}/crop`;
}

// ---------------- Preprocessing APIs ----------------

export function getPreprocessedImageUrl(imageId, mode = 'raw') {
  return `${API_BASE}/images/${imageId}/preprocessed?mode=${mode}`;
}

export async function fetchImageAcousticStats(imageId) {
  const res = await fetch(`${API_BASE}/images/${imageId}/acoustic-stats`);
  if (!res.ok) throw new Error(`Failed to fetch acoustic stats for image ${imageId}`);
  return res.json();
}

// ---------------- Evidence Intelligence APIs ----------------

export async function fetchEvidenceWeights() {
  const res = await fetch(`${API_BASE}/evidence/weights`);
  if (!res.ok) throw new Error('Failed to fetch evidence weights');
  return res.json();
}

export async function fuseSurveyEvidence(surveyId, weights = null) {
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };
  if (weights) {
    options.body = JSON.stringify(weights);
  }
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/fuse-evidence`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Evidence fusion failed' }));
    throw new Error(err.detail || 'Evidence fusion failed');
  }
  return res.json();
}

export async function fetchDetectionDossier(detectionId) {
  const res = await fetch(`${API_BASE}/detections/${detectionId}/evidence-dossier`);
  if (!res.ok) throw new Error(`Failed to fetch evidence dossier for detection ${detectionId}`);
  return res.json();
}

export function getShapeOverlayUrl(detectionId) {
  return `${API_BASE}/detections/${detectionId}/shape-overlay`;
}

export function getShadowOverlayUrl(detectionId) {
  return `${API_BASE}/detections/${detectionId}/shadow-overlay`;
}

export function getContextOverlayUrl(detectionId) {
  return `${API_BASE}/detections/${detectionId}/context-overlay`;
}

// ---------------- Filtering & Human Review APIs ----------------

export async function applySurveyTriage(surveyId, highThresh = 0.80, reviewThresh = 0.60) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/triage?high_threshold=${highThresh}&review_threshold=${reviewThresh}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to apply survey triage');
  return res.json();
}

export async function submitOperatorReview(detectionId, action, notes = null, newClass = null) {
  const res = await fetch(`${API_BASE}/detections/${detectionId}/operator-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, notes, new_class: newClass })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to record operator review' }));
    throw new Error(err.detail || 'Failed to record operator review');
  }
  return res.json();
}

export async function fetchReviewSummary(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/review-summary`);
  if (!res.ok) throw new Error('Failed to fetch review summary');
  return res.json();
}

// ---------------- Spatial & Geolocation APIs ----------------

export async function computeSurveySpatial(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/compute-spatial`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to compute spatial metadata');
  return res.json();
}

export async function fetchSurveyGeoJSON(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/spatial-geojson`);
  if (!res.ok) throw new Error('Failed to fetch survey GeoJSON');
  return res.json();
}

export async function computeSurveyHotspots(surveyId, epsMeters = 55.0, minSamples = 2) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/compute-hotspots?eps_meters=${epsMeters}&min_samples=${minSamples}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Hotspot clustering failed' }));
    throw new Error(err.detail || 'Hotspot clustering failed');
  }
  return res.json();
}

export async function fetchSurveyHotspots(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/hotspots`);
  if (!res.ok) throw new Error('Failed to fetch hotspots');
  return res.json();
}

// ---------------- Bio-Threat & Ecological Intelligence APIs ----------------

export async function evaluateSurveyBioThreat(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/evaluate-bio-threat`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to evaluate bio-threat metrics');
  return res.json();
}

export async function fetchBioThreatSummary(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/bio-threat-summary`);
  if (!res.ok) throw new Error('Failed to fetch bio-threat summary');
  return res.json();
}

export async function fetchDetectionBioThreat(detectionId) {
  const res = await fetch(`${API_BASE}/detections/${detectionId}/bio-threat`);
  if (!res.ok) throw new Error('Failed to fetch detection bio-threat');
  return res.json();
}

// ---------------- Cleanup Prioritization APIs ----------------

export async function computeSurveyCleanupPriority(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/compute-cleanup-priority`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to compute cleanup priorities');
  return res.json();
}

export async function fetchSurveyCleanupRankings(surveyId) {
  const res = await fetch(`${API_BASE}/surveys/${surveyId}/cleanup-rankings`);
  if (!res.ok) throw new Error('Failed to fetch cleanup rankings');
  return res.json();
}

export async function fetchHotspotRemediationPlan(hotspotId) {
  const res = await fetch(`${API_BASE}/hotspots/${hotspotId}/remediation-plan`);
  if (!res.ok) throw new Error('Failed to fetch remediation plan');
  return res.json();
}
