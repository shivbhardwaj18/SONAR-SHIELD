import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Compass, 
  Layers, 
  Maximize2, 
  Eye, 
  MapPin, 
  Anchor, 
  ShieldAlert, 
  Navigation, 
  CheckCircle2, 
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Crosshair
} from 'lucide-react';
import { getDetectionCropUrl } from '../api';

const TILE_PROVIDERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  ocean: {
    name: 'ESRI Ocean / Bathymetry',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB'
  },
  positron: {
    name: 'CartoDB Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  },
  dark: {
    name: 'Tactical Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
  }
};

const getSvgIconMarkup = (cls, color) => {
  const c = cls?.toLowerCase() || '';
  if (c.includes('shipwreck')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"></circle><line x1="12" y1="22" x2="12" y2="8"></line><path d="M5 12H2a10 10 0 0 0 20 0h-3"></path></svg>`;
  }
  if (c.includes('ghost') || c.includes('net')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>`;
  }
  if (c.includes('tyre') || c.includes('tire')) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle></svg>`;
  }
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
};

const CLASS_THEMES = {
  'shipwreck': {
    color: '#ea580c',
    bg: '#ffffff',
    border: '#ea580c',
    label: 'Shipwreck'
  },
  'ghost net': {
    color: '#0284c7',
    bg: '#ffffff',
    border: '#0284c7',
    label: 'Ghost Net'
  },
  'ghost_net': {
    color: '#0284c7',
    bg: '#ffffff',
    border: '#0284c7',
    label: 'Ghost Net'
  },
  'tyre': {
    color: '#d97706',
    bg: '#ffffff',
    border: '#d97706',
    label: 'Subsea Tyre'
  },
  'default': {
    color: '#0284c7',
    bg: '#ffffff',
    border: '#0284c7',
    label: 'Marine Debris'
  }
};

