'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapCompanyMarker, RiskLevel } from '@/lib/types';
import { eurCompact, signedEur } from '@/lib/format';

type Leaflet = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LayerGroup = import('leaflet').LayerGroup;

const RISK_COLOR: Record<RiskLevel, string> = {
  low: '#15803d',
  medium: '#b45309',
  high: '#b91c1c',
};

const DUPLICATE_OFFSETS = [
  { lat: 0, lon: 0 },
  { lat: 0.035, lon: 0.045 },
  { lat: -0.035, lon: -0.045 },
  { lat: 0.03, lon: -0.05 },
  { lat: -0.03, lon: 0.05 },
];

export function RealWeatherMap({
  markers,
  selectedCode,
  onSelect,
  weekIndex = 0,
}: {
  markers: MapCompanyMarker[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
  weekIndex?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [52.2, 5.45],
        zoom: 7,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        leafletRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    markers.forEach((marker) => {
      const duplicate = duplicateIndex(marker, markers);
      const offset = DUPLICATE_OFFSETS[duplicate % DUPLICATE_OFFSETS.length];
      const lat = marker.latitude + offset.lat;
      const lon = marker.longitude + offset.lon;
      bounds.extend([lat, lon]);

      const wk = marker.weeks?.[Math.min(weekIndex, (marker.weeks?.length ?? 1) - 1)];
      const weekRisk: RiskLevel = wk?.risk ?? marker.weatherRisk;
      const rainValue = wk?.rainValue ?? marker.currentWeekRainWorkdays;
      const selected = marker.code === selectedCode;
      const color = RISK_COLOR[weekRisk];

      // Rain "halo": radius + opacity scale with the selected week's rain metric,
      // so scrubbing the time-slider shows where and when rain is expected.
      if (rainValue > 0) {
        L.circle([lat, lon], {
          radius: 3000 + rainValue * 3500,
          color: '#2563eb',
          weight: 1,
          fillColor: '#3b82f6',
          fillOpacity: Math.min(0.35, 0.08 + rainValue * 0.06),
        }).addTo(layer);
      }

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:${selected ? 36 : 30}px;
            height:${selected ? 36 : 30}px;
            border-radius:999px;
            background:${color};
            color:white;
            border:3px solid white;
            box-shadow:0 6px 18px rgba(15,23,42,.25);
            display:flex;
            align-items:center;
            justify-content:center;
            font:700 12px system-ui,-apple-system,Segoe UI,sans-serif;
          ">${escapeHtml(marker.shortName.slice(0, 1))}</div>
        `,
        iconSize: [selected ? 36 : 30, selected ? 36 : 30],
        iconAnchor: [selected ? 18 : 15, selected ? 18 : 15],
      });

      L.marker([lat, lon], { icon })
        .addTo(layer)
        .bindPopup(popupHtml(marker, weekRisk, rainValue, wk?.weekStart))
        .on('click', () => onSelectRef.current(marker.code));
    });

    if (markers.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.24), { animate: false, maxZoom: 8 });
    }
  }, [markers, ready, selectedCode, weekIndex]);

  return (
    <div
      ref={containerRef}
      className="h-[560px] min-h-[420px] w-full rounded-b-lg bg-panel-sunken"
      aria-label="Interactive weather risk map"
    />
  );
}

function popupHtml(marker: MapCompanyMarker, weekRisk: RiskLevel, rainValue: number, weekStart?: string) {
  const basis = marker.weeks?.[0]?.rainBasis ?? 'rain workdays';
  return `
    <div style="min-width:220px">
      <div style="font-weight:700;color:#0f172a;margin-bottom:2px">${escapeHtml(marker.shortName)}</div>
      <div style="font-size:12px;color:#475569;margin-bottom:8px">${escapeHtml(marker.locationName ?? 'No location')}</div>
      <div style="display:grid;gap:4px;font-size:12px;color:#1e293b">
        ${weekStart ? `<div><strong>Week of ${escapeHtml(weekStart)}:</strong> ${escapeHtml(weekRisk)} weather risk</div>` : ''}
        <div><strong>Rain:</strong> ${rainValue} ${escapeHtml(basis)}</div>
        <div><strong>Source:</strong> ${escapeHtml(marker.weatherSource)}</div>
        <div><strong>Deferred:</strong> ${escapeHtml(eurCompact(marker.deferredCashImpact))}</div>
        <div><strong>Weather impact:</strong> ${escapeHtml(signedEur(marker.estimatedWeatherCashImpact))}</div>
      </div>
    </div>
  `;
}

function duplicateIndex(marker: MapCompanyMarker, markers: MapCompanyMarker[]) {
  const same = markers.filter((candidate) => samePoint(candidate, marker));
  const idx = same.findIndex((candidate) => candidate.code === marker.code);
  return idx < 0 ? 0 : idx;
}

function samePoint(a: MapCompanyMarker, b: MapCompanyMarker) {
  return Math.abs(a.latitude - b.latitude) < 0.0001 && Math.abs(a.longitude - b.longitude) < 0.0001;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
