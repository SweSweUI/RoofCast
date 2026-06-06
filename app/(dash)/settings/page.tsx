'use client';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import { useSettings, HORIZON_OPTIONS, WEATHER_RULES } from '@/lib/client/settings';
import { Card, Pill, SectionTitle } from '@/components/ui';
import { CfoMethodologyPanel } from '@/components/CfoMethodologyPanel';
import { MethodologyContent } from '@/components/MethodologyContent';
import { eurCompact } from '@/lib/format';

export default function SettingsPage() {
  const { settings, update, setDriver, reset, isDefault } = useSettings();
  const nl = settings.language === 'nl';
  const [showMethodology, setShowMethodology] = useState(false);
  const driverTotal =
    settings.drivers.materials + settings.drivers.subcontractor + settings.drivers.labour + settings.drivers.overhead;

  // The same plain-language methodology widget shown on the CFO view, wired to
  // the live settings here so editing the weather rule / floor updates it in place.
  const rulePreset = WEATHER_RULES.find((r) => r.mode === settings.weatherRiskMode) ?? WEATHER_RULES[0];
  const weatherRule = {
    label: rulePreset.label,
    mode: rulePreset.mode,
    medium: settings.weatherMediumThreshold,
    high: settings.weatherHighThreshold,
    explanationEn: rulePreset.en,
    explanationNl: rulePreset.nl,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle sub={nl ? 'Eén plek voor alle aannames — elk dashboard toont het resultaat' : 'One place for every assumption — each dashboard just displays the result'}>
          {nl ? 'Instellingen' : 'Settings'}
        </SectionTitle>
        <div className="flex items-center gap-2">
          <Pill tone="live">{nl ? 'Live weerbasis' : 'Live weather basis'}</Pill>
          <button
            type="button"
            onClick={reset}
            disabled={isDefault}
            className="rounded-md border border-panel-line px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-panel-sunken disabled:opacity-50"
          >
            {nl ? 'Herstel standaard' : 'Reset to defaults'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Horizon + language */}
        <Card title={nl ? 'Forecast horizon' : 'Forecast horizon'} subtitle={nl ? 'Aantal weken op alle dashboards' : 'Number of weeks across all dashboards'}>
          <Field label={nl ? 'Cashflow horizon' : 'Cashflow horizon'}>
            <Segmented
              options={HORIZON_OPTIONS.map((w) => ({ value: w, label: `${w}w` }))}
              value={settings.horizonWeeks}
              onChange={(v) => update({ horizonWeeks: Number(v) })}
            />
          </Field>
          <Field label={nl ? 'Taal' : 'Language'}>
            <Segmented
              options={[{ value: 'en', label: 'EN' }, { value: 'nl', label: 'NL' }]}
              value={settings.language}
              onChange={(v) => update({ language: v as 'en' | 'nl' })}
            />
          </Field>
        </Card>

        {/* Liquidity & covenant */}
        <Card title={nl ? 'Liquiditeit & covenant' : 'Liquidity & covenant'} subtitle={nl ? 'Waarschuwingsvloer en openingssaldo (aanname)' : 'Warning floor and opening cash (assumption)'}>
          <Field label={nl ? 'Waarschuwingsvloer' : 'Warning floor'}>
            <EuroInput value={settings.covenantFloor} step={50_000} onChange={(v) => update({ covenantFloor: v })} />
          </Field>
          <Field
            label={nl ? 'Openingssaldo (per bedrijf)' : 'Opening cash (single company)'}
            hint={nl ? 'Leeg = gemodelleerde standaard. Geldt voor losse bedrijfsweergaven.' : 'Blank = modelled default. Applies to single-company views.'}
          >
            <div className="flex items-center gap-2">
              <EuroInput
                value={settings.openingCash ?? 0}
                step={50_000}
                disabled={settings.openingCash == null}
                onChange={(v) => update({ openingCash: v })}
              />
              <label className="flex items-center gap-1 text-2xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={settings.openingCash == null}
                  onChange={(e) => update({ openingCash: e.target.checked ? null : 600_000 })}
                />
                {nl ? 'standaard' : 'default'}
              </label>
            </div>
          </Field>
        </Card>

        {/* Weather */}
        <Card title={nl ? 'Weer' : 'Weather'} subtitle={nl ? 'Slecht-weer definitie en gevoeligheid' : 'Bad-weather definition and sensitivity'}>
          <Field label={nl ? 'Slecht-weer regel' : 'Bad-weather rule'}>
            <div className="grid gap-1 sm:grid-cols-3">
              {WEATHER_RULES.map((rule) => (
                <button
                  key={rule.mode}
                  type="button"
                  onClick={() => update({ weatherRiskMode: rule.mode, weatherMediumThreshold: rule.medium, weatherHighThreshold: rule.high })}
                  className={clsx(controlButton(settings.weatherRiskMode === rule.mode), 'min-h-12 text-left')}
                  title={nl ? rule.nl : rule.en}
                >
                  <span className="block text-xs font-semibold">{rule.label}</span>
                  <span className="block text-[10px] font-normal opacity-70">{'high ≥'} {rule.high}</span>
                </button>
              ))}
            </div>
          </Field>
          <p className="-mt-1 mb-2 text-2xs leading-relaxed text-ink-muted">
            {nl ? WEATHER_RULES.find((r) => r.mode === settings.weatherRiskMode)?.nl : WEATHER_RULES.find((r) => r.mode === settings.weatherRiskMode)?.en}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={nl ? 'Medium drempel' : 'Medium threshold'}>
              <NumInput value={settings.weatherMediumThreshold} step={1} min={0} onChange={(v) => update({ weatherMediumThreshold: v })} />
            </Field>
            <Field label={nl ? 'Hoog drempel' : 'High threshold'}>
              <NumInput value={settings.weatherHighThreshold} step={1} min={0} onChange={(v) => update({ weatherHighThreshold: v })} />
            </Field>
            <Field label={nl ? 'Verschuiving hoog' : 'Shift on high'} hint="% billing">
              <PctInput value={settings.weatherShiftHigh} onChange={(v) => update({ weatherShiftHigh: v })} />
            </Field>
            <Field label={nl ? 'Verschuiving medium' : 'Shift on medium'} hint="% billing">
              <PctInput value={settings.weatherShiftMedium} onChange={(v) => update({ weatherShiftMedium: v })} />
            </Field>
          </div>
        </Card>

        {/* Cash-out assumptions */}
        <Card
          title={nl ? 'Cash-out aannames' : 'Cash-out assumptions'}
          subtitle={nl ? 'Kostendrijvers en dividend (geen kostenledger in brondata)' : 'Cost drivers and dividend (no cost ledger in source data)'}
          right={<Pill tone={Math.abs(driverTotal - 0.82) > 0.2 ? 'accent' : 'muted'}>{Math.round(driverTotal * 100)}% {nl ? 'van productie' : 'of production'}</Pill>}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label={nl ? 'Materiaal' : 'Materials'}><PctInput value={settings.drivers.materials} onChange={(v) => setDriver('materials', v)} /></Field>
            <Field label={nl ? 'Onderaanneming' : 'Subcontractor'}><PctInput value={settings.drivers.subcontractor} onChange={(v) => setDriver('subcontractor', v)} /></Field>
            <Field label={nl ? 'Arbeid' : 'Labour'}><PctInput value={settings.drivers.labour} onChange={(v) => setDriver('labour', v)} /></Field>
            <Field label={nl ? 'Overhead' : 'Overhead'}><PctInput value={settings.drivers.overhead} onChange={(v) => setDriver('overhead', v)} /></Field>
          </div>
          <Field label={nl ? 'Wekelijks dividend / overige uitstroom' : 'Weekly dividend / other cash-out'} hint={nl ? 'Aanname — niet in brondata' : 'Assumption — not in source data'}>
            <EuroInput value={settings.weeklyOtherCashOut} step={25_000} onChange={(v) => update({ weeklyOtherCashOut: v })} />
          </Field>
          <Field label={nl ? 'Baseline terugblik (weken)' : 'Baseline lookback (weeks)'}>
            <NumInput value={settings.baselineLookbackWeeks} step={1} min={4} onChange={(v) => update({ baselineLookbackWeeks: v })} />
          </Field>
        </Card>
      </div>

      {/* Connectors & APIs */}
      <Card title={nl ? 'Connectors & APIs' : 'Connectors & APIs'} subtitle={nl ? 'Sleutels staan server-side; hier alleen status' : 'Keys stay server-side; status only here'}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ConnectorTile name="SnelStart" detail="FinTransactions · Peter Ummels" tone="live" />
          <ConnectorTile name="Exact Online" detail="GL exports" tone="muted" />
          <ConnectorTile name="Open-Meteo" detail={nl ? 'Live + seizoensweer' : 'Live + seasonal weather'} tone="live" />
          <ConnectorTile name="Data agent (OpenRouter)" detail={nl ? 'Onderbouwde Q&A' : 'Grounded Q&A'} tone="live" />
        </div>
        <p className="mt-3 text-2xs text-ink-faint">
          {nl ? 'Beheer alle accounting-connectors op de ' : 'Manage all accounting connectors on the '}
          <a className="text-accent underline" href="/connectors">API · {nl ? 'Connectors' : 'Connectors'}</a>
          {nl ? '-pagina. Vraag de ' : ' page. Ask the '}
          <a className="text-accent underline" href="/agent">{nl ? 'Data Agent' : 'Data Agent'}</a>
          {nl ? ' over methodiek en data.' : ' about methodology and data.'}
        </p>
      </Card>

      {/* Plain-language methodology widget — reflects the settings above live. */}
      <CfoMethodologyPanel
        language={settings.language}
        horizonWeeks={settings.horizonWeeks}
        weatherRule={weatherRule}
        covenantFloor={settings.covenantFloor}
      />

      {/* Evidence & reproducibility — downloadable analyst notebook + report. */}
      <Card
        title={nl ? 'Bewijs & reproduceerbaarheid' : 'Evidence & reproducibility'}
        subtitle={nl
          ? 'Download de volledige onderbouwing achter de forecast'
          : 'Download the full evidence behind the forecast'}
      >
        <div className="divide-y divide-panel-line">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <div className="max-w-xl">
              <div className="text-sm font-semibold text-ink">
                {nl ? 'Analist-notebook' : 'Analyst notebook'}{' '}
                <span className="text-2xs font-normal text-ink-faint">.ipynb · ~1.5&nbsp;MB</span>
              </div>
              <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
                {nl
                  ? 'Elke grafiek en elk getal end-to-end reproduceerbaar in Python — draai lokaal om de methodiek te verifiëren.'
                  : 'Every chart and number reproduced end-to-end in Python — run it locally to verify the methodology.'}
              </p>
            </div>
            <DownloadButton href="/api/analyst-notebook">
              {nl ? 'Download notebook' : 'Download notebook'}
            </DownloadButton>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <div className="max-w-xl">
              <div className="text-sm font-semibold text-ink">
                {nl ? 'Toelichtingsrapport' : 'Explainability report'}{' '}
                <span className="text-2xs font-normal text-ink-faint">.html</span>
              </div>
              <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
                {nl
                  ? 'Een code-vrij rapport: data, aannames, seizoenspatroon, weertiming en covenant-logica, met de dashboardgrafieken inline.'
                  : 'A code-free written report: data, assumptions, seasonality, weather timing and covenant logic, with the dashboard charts inline.'}
              </p>
            </div>
            <DownloadButton href="/api/report">
              {nl ? 'Download rapport' : 'Download report'}
            </DownloadButton>
          </div>
        </div>
      </Card>

      {/* Methodology — supporting documentation, collapsed by default so it
          doesn't compete with the configuration controls above. */}
      <section className="rounded-lg border border-panel-line bg-panel shadow-card">
        <button
          type="button"
          onClick={() => setShowMethodology((s) => !s)}
          aria-expanded={showMethodology}
          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {nl ? 'Methodologie & modelvalidatie' : 'Methodology & model validation'}
            </h2>
            <p className="mt-0.5 text-2xs text-ink-muted">
              {nl
                ? 'Hoe het weer-vertragingsmodel werkt en hoe het is gevalideerd — ondersteunende documentatie'
                : 'How the weather-delay model works and how it was validated — supporting documentation'}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <Pill tone="muted">{nl ? 'documentatie' : 'documentation'}</Pill>
            <svg
              viewBox="0 0 24 24"
              className={clsx('h-4 w-4 text-ink-faint transition-transform', showMethodology && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
        {showMethodology && (
          <div className="border-t border-panel-line p-4">
            <MethodologyContent showHeader={false} />
          </div>
        )}
      </section>
    </div>
  );
}

// --- small controls ---------------------------------------------------------

function DownloadButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      download
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink bg-ink px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink/90"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3v11m0 0l-4-4m4 4l4-4M5 21h14" />
      </svg>
      {children}
    </a>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] leading-snug text-ink-faint">{hint}</span>}
    </label>
  );
}

