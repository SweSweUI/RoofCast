import type {
  WeatherApi167AirQuality,
  WeatherApi167Current,
  WeatherApi167Daily,
  WeatherApi167Detail,
  WeatherApi167Hourly,
} from './types';

const DEFAULT_RAPIDAPI_HOST = 'weather-api167.p.rapidapi.com';
const DEFAULT_DIRECT_BASE_URL = 'https://weather-api.site';
const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = { expiresAt: number; data: WeatherApi167Detail };
const cache = new Map<string, CacheEntry>();

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function rapidApiKey(): string | undefined {
  return process.env.WEATHER_API167_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
}

function directFallbackEnabled(): boolean {
  return process.env.WEATHER_API167_USE_DIRECT_FALLBACK !== 'false';
}

async function fetchJson(
  path: string,
  params: Record<string, string | number>,
  viaRapidApi: boolean,
) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const key = rapidApiKey();
  const host = process.env.WEATHER_API167_RAPIDAPI_HOST || DEFAULT_RAPIDAPI_HOST;
  const directBase = process.env.WEATHER_API167_DIRECT_BASE_URL || DEFAULT_DIRECT_BASE_URL;
  const url = viaRapidApi
    ? `https://${host}${path}?${qs.toString()}`
    : `${directBase}${path}?${qs.toString()}`;
  const headers: Record<string, string> = {};
  if (viaRapidApi) {
    if (!key) throw new Error('WEATHER_API167_RAPIDAPI_KEY is not configured');
    headers['X-RapidAPI-Key'] = key;
    headers['X-RapidAPI-Host'] = host;
  }

  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Weather API 167 ${res.status}: ${text.slice(0, 180) || res.statusText}`);
  }
  return res.json();
}

function mapCurrent(raw: any): WeatherApi167Current | null {
  if (!raw) return null;
  return {
    time: str(raw.time),
    temperature: num(raw.temperature),
    feelsLike: num(raw.feels_like),
    humidity: num(raw.humidity),
    windSpeed: num(raw.wind_speed),
    windDirectionText: str(raw.wind_direction_text),
    pressure: num(raw.pressure),
    visibility: num(raw.visibility),
    precipitation: num(raw.precipitation),
    cloudCover: num(raw.cloud_cover),
    uvIndex: num(raw.uv_index),
    condition: str(raw.condition),
  };
}

function mapHourly(rows: any[]): WeatherApi167Hourly[] {
  return rows.slice(0, 12).map((row) => ({
    time: String(row.time ?? ''),
    temperature: num(row.temperature),
    condition: str(row.condition),
    precipitationProbability: num(row.precipitation_probability),
  })).filter((row) => row.time);
}

function mapDaily(rows: any[]): WeatherApi167Daily[] {
  return rows.slice(0, 7).map((row) => ({
    date: String(row.date ?? ''),
    condition: str(row.condition),
    tempMax: num(row.temp_max),
    tempMin: num(row.temp_min),
    precipitation: num(row.precipitation),
    uvIndex: num(row.uv_index),
  })).filter((row) => row.date);
}

function mapAirQuality(raw: any): WeatherApi167AirQuality | null {
  const c = raw?.current;
  if (!c) return null;
  return {
    time: str(c.time),
    usAqi: num(c.us_aqi),
    category: str(c.category),
    pm25: num(c.pm2_5),
    pm10: num(c.pm10),
    nitrogenDioxide: num(c.nitrogen_dioxide),
    ozone: num(c.ozone),
  };
}

async function fetchDetail(
  latitude: number,
  longitude: number,
  viaRapidApi: boolean,
): Promise<WeatherApi167Detail> {
  const [bundle, air] = await Promise.all([
    fetchJson('/bundle', { lat: latitude, lon: longitude, hours: 24, days: 16 }, viaRapidApi),
    fetchJson('/air-quality', { lat: latitude, lon: longitude }, viaRapidApi).catch((error) => ({ error: String(error) })),
  ]);
  const provider = viaRapidApi ? 'rapidapi-weather-api167' : 'weather-api-site-direct';
  return {
    provider,
    providerLabel: viaRapidApi ? 'RapidAPI Weather API 167' : 'Weather API 167 direct fallback',
    rapidApiConfigured: Boolean(rapidApiKey()),
    fetchedAt: new Date().toISOString(),
    latitude: num(bundle.latitude) ?? latitude,
    longitude: num(bundle.longitude) ?? longitude,
    timezone: str(bundle.timezone),
    current: mapCurrent(bundle.current),
    hourly: mapHourly(Array.isArray(bundle.hourly) ? bundle.hourly : []),
    daily: mapDaily(Array.isArray(bundle.daily) ? bundle.daily : []),
    airQuality: 'error' in air ? null : mapAirQuality(air),
  };
}

export async function getWeatherApi167Detail(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): Promise<WeatherApi167Detail | null> {
  if (latitude == null || longitude == null) return null;
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const useRapidApi = Boolean(rapidApiKey());
  try {
    const data = await fetchDetail(latitude, longitude, useRapidApi);
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
    return data;
  } catch (error) {
    if (useRapidApi && directFallbackEnabled()) {
      const data = await fetchDetail(latitude, longitude, false);
      data.error = `RapidAPI request failed; showing direct fallback. ${String(error)}`;
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
      return data;
    }
    if (!useRapidApi && directFallbackEnabled()) {
      const data = await fetchDetail(latitude, longitude, false);
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
      return data;
    }
    return {
      provider: useRapidApi ? 'rapidapi-weather-api167' : 'weather-api-site-direct',
      providerLabel: useRapidApi ? 'RapidAPI Weather API 167' : 'Weather API 167 direct fallback',
      rapidApiConfigured: useRapidApi,
      fetchedAt: new Date().toISOString(),
      latitude,
      longitude,
      timezone: null,
      current: null,
      hourly: [],
      daily: [],
      airQuality: null,
      error: String(error),
    };
  }
}