export default function NauticalOSMMap({
  detections = [],
  hotspots = [],
  survey = null,
  selectedTarget = null,
  onSelectTarget = null,
  height = '520px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersGroupRef = useRef(null);
  const hotspotsGroupRef = useRef(null);
  const tracklineGroupRef = useRef(null);

  const [activeTile, setActiveTile] = useState('osm');
  const [showTrackline, setShowTrackline] = useState(true);
  const [showHotspotZones, setShowHotspotZones] = useState(true);
  const [mouseCoords, setMouseCoords] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default Anchor: Mumbai Harbor South Deepwater Channel (Open Sea)
    const defaultCenter = [18.9150, 72.8700];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
      attributionControl: true
    });

    // Add initial tile layer
    const provider = TILE_PROVIDERS[activeTile];
    tileLayerRef.current = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19
    }).addTo(map);

    // Feature Layer Groups
    hotspotsGroupRef.current = L.layerGroup().addTo(map);
    tracklineGroupRef.current = L.layerGroup().addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);

    // Mouse movement HUD
    map.on('mousemove', (e) => {
      setMouseCoords({
        lat: e.latlng.lat.toFixed(5),
        lng: e.latlng.lng.toFixed(5)
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const map = mapInstanceRef.current;
    map.removeLayer(tileLayerRef.current);

    const provider = TILE_PROVIDERS[activeTile];
    tileLayerRef.current = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxZoom: 19
    }).addTo(map);
  }, [activeTile]);

  // Render Map Features (Hotspots, Trackline, Markers)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear previous layers
    markersGroupRef.current.clearLayers();
    hotspotsGroupRef.current.clearLayers();
    tracklineGroupRef.current.clearLayers();

    const validCoords = [];

    // 1. Render Hotspot Enclosure Circles & Polygons
    if (showHotspotZones && hotspots && hotspots.length > 0) {
      hotspots.forEach((hs, idx) => {
        const lat = hs.centroid_lat ?? hs.center_lat;
        const lon = hs.centroid_lon ?? hs.center_lon;
        if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) return;

        validCoords.push([lat, lon]);

        const count = hs.detection_count || 1;
        const isCluster = count >= 2;
        const radius = isCluster ? Math.max(40, Math.min(90, count * 24)) : 22;

        const isP1 = hs.cleanup_priority_level === 'PRIORITY 1';
        const circleColor = isP1 ? '#ef4444' : isCluster ? '#f59e0b' : '#0284c7';
        const circleFill = isP1 ? 'rgba(239, 68, 68, 0.22)' : isCluster ? 'rgba(245, 158, 11, 0.20)' : 'rgba(2, 132, 199, 0.15)';

        // Hotspot Circle
        const circle = L.circle([lat, lon], {
          radius: radius,
          color: circleColor,
          weight: 2,
          dashArray: isCluster ? '6, 6' : '3, 3',
          fillColor: circleFill,
          fillOpacity: 0.6
        });

        // Pulsing Cluster Badge
        const clusterTitle = isCluster ? ('HOTSPOT #' + (idx + 1) + ' (' + count + ' TARGETS)') : ('TARGET #' + (idx + 1));
        const fireIconSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${circleColor}" stroke-width="2.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`;

        const badgeHtml = `
          <div style="
            transform: translate(-50%, -50%);
            display: flex;
            align-items: center;
            gap: 5px;
            background: #0f172a;
            color: #ffffff;
            border: 1.5px solid ${circleColor};
            border-radius: 9999px;
            padding: 3px 10px;
            font-family: monospace;
            font-size: 10px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            white-space: nowrap;
            cursor: pointer;
          ">
            ${fireIconSvg}
            <span>${clusterTitle}</span>
          </div>
        `;

        const badgeIcon = L.divIcon({
          html: badgeHtml,
          className: 'custom-cluster-badge',
          iconSize: [0, 0]
        });

        const badgeMarker = L.marker([lat, lon], { icon: badgeIcon });
        const popupHeader = isCluster ? ('DEBRIS HOTSPOT #' + (idx + 1)) : 'SINGLE TARGET ZONE';

        badgeMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #0f172a; min-width: 220px;">
            <div style="font-weight: bold; font-size: 13px; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
              ${popupHeader}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; margin-bottom: 6px;">
              <div><strong>Targets:</strong> ${count} Objects</div>
              <div><strong>Dominant:</strong> <span style="text-transform: uppercase; color: #ea580c;">${hs.dominant_class || 'Debris'}</span></div>
              <div><strong>Footprint:</strong> ~${hs.estimated_area_m2 || 50} m²</div>
              <div><strong>Priority:</strong> <span style="color: ${isP1 ? '#dc2626' : '#d97706'}; font-weight: bold;">${hs.cleanup_priority_level || 'PRIORITY 2'}</span></div>
            </div>
            <div style="font-size: 10px; color: #64748b; font-family: monospace;">
              Centroid: ${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E
            </div>
          </div>
        `);

        hotspotsGroupRef.current.addLayer(circle);
        hotspotsGroupRef.current.addLayer(badgeMarker);
      });
    }

    // 2. Render Vessel Survey Trackline
    const trackPoints = [];
    detections.forEach((d) => {
      const lat = d.simulated_lat ?? d.lat;
      const lon = d.simulated_lon ?? d.lon;
      if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
        trackPoints.push([lat, lon]);
        validCoords.push([lat, lon]);
      }
    });

    if (showTrackline && trackPoints.length >= 2) {
      const polyline = L.polyline(trackPoints, {
        color: '#0284c7',
        weight: 3,
        dashArray: '8, 8',
        opacity: 0.85
      });

      // Start & End Waypoints
      const startHtml = `<div style="transform: translate(-50%, -50%); background: #10b981; color: white; border-radius: 9999px; padding: 2px 6px; font-size: 9px; font-weight: bold; border: 1.5px solid white;">START</div>`;
      const endHtml = `<div style="transform: translate(-50%, -50%); background: #ef4444; color: white; border-radius: 9999px; padding: 2px 6px; font-size: 9px; font-weight: bold; border: 1.5px solid white;">END</div>`;

      const startMarker = L.marker(trackPoints[0], {
        icon: L.divIcon({ html: startHtml, className: 'track-wp', iconSize: [0, 0] })
      });
      const endMarker = L.marker(trackPoints[trackPoints.length - 1], {
        icon: L.divIcon({ html: endHtml, className: 'track-wp', iconSize: [0, 0] })
      });

      tracklineGroupRef.current.addLayer(polyline);
      tracklineGroupRef.current.addLayer(startMarker);
      tracklineGroupRef.current.addLayer(endMarker);
    }

    // 3. Render Individual Debris Marker Pins
    detections.forEach((det, dIdx) => {
      const lat = det.simulated_lat ?? det.lat;
      const lon = det.simulated_lon ?? det.lon;
      if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) return;

      const clsKey = det.class_name?.toLowerCase() || '';
      const theme = CLASS_THEMES[clsKey] || CLASS_THEMES['default'];
      const confPct = Math.round((det.confidence || 0.8) * 100);
      const isSelected = selectedTarget && (selectedTarget.id === det.id);
      const iconSvg = getSvgIconMarkup(det.class_name, theme.color);

      const markerHtml = `
        <div style="
          position: relative;
          transform: translate(-50%, -50%);
          cursor: pointer;
        ">
          <!-- Glowing Pulse Ring -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${isSelected ? '38px' : '32px'};
            height: ${isSelected ? '38px' : '32px'};
            border-radius: 9999px;
            background: ${theme.color};
            opacity: 0.35;
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>

          <!-- Main Pin Badge -->
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isSelected ? '30px' : '26px'};
            height: ${isSelected ? '30px' : '26px'};
            border-radius: 9999px;
            background: ${isSelected ? '#0f172a' : '#ffffff'};
            border: 2.5px solid ${isSelected ? '#38bdf8' : theme.color};
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            transition: all 0.2s ease;
          ">
            ${iconSvg}
          </div>

          <!-- Class & Conf Label Tag -->
          <div style="
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-top: 3px;
            background: rgba(15, 23, 42, 0.92);
            color: #ffffff;
            border: 1px solid ${theme.color};
            border-radius: 4px;
            padding: 1.5px 5px;
            font-family: monospace;
            font-size: 8.5px;
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          ">
            ${det.class_name?.toUpperCase()} ${confPct}%
          </div>
        </div>
      `;

      const markerIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-debris-pin',
        iconSize: [0, 0]
      });

      const marker = L.marker([lat, lon], { icon: markerIcon });

      const cropUrl = getDetectionCropUrl(det.id);
      const frameName = det.frame_id || ('FRAME_' + (dIdx + 1));

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; color: #0f172a; width: 230px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
            <strong style="color: ${theme.color}; font-size: 13px; text-transform: uppercase;">${det.class_name}</strong>
            <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: bold;">
              AI: ${confPct}%
            </span>
          </div>

          <!-- Sonar Crop Image -->
          <div style="width: 100%; height: 90px; background: #000; border-radius: 6px; overflow: hidden; margin-bottom: 6px; border: 1px solid #cbd5e1;">
            <img src="${cropUrl}" alt="${det.class_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; margin-bottom: 6px;">
            <div><strong>Status:</strong> <span style="color: #0369a1;">${det.status || 'VALIDATED'}</span></div>
            <div><strong>Depth:</strong> ~${det.estimated_depth_m || 22.5} m</div>
            <div><strong>Swath:</strong> ${det.swath_side || 'STARBOARD'}</div>
            <div><strong>Frame:</strong> ${frameName}</div>
          </div>

          <div style="background: #f8fafc; padding: 4px 6px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 9px; font-family: monospace; color: #475569;">
            GPS: ${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E
          </div>
        </div>
      `);

      marker.on('click', () => {
        if (onSelectTarget) onSelectTarget(det);
      });

      markersGroupRef.current.addLayer(marker);
    });

    // Auto-Fit Bounds to cover all coordinates
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [detections, hotspots, showTrackline, showHotspotZones, selectedTarget]);

  // Fit Bounds Action Handler
  const handleFitBounds = () => {
    if (!mapInstanceRef.current) return;
    const allCoords = [];
    detections.forEach((d) => {
      const lat = d.simulated_lat ?? d.lat;
      const lon = d.simulated_lon ?? d.lon;
      if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
        allCoords.push([lat, lon]);
      }
    });
    hotspots.forEach((h) => {
      const lat = h.centroid_lat ?? h.center_lat;
      const lon = h.centroid_lon ?? h.center_lon;
      if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
        allCoords.push([lat, lon]);
      }
    });

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-soft bg-slate-900">
      {/* Top Map Header & Controls Strip */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Location Badge */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-md flex items-center gap-2 text-xs">
          <Compass className="text-sky-600 animate-spin-slow" size={15} />
          <div>
            <span className="font-bold text-slate-800 block leading-tight font-tech">
              {survey?.name || 'MUMBAI-OFFSHORE-CORRIDOR-2026 (Arabian Sea)'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono block">
              OpenStreetMap Real-World Marine GIS (WGS 84 / EPSG:4326)
            </span>
          </div>
        </div>

        {/* Tile & Layer Switchers */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 shadow-md text-xs font-semibold">
          {Object.entries(TILE_PROVIDERS).map(([key, provider]) => (
            <button
              key={key}
              onClick={() => setActiveTile(key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                activeTile === key
                  ? 'bg-sky-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {provider.name}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Toggle Controls on Left */}
      <div className="absolute bottom-12 left-3 z-[1000] flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/80 shadow-md text-xs font-mono">
        <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-700 text-[11px]">
          <input
            type="checkbox"
            checked={showHotspotZones}
            onChange={(e) => setShowHotspotZones(e.target.checked)}
            className="rounded text-sky-600 focus:ring-sky-500"
          />
          <span>Hotspot Zones ({hotspots.length})</span>
        </label>
        <label className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-700 text-[11px]">
          <input
            type="checkbox"
            checked={showTrackline}
            onChange={(e) => setShowTrackline(e.target.checked)}
            className="rounded text-sky-600 focus:ring-sky-500"
          />
          <span>Survey Trackline</span>
        </label>
      </div>

      {/* Map Action Buttons (Zoom & Fit Bounds) */}
      <div className="absolute bottom-12 right-3 z-[1000] flex flex-col gap-1.5 pointer-events-auto">
        <button
          onClick={handleFitBounds}
          title="Fit All Targets in View"
          className="p-2.5 bg-white/95 backdrop-blur-md hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-xl border border-slate-200/80 shadow-md cursor-pointer transition-all"
        >
          <Crosshair size={16} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Zoom In"
          className="p-2.5 bg-white/95 backdrop-blur-md hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-xl border border-slate-200/80 shadow-md cursor-pointer transition-all"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Zoom Out"
          className="p-2.5 bg-white/95 backdrop-blur-md hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-xl border border-slate-200/80 shadow-md cursor-pointer transition-all"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      {/* The Leaflet Map DOM Container */}
      <div
        ref={mapContainerRef}
        style={{ height: height, width: '100%' }}
        className="z-0"
      />

      {/* Bottom Live Coordinate Telemetry Strip */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-slate-900/90 backdrop-blur-md px-4 py-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-300">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400 font-semibold">DATUM:</span>
            <span className="text-emerald-400 font-bold">WGS 84 (GPS)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">HOTSPOTS:</span>
            <span className="text-sky-400 font-bold">{hotspots.length} Fields</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">PLOTTED TARGETS:</span>
            <span className="text-amber-400 font-bold">{detections.length} Pins</span>
          </div>
        </div>

        <div>
          {mouseCoords ? (
            <span className="text-sky-300 font-bold">
              CURSOR: {mouseCoords.lat}° N, {mouseCoords.lng}° E
            </span>
          ) : (
            <span className="text-slate-500 italic">Hover over map to read coordinates</span>
          )}
        </div>
      </div>
    </div>
  );
}