function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className={clsx('grid gap-1', `grid-cols-${Math.min(options.length, 4)}`)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)} className={controlButton(o.value === value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EuroInput({ value, step = 50_000, disabled, onChange }: { value: number; step?: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div className={clsx('flex items-center rounded-md border border-panel-line bg-panel px-2 py-1.5 focus-within:ring-2 focus-within:ring-accent/30', disabled && 'opacity-50')}>
      <span className="mr-1 text-xs text-ink-faint">€</span>
      <input
        type="number" min={0} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none tnum"
      />
      <span className="ml-1 text-2xs text-ink-faint">{eurCompact(value)}</span>
    </div>
  );
}

function NumInput({ value, step = 1, min = 0, onChange }: { value: number; step?: number; min?: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number" min={min} step={step} value={value}
      onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      className="w-full rounded-md border border-panel-line bg-panel px-2 py-1.5 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-accent/30 tnum"
    />
  );
}

function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center rounded-md border border-panel-line bg-panel px-2 py-1.5 focus-within:ring-2 focus-within:ring-accent/30">
      <input
        type="number" min={0} max={100} step={1} value={Math.round(value * 100)}
        onChange={(e) => onChange(Math.min(1, Math.max(0, (Number(e.target.value) || 0) / 100)))}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none tnum"
      />
      <span className="ml-1 text-xs text-ink-faint">%</span>
    </div>
  );
}

function ConnectorTile({ name, detail, tone }: { name: string; detail: string; tone: 'live' | 'muted' }) {
  return (
    <div className="rounded-md border border-panel-line bg-panel p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{name}</span>
        <Pill tone={tone}>{tone === 'live' ? 'active' : 'ready'}</Pill>
      </div>
      <p className="mt-1 text-2xs text-ink-muted">{detail}</p>
    </div>
  );
}

function controlButton(active: boolean) {
  return clsx(
    'rounded-md border px-2.5 py-2 text-center text-xs font-semibold transition-colors',
    active ? 'border-ink bg-ink text-white' : 'border-panel-line bg-panel-sunken text-ink-muted hover:border-accent/40 hover:text-accent',
  );
}
