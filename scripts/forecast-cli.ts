/**
 * Debug/demo CLI: prints a forecast against the real SQLite DB.
 * Usage:  npx tsx scripts/forecast-cli.ts [companyCode] [scenario]
 *         npx tsx scripts/forecast-cli.ts portfolio base
 */
import { computeForecast, computePortfolio, forecastCompanies, forecastStartWeek } from '../lib/forecast';
import { getCompanyByCode } from '../lib/queries';
import type { Scenario } from '../lib/types';

const arg = process.argv[2] ?? 'ummels';
const scenario = (process.argv[3] ?? 'base') as Scenario;
const eur = (x: number) => `€${Math.round(x).toLocaleString('en-US')}`;

console.log(`Forecast start week: ${forecastStartWeek()}`);
console.log(`Companies with data: ${forecastCompanies().map((c) => c.code).join(', ')}\n`);

if (arg === 'portfolio') {
  const { portfolio, companies } = computePortfolio(scenario);
  console.log(`PORTFOLIO — ${scenario}`);
  console.log(`  cash-in ${eur(portfolio.kpis.totalCashIn)}  cash-out ${eur(portfolio.kpis.totalCashOut)}  net ${eur(portfolio.kpis.netCashFlow)}`);
  console.log(`  min closing ${eur(portfolio.kpis.minClosingCash)} @ ${portfolio.kpis.minClosingWeek}  breach=${portfolio.kpis.covenantBreach}`);
  console.log(`  weeks at risk: ${portfolio.kpis.weeksAtRisk}/13, live-weather weeks: ${portfolio.kpis.liveWeatherWeeks}`);
  for (const c of companies) {
    console.log(`   - ${c.companyName.padEnd(16)} net ${eur(c.kpis.netCashFlow).padStart(12)}  min ${eur(c.kpis.minClosingCash).padStart(12)}`);
  }
} else {
  const co = getCompanyByCode(arg);
  if (!co) throw new Error(`unknown company ${arg}`);
  const r = computeForecast(scenario, co.id);
  console.log(`${r.companyName} — ${scenario}`);
  console.log('  wk  weekStart    cashIn      cashOut     net         closing     wxRisk  rainWD  live');
  for (const w of r.weeks) {
    console.log(
      `  ${String(w.weekIndex).padStart(2)}  ${w.weekStart}  ` +
        `${eur(w.forecastCashIn).padStart(10)}  ${eur(w.forecastCashOut).padStart(10)}  ` +
        `${eur(w.netCashFlow).padStart(11)}  ${eur(w.closingCash).padStart(11)}  ` +
        `${w.weatherRisk.padEnd(6)}  ${String(w.expectedRainWorkdays).padStart(4)}   ${w.isLiveWeather ? 'live' : 'seas'}`,
    );
  }
  console.log(`\n  KPIs: net ${eur(r.kpis.netCashFlow)}, min closing ${eur(r.kpis.minClosingCash)} @ ${r.kpis.minClosingWeek}, breach=${r.kpis.covenantBreach}`);
  console.log(`\n  Sample explanation (week 1):\n  ${r.weeks[0].explanation}`);
  console.log(`\n  Trace for week 5 (${r.weeks[4].weekStart}):`);
  for (const t of r.trace[r.weeks[4].weekStart]) {
    console.log(`   - ${t.driver.padEnd(18)} ${eur(t.contributionAmount).padStart(12)}  ${t.adjustmentReason}`);
  }
}
