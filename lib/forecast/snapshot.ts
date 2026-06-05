/**
 * Persist a base/wet/dry forecast snapshot into the `forecast_weeks` and
 * `trace_links` tables. The live TypeScript engine is the source of truth; this
 * makes the output auditable directly in the database and demonstrates the
 * persistence path. Run:  npm run snapshot   (after the data pipeline).
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { SCENARIOS, type ForecastResult } from '../types';
import { computePortfolio } from './index';

const dbFile = path.resolve(process.cwd(), process.env.ALTIS_DB_PATH || './data/altis.db');
const db = new DatabaseSync(dbFile);

db.exec('DELETE FROM trace_links; DELETE FROM forecast_weeks;');

const insFW = db.prepare(
  `INSERT INTO forecast_weeks
     (scenario, company_id, week_start, week_index, is_live_weather,
      baseline_cash_in, baseline_cash_out, weather_adjustment, payment_lag_adjustment,
      forecast_cash_in, forecast_cash_out, net_cash_flow, closing_cash,
      covenant_headroom, risk_level, explanation)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);
const insTL = db.prepare(
  `INSERT INTO trace_links
     (forecast_week_id, scenario, company_id, week_start, driver, contribution_amount, adjustment_reason)
   VALUES (?,?,?,?,?,?,?)`,
);

let weekRows = 0;
let traceRows = 0;

function persist(r: ForecastResult) {
  // portfolio is company-agnostic -> NULL (FK-exempt); real opcos keep their id
  const cid = r.companyId === 0 ? null : r.companyId;
  for (const w of r.weeks) {
    const res = insFW.run(
      r.scenario,
      cid,
      w.weekStart,
      w.weekIndex,
      w.isLiveWeather ? 1 : 0,
      w.baselineCashIn,
      w.forecastCashOut,
      w.weatherAdjustment,
      w.paymentLagAdjustment,
      w.forecastCashIn,
      w.forecastCashOut,
      w.netCashFlow,
      w.closingCash,
      w.covenantHeadroom,
      w.riskLevel,
      w.explanation,
    );
    weekRows++;
    const fwId = Number(res.lastInsertRowid);
    for (const t of r.trace[w.weekStart] ?? []) {
      insTL.run(fwId, r.scenario, r.companyId, w.weekStart, t.driver, t.contributionAmount, t.adjustmentReason);
      traceRows++;
    }
  }
}

for (const s of SCENARIOS) {
  const { portfolio, companies } = computePortfolio(s);
  persist(portfolio);
  for (const c of companies) persist(c);
}

db.close();
console.log(`Snapshot persisted: ${weekRows} forecast_weeks rows, ${traceRows} trace_links rows (3 scenarios × companies + portfolio).`);
