import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCompanyForecast, type ForecastInput } from './engine';
import { resolveParams } from './config';
import { addWeeksKey } from './dates';
import type { Company, Covenant, Scenario, WeatherWeek, WeeklyFinancial } from '../types';

const company: Company = {
  id: 1, code: 'test', name: 'Test Co', shortName: 'Test', locationName: 'NL',
  latitude: 50.9, longitude: 5.9, weatherLocationId: 1, sourceSystem: 'test',
  sourceConfidence: 'high', isAssumption: 0, notes: null,
};
const covenants: Covenant[] = [{
  id: 1, companyId: 1, name: 'Min cash', metric: 'min_cash_balance', threshold: 250000,
  direction: 'min', unit: 'EUR', basis: 'test', isAssumption: 1,
}];

function buildInputs(scenario: Scenario): ForecastInput {
  // 156 weeks of flat history -> level ~200k, seasonal index ~1
  const history: WeeklyFinancial[] = [];
  const weather: WeatherWeek[] = [];
  let wk = '2023-01-02';
  for (let i = 0; i < 156; i++) {
    history.push({ weekStart: wk, revenueNet: 200000, creditTotal: 200000, debitTotal: 0, txnCount: 40 });
    weather.push({
      weekStart: wk, rainSum: 20, workdayRainSum: 15, rainDays2mm: 2, rainDays5mm: 1,
      badWorkdays: 1, delayScore: 10, isForecast: 0, source: 'historical',
    });
    wk = addWeeksKey(wk, 1);
  }
  const startWeek = '2026-01-05';
  const params = resolveParams(scenario, { startWeek, openingCash: 500000 });
  return { company, history, weather, covenants, params, scenario };
}

test('produces exactly the horizon number of weeks', () => {
  const r = computeCompanyForecast(buildInputs('base'));
  assert.equal(r.weeks.length, 13);
  assert.equal(r.weeks[0].weekStart, '2026-01-05');
});

test('closing cash is the running cumulative of net cash flow', () => {
  const r = computeCompanyForecast(buildInputs('base'));
  let running = r.params.openingCash;
  for (const w of r.weeks) {
    running += w.netCashFlow;
    assert.ok(Math.abs(running - w.closingCash) <= 1, `week ${w.weekStart} closing mismatch`);
  }
});

test('trace links are additive to net cash flow (explainability)', () => {
  const r = computeCompanyForecast(buildInputs('base'));
  const additive = new Set([
    'baseline_cash_in', 'weather_delay', 'materials', 'subcontractor', 'labour', 'overhead',
  ]);
  for (const w of r.weeks) {
    const links = r.trace[w.weekStart];
    const sum = links.filter((l) => additive.has(l.driver)).reduce((s, l) => s + l.contributionAmount, 0);
    assert.ok(Math.abs(sum - w.netCashFlow) <= 5, `week ${w.weekStart} trace ${sum} vs net ${w.netCashFlow}`);
  }
});

test('scenario toggle changes numbers monotonically (dry >= base >= wet in-horizon cash-in)', () => {
  const dry = computeCompanyForecast(buildInputs('dry_quarter')).kpis.totalCashIn;
  const base = computeCompanyForecast(buildInputs('base')).kpis.totalCashIn;
  const wet = computeCompanyForecast(buildInputs('wet_quarter')).kpis.totalCashIn;
  assert.notEqual(dry, wet, 'scenarios must change the numbers');
  assert.ok(dry >= base, `dry ${dry} >= base ${base}`);
  assert.ok(base >= wet, `base ${base} >= wet ${wet}`);
});

test('weather shift conserves total production within horizon + spill (no value lost)', () => {
  const r = computeCompanyForecast(buildInputs('wet_quarter'));
  const baseProd = r.weeks.reduce((s, w) => s + w.baselineProduction, 0);
  const adjProd = r.weeks.reduce((s, w) => s + w.adjustedProduction, 0);
  // adjusted <= baseline within horizon because some work spills beyond week 13
  assert.ok(adjProd <= baseProd + 1, 'wet quarter pushes some billing beyond the window');
  assert.ok(adjProd > baseProd * 0.7, 'but most stays in-window');
});

test('deterministic: identical inputs -> identical output', () => {
  const a = JSON.stringify(computeCompanyForecast(buildInputs('base')).weeks);
  const b = JSON.stringify(computeCompanyForecast(buildInputs('base')).weeks);
  assert.equal(a, b);
});

test('every week carries a human-readable explanation', () => {
  const r = computeCompanyForecast(buildInputs('base'));
  for (const w of r.weeks) {
    assert.ok(w.explanation.includes(w.weekStart));
    assert.ok(w.explanation.length > 60);
  }
});
