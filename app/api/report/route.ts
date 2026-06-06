import { getCompanies, getSourceFiles, getStatsArtifact, getWeeklyFinancials } from '@/lib/queries';
import { computeForecast, computePortfolio } from '@/lib/forecast';
import { SCENARIO_LABELS, type ForecastResult, type ForecastWeek, type Scenario } from '@/lib/types';
import { parseScenario } from '@/lib/server/query';
import { eur, eurCompact, pct, signedEur, dateShort } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StatsCompany = {
  label: string;
  n_weeks: number;
  lag_table?: Array<Record<string, number>>;
  wet_dry?: Array<Record<string, number>>;
  yearly_lag5?: Array<Record<string, number | string>>;
  strongest_lag?: { lag: number; r: number; target: string; predictor: string };
};

type StatsArtifact = {
  generated_at?: string;
  method_notes?: string;
  companies?: Record<string, StatsCompany>;
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function td(value: unknown, cls = ''): string {
  return `<td${cls ? ` class="${cls}"` : ''}>${esc(value)}</td>`;
}

function th(value: unknown, cls = ''): string {
  return `<th${cls ? ` class="${cls}"` : ''}>${esc(value)}</th>`;
}

function section(title: string, body: string, subtitle?: string): string {
  return `
    <section class="section">
      <div class="section-head">
        <h2>${esc(title)}</h2>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
      ${body}
    </section>
  `;
}

function shortDateLabel(value: string): string {
  return dateShort(value).replace(' 2026', '').replace(' 2025', '').replace(' 2024', '').replace(' 2023', '');
}

function compactAxis(x: number): string {
  return eurCompact(x).replace('−', '-');
}

function chartTicks(minRaw: number, maxRaw: number, count = 5): number[] {
  const min = Math.min(minRaw, maxRaw);
  const max = Math.max(minRaw, maxRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [0, max || 1];
  const span = max - min;
  const rawStep = span / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v));
  return out.slice(0, 8);
}

function legend(items: Array<{ color: string; label: string }>, x = 58, y = 24): string {
  return items
    .map((item, i) => {
      const lx = x + i * 145;
      return `<rect x="${lx}" y="${y - 9}" width="10" height="10" rx="2" fill="${item.color}" /><text x="${lx + 15}" y="${y}" fill="#475569" font-size="12">${esc(item.label)}</text>`;
    })
    .join('');
}

function seriesChart(weeks: ForecastWeek[]): string {
  const w = 1180;
  const h = 430;
  const left = 82;
  const right = 58;
  const top = 56;
  const bottom = 76;
  const values = weeks.flatMap((x) => [x.forecastCashIn, x.forecastCashOut, x.closingCash]);
  const ticks = chartTicks(0, Math.max(...values), 6);
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const y = (v: number) => top + ((max - v) / Math.max(1, max - min)) * plotH;
  const x = (i: number) => left + (i / Math.max(1, weeks.length - 1)) * plotW;
  const line = weeks.map((week, i) => `${x(i)},${y(week.closingCash)}`).join(' ');
  const groupW = plotW / weeks.length;
  const bw = Math.min(24, Math.max(12, groupW / 4));
  const liveEnd = weeks.reduce((last, week, i) => (week.isLiveWeather ? i : last), -1);
  const bars = weeks
    .map((week, i) => {
      const cx = x(i);
      const inY = y(week.forecastCashIn);
      const outY = y(week.forecastCashOut);
      return `
        <rect x="${cx - bw - 3}" y="${inY}" width="${bw}" height="${Math.max(1, y(0) - inY)}" fill="#0f9f8f" opacity="0.88" />
        <rect x="${cx + 3}" y="${outY}" width="${bw}" height="${Math.max(1, y(0) - outY)}" fill="#dc2626" opacity="0.72" />
      `;
    })
    .join('');

  return `
    <figure class="wide-figure">
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="13-week cash-in, cash-out and closing cash chart">
        <rect width="${w}" height="${h}" fill="#ffffff" />
        ${liveEnd >= 0 ? `<rect x="${left}" y="${top}" width="${x(liveEnd) - left + groupW / 2}" height="${plotH}" fill="#ccfbf1" opacity="0.28" />` : ''}
        ${ticks.map((t) => `<line x1="${left}" x2="${w - right}" y1="${y(t)}" y2="${y(t)}" stroke="#e2e8f0" /><text x="${left - 12}" y="${y(t) + 4}" text-anchor="end" fill="#64748b" font-size="11">${esc(compactAxis(t))}</text>`).join('')}
        <line x1="${left}" x2="${w - right}" y1="${y(0)}" y2="${y(0)}" stroke="#94a3b8" />
        ${bars}
        <polyline points="${line}" fill="none" stroke="#0f172a" stroke-width="3" />
        ${weeks
          .map((week, i) => `
            <circle cx="${x(i)}" cy="${y(week.closingCash)}" r="4" fill="#0f172a"><title>${esc(dateShort(week.weekStart))}: closing ${esc(eur(week.closingCash))}</title></circle>
            <text x="${x(i)}" y="${h - 34}" text-anchor="end" transform="rotate(-35 ${x(i)} ${h - 34})" fill="#64748b" font-size="11">${esc(shortDateLabel(week.weekStart))}</text>
          `)
          .join('')}
        <text x="${left}" y="26" fill="#0f172a" font-size="15" font-weight="700">13-week cash-in, cash-out and closing cash</text>
        ${legend([
          { color: '#0f9f8f', label: 'Cash-in' },
          { color: '#dc2626', label: 'Cash-out' },
          { color: '#0f172a', label: 'Closing cash' },
        ], left, 48)}
        ${liveEnd >= 0 ? `<text x="${left + 8}" y="${top + 18}" fill="#0f766e" font-size="11">live weather window</text>` : ''}
      </svg>
      <figcaption>Weekly cash flow view used by the CFO dashboard. Cash-in follows debtor payment timing; cash-out is driver-based because the source data contains revenue, not AP/cost ledgers.</figcaption>
    </figure>
  `;
}

function driverStackChart(result: ForecastResult): string {
  const weeks = result.weeks;
  const w = 1180;
  const h = 390;
  const left = 82;
  const right = 44;
  const top = 58;
  const bottom = 74;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const max = Math.max(1, ...weeks.map((week) => week.forecastCashOut));
  const ticks = chartTicks(0, max, 5);
  const y = (v: number) => top + ((ticks[ticks.length - 1] - v) / ticks[ticks.length - 1]) * plotH;
  const groupW = plotW / weeks.length;
  const bw = Math.min(42, groupW * 0.58);
  const colors = {
    materials: '#0f766e',
    subcontractor: '#2563eb',
    labour: '#f59e0b',
    overhead: '#64748b',
  };
  const bars = weeks.map((week, i) => {
    const x = left + i * groupW + (groupW - bw) / 2;
    let acc = 0;
    return (['materials', 'subcontractor', 'labour', 'overhead'] as const).map((key) => {
      const value = week.drivers[key];
      const y0 = y(acc);
      acc += value;
      const y1 = y(acc);
      return `<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(1, y0 - y1)}" fill="${colors[key]}" opacity="0.86"><title>${esc(dateShort(week.weekStart))} ${key}: ${esc(eur(value))}</title></rect>`;
    }).join('');
  }).join('');
  return `
    <figure class="wide-figure">
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Cash-out driver decomposition chart">
        <rect width="${w}" height="${h}" fill="#ffffff" />
        ${ticks.map((t) => `<line x1="${left}" x2="${w - right}" y1="${y(t)}" y2="${y(t)}" stroke="#e2e8f0" /><text x="${left - 12}" y="${y(t) + 4}" text-anchor="end" fill="#64748b" font-size="11">${esc(compactAxis(t))}</text>`).join('')}
        ${bars}
        ${weeks.map((week, i) => {
          const tx = left + i * groupW + groupW / 2;
          return `<text x="${tx}" y="${h - 34}" text-anchor="end" transform="rotate(-35 ${tx} ${h - 34})" fill="#64748b" font-size="11">${esc(shortDateLabel(week.weekStart))}</text>`;
        }).join('')}
        <text x="${left}" y="26" fill="#0f172a" font-size="15" font-weight="700">Cash-out driver decomposition</text>
        ${legend([
          { color: colors.materials, label: 'Materials' },
          { color: colors.subcontractor, label: 'Subcontractor' },
          { color: colors.labour, label: 'Labour' },
          { color: colors.overhead, label: 'Overhead' },
        ], left, 48)}
      </svg>
      <figcaption>Stacked weekly cash-out drivers. These are explicit model assumptions because no AP, payroll or cost ledger was supplied in the raw data.</figcaption>
    </figure>
  `;
}

function weatherTimingChart(weeks: ForecastWeek[]): string {
  const rows = weeks.map((w) => ({ label: shortDateLabel(w.weekStart), value: w.weatherAdjustment, risk: w.weatherRisk }));
  return horizontalBarChart(rows, 'Weather timing impact by week', signedEur, {
    caption: 'Negative bars mean cash-in is delayed out of the week. Positive bars are catch-up cash returning from earlier weather delays.',
    height: 320,
    colors: { positive: '#0f9f8f', negative: '#dc2626' },
  });
}

function historicalRevenueChart(
  histories: Map<number, Awaited<ReturnType<typeof getWeeklyFinancials>>>,
  companyIds: number[],
): string {
  const allWeeks = [...new Set(companyIds.flatMap((id) => (histories.get(id) ?? []).map((w) => w.weekStart)))].sort();
  const recent = allWeeks.slice(-80);
  const rows = recent.map((week) => ({
    week,
    value: companyIds.reduce((sum, id) => sum + ((histories.get(id) ?? []).find((w) => w.weekStart === week)?.creditTotal ?? 0), 0),
  }));
  const w = 1180;
  const h = 360;
  const left = 82;
  const right = 40;
  const top = 48;
  const bottom = 64;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const ticks = chartTicks(0, Math.max(1, ...rows.map((r) => r.value)), 5);
  const y = (v: number) => top + ((ticks[ticks.length - 1] - v) / ticks[ticks.length - 1]) * plotH;
  const x = (i: number) => left + (i / Math.max(1, rows.length - 1)) * plotW;
  const points = rows.map((r, i) => `${x(i)},${y(r.value)}`).join(' ');
  const labels = rows.filter((_, i) => i % 12 === 0 || i === rows.length - 1);
  return `
    <figure class="wide-figure">
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Historical weekly facturation chart">
        <rect width="${w}" height="${h}" fill="#ffffff" />
        ${ticks.map((t) => `<line x1="${left}" x2="${w - right}" y1="${y(t)}" y2="${y(t)}" stroke="#e2e8f0" /><text x="${left - 12}" y="${y(t) + 4}" text-anchor="end" fill="#64748b" font-size="11">${esc(compactAxis(t))}</text>`).join('')}
        <polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="2.5" />
        ${rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.value)}" r="1.8" fill="#2563eb" opacity="0.45"><title>${esc(dateShort(r.week))}: ${esc(eur(r.value))}</title></circle>`).join('')}
        ${labels.map((r) => {
          const i = rows.indexOf(r);
          return `<text x="${x(i)}" y="${h - 28}" text-anchor="end" transform="rotate(-35 ${x(i)} ${h - 28})" fill="#64748b" font-size="10">${esc(shortDateLabel(r.week))}</text>`;
        }).join('')}
        <text x="${left}" y="26" fill="#0f172a" font-size="15" font-weight="700">Historical weekly facturation feeding the baseline</text>
      </svg>
      <figcaption>The notebook uses historical weekly facturation to establish both recent run-rate and ISO-week seasonal behaviour. This chart shows the latest observed weekly facturation window used as model context.</figcaption>
    </figure>
  `;
}

function seasonalIndexChart(
  histories: Map<number, Awaited<ReturnType<typeof getWeeklyFinancials>>>,
  companyIds: number[],
): string {
  const byIso = new Map<number, number[]>();
  const values: number[] = [];
  for (const id of companyIds) {
    for (const row of histories.get(id) ?? []) {
      if (row.creditTotal <= 0) continue;
      const d = new Date(`${row.weekStart}T00:00:00Z`);
      const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
      const iso = Math.min(53, Math.max(1, Math.ceil((days + start.getUTCDay() + 1) / 7)));
      const arr = byIso.get(iso) ?? [];
      arr.push(row.creditTotal);
      byIso.set(iso, arr);
      values.push(row.creditTotal);
    }
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const overall = sorted[Math.floor(sorted.length / 2)] || 1;
  const rows = Array.from({ length: 53 }, (_, i) => {
    const iso = i + 1;
    const arr = (byIso.get(iso) ?? []).slice().sort((a, b) => a - b);
    const median = arr[Math.floor(arr.length / 2)] ?? overall;
    return { iso, value: median / overall };
  });
  const w = 1180;
  const h = 330;
  const left = 70;
  const right = 36;
  const top = 48;
  const bottom = 56;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const max = Math.max(1.6, ...rows.map((r) => r.value));
  const min = Math.min(0.4, ...rows.map((r) => r.value));
  const y = (v: number) => top + ((max - v) / (max - min)) * plotH;
  const bw = plotW / rows.length - 2;
  return `
    <figure class="wide-figure">
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="ISO-week seasonal index chart">
        <rect width="${w}" height="${h}" fill="#ffffff" />
        ${[0.5, 1, 1.5].map((t) => `<line x1="${left}" x2="${w - right}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 1 ? '#94a3b8' : '#e2e8f0'}" /><text x="${left - 10}" y="${y(t) + 4}" text-anchor="end" fill="#64748b" font-size="11">${t.toFixed(1)}x</text>`).join('')}
        ${rows.map((r, i) => {
          const x = left + i * (plotW / rows.length);
          const base = y(1);
          const yy = y(r.value);
          const fill = r.value >= 1 ? '#0f9f8f' : '#f59e0b';
          return `<rect x="${x}" y="${Math.min(base, yy)}" width="${bw}" height="${Math.max(1, Math.abs(base - yy))}" fill="${fill}" opacity="0.78"><title>ISO week ${r.iso}: ${r.value.toFixed(2)}x seasonal index</title></rect>`;
        }).join('')}
        ${[1, 13, 26, 39, 53].map((iso) => {
          const x = left + (iso - 1) * (plotW / rows.length);
          return `<text x="${x}" y="${h - 24}" text-anchor="middle" fill="#64748b" font-size="11">${iso}</text>`;
        }).join('')}
        <text x="${left}" y="26" fill="#0f172a" font-size="15" font-weight="700">ISO-week seasonal index</text>
      </svg>
      <figcaption>Index above 1.0 means that ISO week historically bills above the median week; below 1.0 means a softer week. This is why the forecast is not a flat average.</figcaption>
    </figure>
  `;
}

function scenarioComparisonChart(companyResults: ForecastResult[], result: ForecastResult): string {
  if (!companyResults.length) return '';
  return horizontalBarChart(
    companyResults.map((c) => ({ label: c.companyName, value: c.kpis.netCashFlow })),
    'Company comparison: 13-week net cash flow',
    signedEur,
    { caption: 'Portfolio notebook view: net cash contribution by operating company over the selected 13-week scenario.' },
  );
}

function kpiCards(result: ForecastResult): string {
  const k = result.kpis;
  const cards = [
    ['Cash-in', eurCompact(k.totalCashIn), eur(k.totalCashIn)],
    ['Cash-out', eurCompact(k.totalCashOut), eur(k.totalCashOut)],
    ['Net cash', eurCompact(k.netCashFlow), signedEur(k.netCashFlow)],
    ['Min closing cash', eurCompact(k.minClosingCash), `week of ${dateShort(k.minClosingWeek)}`],
    ['Covenant', k.covenantBreach ? 'Breach' : 'Headroom', `${k.weeksAtRisk}/13 risk weeks`],
  ];
  return `
    <div class="kpi-grid">
      ${cards.map(([label, value, sub]) => `
        <div class="kpi-card">
          <div class="kpi-label">${esc(label)}</div>
          <div class="kpi-value">${esc(value)}</div>
          <div class="kpi-sub">${esc(sub)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function traceWaterfallChart(week: ForecastWeek): string {
  const rows = [
    { label: 'Baseline cash-in', value: week.baselineCashIn, kind: 'flow' },
    { label: 'Weather timing', value: week.weatherAdjustment, kind: 'flow' },
    { label: 'Materials', value: -week.drivers.materials, kind: 'flow' },
    { label: 'Subcontractor', value: -week.drivers.subcontractor, kind: 'flow' },
    { label: 'Labour', value: -week.drivers.labour, kind: 'flow' },
    { label: 'Overhead', value: -week.drivers.overhead, kind: 'flow' },
    { label: 'Net cash flow', value: week.netCashFlow, kind: 'total' },
  ];
  const runningLevels: number[] = [];
  let running = 0;
  for (const r of rows) {
    if (r.kind === 'total') {
      runningLevels.push(r.value);
    } else {
      running += r.value;
      runningLevels.push(running);
    }
  }
  const w = 1180;
  const h = 420;
  const left = 92;
  const right = 50;
  const top = 62;
  const bottom = 112;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const extents = rows.flatMap((row, i) => {
    if (row.kind === 'total') return [0, row.value];
    const prev = i === 0 ? 0 : runningLevels[i - 1];
    return [prev, prev + row.value];
  });
  const ticks = chartTicks(Math.min(0, ...extents), Math.max(0, ...extents), 6);
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const y = (v: number) => top + ((max - v) / Math.max(1, max - min)) * plotH;
  const groupW = plotW / rows.length;
  const bw = Math.min(86, groupW * 0.55);
  const bars = rows.map((row, i) => {
    const x = left + i * groupW + (groupW - bw) / 2;
    const prev = i === 0 || row.kind === 'total' ? 0 : runningLevels[i - 1];
    const next = row.kind === 'total' ? row.value : prev + row.value;
    const y0 = y(prev);
    const y1 = y(next);
    const rectY = Math.min(y0, y1);
    const height = Math.max(2, Math.abs(y0 - y1));
    const color = row.kind === 'total' ? '#0f172a' : row.value >= 0 ? '#0f9f8f' : '#dc2626';
    const labelY = row.value >= 0 ? rectY - 8 : rectY + height + 14;
    const textColor = row.value >= 0 ? '#0f766e' : '#b91c1c';
    const cx = x + bw / 2;
    const connector = row.kind === 'total' || i === rows.length - 1
      ? ''
      : `<line x1="${x + bw}" x2="${left + (i + 1) * groupW + (groupW - bw) / 2}" y1="${y(next)}" y2="${y(next)}" stroke="#94a3b8" stroke-dasharray="4 4" />`;
    return `
      <rect x="${x}" y="${rectY}" width="${bw}" height="${height}" rx="4" fill="${color}" opacity="0.86"><title>${esc(row.label)}: ${esc(signedEur(row.value))}</title></rect>
      ${connector}
      <text x="${cx}" y="${labelY}" text-anchor="middle" fill="${textColor}" font-size="12" font-weight="700">${esc(signedEur(row.value))}</text>
      <text x="${cx}" y="${h - 42}" text-anchor="end" transform="rotate(-35 ${cx} ${h - 42})" fill="#475569" font-size="12">${esc(row.label)}</text>
    `;
  }).join('');

  return `
    <figure class="wide-figure">
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Trace waterfall chart">
        <rect width="${w}" height="${h}" fill="#ffffff" />
        ${ticks.map((t) => `<line x1="${left}" x2="${w - right}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? '#94a3b8' : '#e2e8f0'}" /><text x="${left - 12}" y="${y(t) + 4}" text-anchor="end" fill="#64748b" font-size="11">${esc(compactAxis(t))}</text>`).join('')}
        ${bars}
        <text x="${left}" y="28" fill="#0f172a" font-size="15" font-weight="700">Trace waterfall: ${esc(dateShort(week.weekStart))}</text>
        ${legend([
          { color: '#0f9f8f', label: 'Cash-in / positive' },
          { color: '#dc2626', label: 'Cash-out / delay' },
          { color: '#0f172a', label: 'Net result' },
        ], left, 50)}
      </svg>
      <figcaption>This is the report version of the UI trace drawer. It starts with baseline cash-in, applies weather timing, subtracts cash-out drivers, and shows the week&apos;s net cash flow.</figcaption>
    </figure>
  `;
}

function horizontalBarChart(
  rows: Array<{ label: string; value: number; risk?: string }>,
  title: string,
  formatter: (x: number) => string,
  options: { caption?: string; height?: number; colors?: { positive: string; negative: string } } = {},
): string {
  const w = 1180;
  const h = options.height ?? Math.max(280, rows.length * 42 + 70);
  const left = 150;
  const right = 130;
  const top = 52;
  const bottom = 30;
  const vals = rows.map((r) => r.value);
  const ticks = chartTicks(Math.min(0, ...vals), Math.max(0, ...vals), 5);
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const plotW = w - left - right;
  const x = (v: number) => left + ((v - min) / Math.max(1, max - min)) * plotW;
  const zero = x(0);
  const rowH = (h - top - bottom) / Math.max(1, rows.length);
  const positive = options.colors?.positive ?? '#0f9f8f';
  const negative = options.colors?.negative ?? '#dc2626';
  return `
    <figure class="wide-figure">
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
        <rect width="${w}" height="${h}" fill="#ffffff" />
        <text x="${left}" y="26" fill="#0f172a" font-size="15" font-weight="700">${esc(title)}</text>
        ${ticks.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 8}" y2="${h - bottom}" stroke="#edf2f7" /><text x="${x(t)}" y="${h - 10}" text-anchor="middle" fill="#64748b" font-size="10">${esc(formatter(t))}</text>`).join('')}
        <line x1="${zero}" x2="${zero}" y1="${top - 8}" y2="${h - bottom}" stroke="#94a3b8" />
        ${rows
          .map((r, i) => {
            const y = top + i * rowH;
            const end = x(r.value);
            const start = Math.min(zero, end);
            const width = Math.max(1, Math.abs(end - zero));
            const fill = r.value < 0 ? negative : positive;
            return `
              <text x="${left - 12}" y="${y + rowH / 2 + 4}" text-anchor="end" fill="#475569" font-size="12">${esc(r.label)}</text>
              <rect x="${start}" y="${y + rowH / 2 - 8}" width="${width}" height="16" rx="3" fill="${fill}" opacity="0.82" />
              <text x="${end + (r.value < 0 ? -8 : 8)}" y="${y + rowH / 2 + 4}" text-anchor="${r.value < 0 ? 'end' : 'start'}" fill="#334155" font-size="12">${esc(formatter(r.value))}</text>
            `;
          })
          .join('')}
      </svg>
      ${options.caption ? `<figcaption>${esc(options.caption)}</figcaption>` : ''}
    </figure>
  `;
}

function lagLineChart(rows: Array<Record<string, number>>): string {
  const w = 1180;
  const h = 360;
  const left = 70;
  const right = 40;
  const top = 56;
  const bottom = 58;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const vals = rows.flatMap((r) => [Number(r.r_rain2mm_net ?? 0), Number(r.r_bad_net ?? 0)]);
  const min = Math.min(-0.35, ...vals);
  const max = Math.max(0.35, ...vals);
  const y = (v: number) => top + ((max - v) / (max - min)) * plotH;
  const x = (i: number) => left + (i / Math.max(1, rows.length - 1)) * plotW;
  const rain = rows.map((r, i) => `${x(i)},${y(Number(r.r_rain2mm_net ?? 0))}`).join(' ');
  const bad = rows.map((r, i) => `${x(i)},${y(Number(r.r_bad_net ?? 0))}`).join(' ');
  return `
    <figure class="wide-figure">
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Lag diagnostics line chart">
        <rect width="${w}" height="${h}" fill="#ffffff" />
        ${[-0.3, -0.15, 0, 0.15, 0.3].map((t) => `<line x1="${left}" x2="${w - right}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? '#94a3b8' : '#e2e8f0'}" /><text x="${left - 12}" y="${y(t) + 4}" text-anchor="end" fill="#64748b" font-size="11">${t.toFixed(2)}</text>`).join('')}
        <line x1="${x(5)}" x2="${x(5)}" y1="${top}" y2="${h - bottom}" stroke="#f59e0b" stroke-dasharray="5 5" />
        <text x="${x(5) + 6}" y="${top + 14}" fill="#b45309" font-size="11">lag 5 focus</text>
        <polyline points="${rain}" fill="none" stroke="#2563eb" stroke-width="3" />
        <polyline points="${bad}" fill="none" stroke="#dc2626" stroke-width="3" />
        ${rows.map((r, i) => `
          <circle cx="${x(i)}" cy="${y(Number(r.r_rain2mm_net ?? 0))}" r="4" fill="#2563eb"><title>lag ${r.lag}: rain-days r=${Number(r.r_rain2mm_net ?? 0).toFixed(3)}</title></circle>
          <circle cx="${x(i)}" cy="${y(Number(r.r_bad_net ?? 0))}" r="4" fill="#dc2626"><title>lag ${r.lag}: bad-workdays r=${Number(r.r_bad_net ?? 0).toFixed(3)}</title></circle>
          <text x="${x(i)}" y="${h - 28}" text-anchor="middle" fill="#64748b" font-size="11">${esc(r.lag)}</text>
        `).join('')}
        <text x="${left}" y="26" fill="#0f172a" font-size="15" font-weight="700">Lag diagnostics: weather in week t vs revenue in week t+lag</text>
        ${legend([
          { color: '#2563eb', label: 'Rain workdays' },
          { color: '#dc2626', label: 'Bad workdays' },
        ], left, 48)}
      </svg>
      <figcaption>Negative values mean revenue tends to be lower after wet or bad-workday weeks at that lag. The report shows this as a timing signal, not causal proof.</figcaption>
    </figure>
  `;
}

function wetDryGroupedChart(rows: Array<Record<string, number>>): string {
  const w = 1180;
  const h = 380;
  const left = 82;
  const right = 44;
  const top = 58;
  const bottom = 62;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const vals = rows.flatMap((r) => [Number(r.wet_mean ?? 0), Number(r.dry_mean ?? 0)]);
  const ticks = chartTicks(0, Math.max(1, ...vals), 5);
  const y = (v: number) => top + ((ticks[ticks.length - 1] - v) / ticks[ticks.length - 1]) * plotH;
  const groupW = plotW / Math.max(1, rows.length);
  const bw = Math.min(56, groupW / 4);
  return `
    <figure class="wide-figure">
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Wet vs dry grouped bar chart">
        <rect width="${w}" height="${h}" fill="#ffffff" />
        ${ticks.map((t) => `<line x1="${left}" x2="${w - right}" y1="${y(t)}" y2="${y(t)}" stroke="#e2e8f0" /><text x="${left - 12}" y="${y(t) + 4}" text-anchor="end" fill="#64748b" font-size="11">${esc(pct(t, 0))}</text>`).join('')}
        ${rows.map((r, i) => {
          const cx = left + i * groupW + groupW / 2;
          const dry = Number(r.dry_mean ?? 0);
          const wet = Number(r.wet_mean ?? 0);
          return `
            <rect x="${cx - bw - 5}" y="${y(dry)}" width="${bw}" height="${Math.max(1, y(0) - y(dry))}" fill="#0f9f8f" opacity="0.84"><title>lag ${r.lag} dry: ${pct(dry, 1)}</title></rect>
            <rect x="${cx + 5}" y="${y(wet)}" width="${bw}" height="${Math.max(1, y(0) - y(wet))}" fill="#2563eb" opacity="0.84"><title>lag ${r.lag} wet: ${pct(wet, 1)}</title></rect>
            <text x="${cx}" y="${h - 28}" text-anchor="middle" fill="#64748b" font-size="12">lag ${esc(r.lag)}</text>
            <text x="${cx}" y="${Math.min(y(wet), y(dry)) - 8}" text-anchor="middle" fill="${Number(r.pct_diff ?? 0) < 0 ? '#dc2626' : '#0f766e'}" font-size="11">${esc(pct(Number(r.pct_diff ?? 0), 1))}</text>
          `;
        }).join('')}
        <text x="${left}" y="26" fill="#0f172a" font-size="15" font-weight="700">Wet vs dry weeks: deviation from baseline by lag</text>
        ${legend([
          { color: '#0f9f8f', label: 'After dry weeks' },
          { color: '#2563eb', label: 'After wet weeks' },
        ], left, 48)}
      </svg>
      <figcaption>Labels above each lag show wet minus dry difference. Negative values support the weather-delay timing overlay, but the notebook caveat remains: the signal is weak and suggestive.</figcaption>
    </figure>
  `;
}

function companySummaryTable(companies: Awaited<ReturnType<typeof getCompanies>>, histories: Map<number, Awaited<ReturnType<typeof getWeeklyFinancials>>>): string {
  const rows = companies.map((c) => {
    const h = histories.get(c.id) ?? [];
    const credit = h.reduce((s, w) => s + w.creditTotal, 0);
    const txns = h.reduce((s, w) => s + w.txnCount, 0);
    return `<tr>${td(c.shortName)}${td(c.sourceSystem ?? 'n/a')}${td(c.sourceConfidence ?? 'n/a')}${td(c.locationName ?? 'n/a')}${td(String(h.length), 'num')}${td(txns.toLocaleString('en-US'), 'num')}${td(eur(credit), 'num')}</tr>`;
  });
  return `
    <table>
      <thead><tr>${th('Company')}${th('Source system')}${th('Confidence')}${th('Weather proxy')}${th('Weeks', 'num')}${th('Transactions', 'num')}${th('Facturation', 'num')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

function sourceSummaryTable(files: Awaited<ReturnType<typeof getSourceFiles>>): string {
  const grouped = new Map<string, { files: number; rows: number }>();
  for (const f of files) {
    const key = `${f.detected_company ?? 'Unknown'}|${f.detected_system ?? 'Unknown'}`;
    const g = grouped.get(key) ?? { files: 0, rows: 0 };
    g.files += 1;
    g.rows += Number(f.row_count ?? 0);
    grouped.set(key, g);
  }
  const rows = [...grouped.entries()].map(([key, g]) => {
    const [company, system] = key.split('|');
    return `<tr>${td(company)}${td(system)}${td(g.files, 'num')}${td(g.rows.toLocaleString('en-US'), 'num')}</tr>`;
  });
  return `
    <table>
      <thead><tr>${th('Detected company')}${th('Detected system')}${th('Files / sheets', 'num')}${th('Raw rows', 'num')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

function assumptionsTable(result: ForecastResult): string {
  const p = result.params;
  const rows = [
    ['Forecast horizon', `${p.horizonWeeks} weeks`, 'Operating CFO forecast window'],
    ['Seasonal baseline', `${p.baselineLookbackWeeks}-week trailing median × ISO-week seasonal index`, 'Uses actual facturation patterns rather than a flat average'],
    ['Debtor payment profile', `[${p.paymentLagWeights.join(', ')}]`, 'Collections peak around t+4 weeks; source has no debtors ledger'],
    ['Cash-out drivers', `Materials ${pct(p.drivers.materials)}, subcontractor ${pct(p.drivers.subcontractor)}, labour ${pct(p.drivers.labour)}, overhead ${pct(p.drivers.overhead)}`, 'Configurable because source data is revenue-only'],
    ['Driver payment lags', `Materials ${p.driverLagWeeks.materials}w, subcontractor ${p.driverLagWeeks.subcontractor}w, labour ${p.driverLagWeeks.labour}w, overhead ${p.driverLagWeeks.overhead}w`, 'Controls when production becomes cash-out'],
    ['Weather timing shift', `High ${pct(p.weatherShiftHigh)}, medium ${pct(p.weatherShiftMedium)}`, 'Defers billing timing; it does not destroy revenue'],
    ['Catch-up window', `+${p.catchUpStartLag} to +${p.catchUpStartLag + p.catchUpWeights.length - 1} weeks`, `Weights [${p.catchUpWeights.join(', ')}]`],
    ['Opening cash', eur(p.openingCash), 'Assumption because bank balances were not supplied'],
  ];
  return `
    <table>
      <thead><tr>${th('Input')}${th('Value')}${th('Why it matters')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${td(r[0])}${td(r[1])}${td(r[2])}</tr>`).join('')}</tbody>
    </table>
  `;
}

function forecastKpiTable(result: ForecastResult): string {
  const k = result.kpis;
  return `
    <table>
      <thead><tr>${th('Metric')}${th('Value', 'num')}${th('Interpretation')}</tr></thead>
      <tbody>
        <tr>${td('Cash-in over 13 weeks')}${td(eur(k.totalCashIn), 'num')}${td('Expected collections after debtor payment timing')}</tr>
        <tr>${td('Cash-out over 13 weeks')}${td(eur(k.totalCashOut), 'num')}${td('Materials, subcontractor, labour and overhead driver outflows')}</tr>
        <tr>${td('Net cash flow')}${td(signedEur(k.netCashFlow), 'num')}${td('Cash-in minus cash-out across the horizon')}</tr>
        <tr>${td('Minimum closing cash')}${td(eur(k.minClosingCash), 'num')}${td(`Lowest point occurs in the week of ${dateShort(k.minClosingWeek)}`)}</tr>
        <tr>${td('Covenant status')}${td(k.covenantBreach ? 'Breach' : 'No breach', 'num')}${td('Compared with configured minimum-cash or portfolio-liquidity floors')}</tr>
        <tr>${td('Weeks at risk')}${td(`${k.weeksAtRisk}/13`, 'num')}${td('Weeks flagged for liquidity or weather risk')}</tr>
      </tbody>
    </table>
  `;
}

function weeklyTable(result: ForecastResult): string {
  const rows = result.weeks.map((w) => `
    <tr>
      ${td(dateShort(w.weekStart))}
      ${td(w.isLiveWeather ? 'Live' : 'Seasonal')}
      ${td(w.weatherRisk)}
      ${td(eur(w.forecastCashIn), 'num')}
      ${td(eur(w.forecastCashOut), 'num')}
      ${td(signedEur(w.netCashFlow), 'num')}
      ${td(eur(w.closingCash), 'num')}
      ${td(w.covenantHeadroom == null ? 'n/a' : eur(w.covenantHeadroom), 'num')}
      ${td(w.riskLevel)}
    </tr>
  `);
  return `
    <table>
      <thead><tr>${th('Week')}${th('Weather basis')}${th('Weather risk')}${th('Cash-in', 'num')}${th('Cash-out', 'num')}${th('Net', 'num')}${th('Closing cash', 'num')}${th('Headroom', 'num')}${th('Risk')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

function statsSection(stats: StatsArtifact | null): string {
  const primary = stats?.companies?.ummels;
  if (!primary) {
    return section('Notebook Validation Layer', '<p class="muted">Statistics artifact not available. Run the stats pipeline to populate lag and wet-vs-dry validation.</p>');
  }
  const lagRows = primary.lag_table ?? [];
  const wetRows = primary.wet_dry ?? [];
  const yearlyRows = primary.yearly_lag5 ?? [];
  const lagChart = lagLineChart(lagRows);
  const wetChart = wetDryGroupedChart(wetRows);
  const yearly = `
    <table>
      <thead><tr>${th('Year')}${th('Lag-5 wet vs dry diff', 'num')}${th('Wet weeks', 'num')}${th('Dry weeks', 'num')}</tr></thead>
      <tbody>${yearlyRows.map((r) => `<tr>${td(r.year)}${td(pct(Number(r.pct_diff), 1), 'num')}${td(r.n_wet, 'num')}${td(r.n_dry, 'num')}</tr>`).join('')}</tbody>
    </table>
  `;
  return section(
    'Notebook Validation Layer',
    `
      <div class="callout"><strong>Interpretation:</strong> ${esc(stats?.method_notes ?? 'The weather-revenue signal is weak and suggestive, not causal. It is used only to shift timing.')}</div>
      ${lagChart}
      <p>Negative lag values mean rainy or bad-workday weeks tend to be followed by lower revenue at that lag. The important point is the timing pattern, not the exact magnitude.</p>
      ${wetChart}
      <p>The wet-vs-dry chart compares weeks with at least 3 rainy workdays against weeks with no rainy workdays. A negative bar means wet weeks had lower revenue deviation from the rolling baseline than dry weeks at that lag.</p>
      ${yearly}
      <p>The year-by-year table is the robustness check. Mixed signs reduce confidence; repeated negative signs support using weather as a timing risk overlay.</p>
    `,
    `${primary.label} · ${primary.n_weeks} historical weeks analysed`,
  );
}

function explanationLayer(result: ForecastResult): string {
  const materialWeather = result.weeks.filter((w) => Math.abs(w.weatherAdjustment) >= 1000);
  const example = result.weeks.find((w) => w.riskLevel !== 'low') ?? result.weeks[0];
  return section(
    'Explainability Layer',
    `
      <div class="grid">
        <div class="explain-card">
          <h3>1. Baseline</h3>
          <p>The model starts with recent facturation level and multiplies it by the ISO-week seasonal index. This prevents a June week, a winter week and a holiday week from being treated as identical.</p>
        </div>
        <div class="explain-card">
          <h3>2. Weather timing</h3>
          <p>Medium and high weather-risk weeks defer a share of billing into later weeks. This changes cash timing, not total expected work.</p>
        </div>
        <div class="explain-card">
          <h3>3. Debtor lag</h3>
          <p>Facturation is converted into cash-in through a collection profile that peaks around four weeks after billing.</p>
        </div>
        <div class="explain-card">
          <h3>4. Cash-out</h3>
          <p>Materials, subcontractor, labour and overhead are modelled as percentages of production with their own payment lags because no cost/AP ledger was supplied.</p>
        </div>
      </div>
      <h3>Example week explanation</h3>
      <p class="quote">${esc(example.explanation)}</p>
      ${traceWaterfallChart(example)}
      <h3>Weather timing impact in this horizon</h3>
      ${
        materialWeather.length
          ? `<table><thead><tr>${th('Week')}${th('Risk')}${th('Weather cash timing effect', 'num')}${th('Explanation')}</tr></thead><tbody>${materialWeather
              .map((w) => `<tr>${td(dateShort(w.weekStart))}${td(w.weatherRisk)}${td(signedEur(w.weatherAdjustment), 'num')}${td(w.weatherAdjustment < 0 ? 'Cash-in shifted later' : 'Catch-up cash returns into this week')}</tr>`)
              .join('')}</tbody></table>`
          : '<p class="muted">No material weather-timing shift in this 13-week horizon.</p>'
      }
    `,
    'How the report explains numbers the same way the UI trace panel does',
  );
}

function stylesheet(): string {
  return `
    <style>
      :root { color-scheme: light; --ink:#0f172a; --muted:#64748b; --line:#dbe3ea; --panel:#ffffff; --soft:#f8fafc; --accent:#0f9f8f; --bad:#dc2626; }
      * { box-sizing: border-box; }
      body { margin:0; color:var(--ink); background:#eef3f7; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.45; }
      .page { max-width: 1080px; margin: 0 auto; padding: 32px 24px 64px; }
      .hero { background: linear-gradient(135deg, #0f172a, #115e59); color:white; border-radius: 10px; padding: 30px; margin-bottom: 18px; }
      h1 { margin: 0; font-size: 30px; letter-spacing: 0; }
      h2 { margin: 0; font-size: 18px; }
      h3 { margin: 16px 0 6px; font-size: 14px; }
      p { margin: 8px 0; }
      .hero p { max-width: 820px; color: #dbeafe; }
      .meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
      .pill { border-radius: 999px; background: rgba(255,255,255,.14); padding: 5px 9px; font-size: 12px; }
      .section { background: var(--panel); border:1px solid var(--line); border-radius: 10px; margin-top: 16px; overflow:hidden; }
      .section-head { border-bottom:1px solid var(--line); padding: 14px 16px; background: var(--soft); }
      .section-head p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
      .section > :not(.section-head) { margin-left: 16px; margin-right: 16px; }
      .section > p, .section > .callout, .section > .grid, .section > figure, .section > table { margin-top: 14px; margin-bottom: 14px; }
      table { width: calc(100% - 32px); border-collapse: collapse; margin: 14px 16px; font-size: 12px; }
      th { text-align:left; color:#475569; background:#f8fafc; border-bottom:1px solid var(--line); padding: 8px; font-size: 11px; text-transform: uppercase; letter-spacing:.04em; }
      td { border-bottom:1px solid #edf2f7; padding: 7px 8px; vertical-align:top; }
      .num { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }
      figure { margin: 14px 16px; border:1px solid #edf2f7; border-radius: 8px; overflow:hidden; background:white; }
      .wide-figure { margin-top: 18px; margin-bottom: 18px; }
      svg { display:block; width:100%; height:auto; }
      figcaption { padding: 8px 10px; color:var(--muted); font-size:12px; border-top:1px solid #edf2f7; }
      .callout { border:1px solid #f59e0b; background:#fffbeb; color:#92400e; border-radius:8px; padding: 12px; }
      .grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .explain-card { border:1px solid #edf2f7; border-radius:8px; padding: 12px; background:#fbfdff; }
      .explain-card h3 { margin-top:0; }
      .kpi-grid { display:grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 14px 16px; }
      .kpi-card { border:1px solid #dbe3ea; border-radius:8px; padding: 12px; background:#fbfdff; }
      .kpi-label { font-size: 10px; color:#64748b; text-transform:uppercase; letter-spacing:.05em; font-weight:700; }
      .kpi-value { margin-top:4px; font-size:22px; font-weight:750; color:#0f172a; font-variant-numeric: tabular-nums; }
      .kpi-sub { margin-top:2px; font-size:11px; color:#64748b; font-variant-numeric: tabular-nums; }
      .quote { border-left: 3px solid var(--accent); padding: 10px 12px; background:#f0fdfa; color:#115e59; }
      .muted { color:var(--muted); }
      @media print { body { background:white; } .page { padding:0; max-width:none; } .section, .hero { break-inside: avoid; } }
      @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } .page { padding: 16px 10px 40px; } table { font-size: 11px; } }
    </style>
  `;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const scenario = parseScenario(sp);
  const companyCode = sp.get('company') ?? 'portfolio';

  const [companies, sourceFiles, stats] = await Promise.all([
    getCompanies(),
    getSourceFiles(),
    getStatsArtifact('stats.json') as Promise<StatsArtifact | null>,
  ]);

  const histories = new Map<number, Awaited<ReturnType<typeof getWeeklyFinancials>>>();
  await Promise.all(companies.map(async (c) => histories.set(c.id, await getWeeklyFinancials(c.id))));

  let result: ForecastResult;
  let companyResults: ForecastResult[] = [];
  if (companyCode === 'portfolio') {
    const portfolio = await computePortfolio(scenario);
    result = portfolio.portfolio;
    companyResults = portfolio.companies;
  } else {
    const company = companies.find((c) => c.code === companyCode) ?? companies[0];
    result = await computeForecast(scenario, company.id);
  }

  const selectedCompanyIds = companyCode === 'portfolio'
    ? companies.map((c) => c.id)
    : [companies.find((c) => c.code === companyCode)?.id ?? companies[0]?.id].filter((id): id is number => typeof id === 'number');
  const companyBars = scenarioComparisonChart(companyResults, result);

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Altis Cash Flow Explainability Report</title>
      ${stylesheet()}
    </head>
    <body>
      <main class="page">
        <header class="hero">
          <h1>Altis Cash Flow Explainability Report</h1>
          <p>Downloadable, code-free report derived from the analyst notebook and the live dashboard model. It explains the data, charts, assumptions, ISO-week seasonality, weather timing layer, debtor payment lag, cash-out drivers and covenant evaluation.</p>
          <div class="meta">
            <span class="pill">${esc(result.companyName)}</span>
            <span class="pill">${esc(SCENARIO_LABELS[scenario as Scenario])}</span>
            <span class="pill">Generated ${esc(new Date().toISOString().slice(0, 10))}</span>
            <span class="pill">Forecast starts ${esc(dateShort(result.weeks[0]?.weekStart ?? ''))}</span>
          </div>
        </header>

        ${section('Executive Summary', `
          ${kpiCards(result)}
          ${forecastKpiTable(result)}
          <p>The forecast answers one operating question: given recent billing, ISO-week seasonal patterns, weather disruption risk, debtor payment timing and configured cash-out drivers, where does closing cash become tight over the next 13 weeks?</p>
          <p>The model is a billing-to-cash forecast, not a bank-statement forecast. Opening cash, covenant floors, cash-out percentages and payment terms are explicit assumptions because those fields were not present in the source exports.</p>
        `)}

        ${section('Data Tables', `
          <h3>Operating company summary</h3>
          ${companySummaryTable(companies, histories)}
          <h3>Source-file inventory</h3>
          ${sourceSummaryTable(sourceFiles)}
          <p class="muted">These are the normalized data tables behind the UI: source files feed transactions, transactions aggregate into weekly financials, weekly financials feed the forecast, and assumptions/covenants explain modelled fields.</p>
        `, 'Overall data used by the notebook and dashboard')}

        ${section('How Cash Flow Is Evaluated', `
          ${assumptionsTable(result)}
          <p><strong>Cash-in:</strong> forecast production is converted into collections with a debtor-payment profile. The largest collection weight is around four weeks after billing, so revenue generated today mostly becomes cash later.</p>
          <p><strong>Cash-out:</strong> because the provided files are revenue-only, materials, subcontractor, labour and overhead are modelled as percentages of production. Materials and subcontractor costs are lagged; labour and overhead are same-week.</p>
          <p><strong>Closing cash:</strong> opening cash plus cumulative weekly net cash flow. <strong>Covenant headroom:</strong> closing cash minus the configured floor. Negative headroom is a breach; narrow positive headroom is a warning.</p>
        `)}

        ${section('ISO-Week Seasonality', `
          ${historicalRevenueChart(histories, selectedCompanyIds)}
          ${seasonalIndexChart(histories, selectedCompanyIds)}
          <p>The notebook uses ISO calendar weeks so recurring seasonal effects are compared like-for-like. A future week is not forecast from a flat average; it is forecast from recent run-rate multiplied by the historical seasonal index for that ISO week.</p>
          <p><strong>Seasonal index concept:</strong> median facturation in the same ISO week across history divided by the overall median weekly facturation. A value above 1.0 means that week has historically been stronger than average; below 1.0 means weaker.</p>
          <p>This matters for roofing and construction because work patterns are seasonal: winter weather, holiday weeks and mid-year project cycles should not be evaluated as if they were identical weeks.</p>
        `)}

        ${section('Dashboard Visuals Explained', `
          ${seriesChart(result.weeks)}
          ${driverStackChart(result)}
          ${weatherTimingChart(result.weeks)}
          ${companyBars}
          ${weeklyTable(result)}
          <p>The line chart explains the CFO view. Green bars are expected cash-in, red bars are expected cash-out, and the line is cumulative closing cash. The weekly table is the same analysis in tabular form so the numbers can be audited without reading code.</p>
        `)}

        ${statsSection(stats)}
        ${explanationLayer(result)}

        ${section('Known Limits', `
          <ul>
            <li>Weather is a suggestive timing signal, not causal proof of revenue loss.</li>
            <li>Cash-out drivers, opening cash, debtor profile and covenant floors are configurable assumptions.</li>
            <li>The source data is billing/revenue oriented. AP, payroll, bank balances, loan documents and WIP/project milestone data were not supplied.</li>
            <li>Delayed billing is assumed to catch up later; if catch-up falls outside the 13-week window, liquidity looks weaker inside the horizon even though work is not treated as lost.</li>
          </ul>
        `)}
      </main>
    </body>
  </html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="altis-cashflow-explainability-report-${scenario}-${companyCode}.html"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
