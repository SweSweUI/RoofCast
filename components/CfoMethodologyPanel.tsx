import type { WeatherRiskMode } from '@/lib/types';
import { eurCompact } from '@/lib/format';
import { Card, Pill } from './ui';

type CfoLanguage = 'en' | 'nl';

interface MethodologyCopy {
  title: string;
  subtitle: string;
  defend: string;
  weak: string;
  items: {
    scenario: string;
    weeks: string;
    headroom: string;
    lag: string;
  };
  weakItems: string[];
  floor: string;
  rule: string;
}

interface WeatherRuleView {
  label: string;
  mode: WeatherRiskMode;
  medium: number;
  high: number;
  explanationEn: string;
  explanationNl: string;
}

const COPY = {
  en: {
    title: 'Methodology the CFO can defend',
    subtitle: 'Plain-language logic behind the forecast, risk weeks and covenant headroom',
    defend: 'What this page is saying',
    weak: 'Weak spots to be open about',
    items: {
      scenario:
        'No wet/base/dry choice: the operating forecast uses current weather data first, then seasonal climatology after the live forecast window.',
      weeks:
        'Weeks at risk combines liquidity and weather. A week counts when closing cash is tight or breached, or when the selected weather rule marks it as a high-delay week.',
      headroom:
        'Covenant headroom is projected closing cash minus the warning floor. Negative headroom means the forecast breaches the floor.',
      lag:
        'Weather does not destroy revenue in the model. It shifts billing and cash-in later, with catch-up starting roughly four weeks after the disrupted week.',
    },
    weakItems: [
      'The source data is billing-led; bank balances, AP and full cost ledgers are still assumptions.',
      'The weather lag is a useful signal, not causal proof.',
      'Project-level milestones and WIP would improve timing accuracy.',
    ],
    floor: 'Warning floor',
    rule: 'Weather rule',
  },
  nl: {
    title: 'Uitleg die de CFO kan verdedigen',
    subtitle: 'Eenvoudige uitleg van forecast, risicoweken en covenant headroom',
    defend: 'Wat dit scherm zegt',
    weak: 'Zwakke punten om eerlijk over te zijn',
    items: {
      scenario:
        'Geen nat/base/droog keuze: de operationele forecast gebruikt eerst actuele weersdata en daarna seizoenshistorie.',
      weeks:
        'Weken met risico combineren liquiditeit en weer. Een week telt mee als closing cash krap is of door de vloer gaat, of als de gekozen weerregel een hoge vertragingsweek markeert.',
      headroom:
        'Covenant headroom is projected closing cash minus de waarschuwingsvloer. Negatieve headroom betekent dat de forecast door de vloer gaat.',
      lag:
        'Weer haalt geen omzet weg in het model. Het schuift billing en cash-in naar later, met catch-up vanaf ongeveer vier weken na de verstoorde week.',
    },
    weakItems: [
      'De brondata is billing-gedreven; bankstanden, AP en volledige kostenledgers zijn nog aannames.',
      'De weather lag is een bruikbaar signaal, geen causaal bewijs.',
      'Projectmilestones en WIP zouden de timing nauwkeuriger maken.',
    ],
    floor: 'Waarschuwingsvloer',
    rule: 'Weerregel',
  },
} satisfies Record<CfoLanguage, MethodologyCopy>;

export function CfoMethodologyPanel({
  language,
  horizonWeeks,
  weatherRule,
  covenantFloor,
}: {
  language: CfoLanguage;
  horizonWeeks: number;
  weatherRule: WeatherRuleView;
  covenantFloor: number | null;
}) {
  const c = COPY[language];
  return (
    <Card
      title={c.title}
      subtitle={c.subtitle}
      right={<Pill tone="accent">{horizonWeeks} weeks</Pill>}
    >
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{c.defend}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Explanation label={language === 'nl' ? 'Forecast basis' : 'Forecast basis'} text={c.items.scenario} />
            <Explanation label={language === 'nl' ? 'Risicoweken' : 'Weeks at risk'} text={c.items.weeks} />
            <Explanation label="Headroom" text={c.items.headroom} />
            <Explanation label={language === 'nl' ? 'Weer-lag' : 'Weather lag'} text={c.items.lag} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-panel-line bg-panel-sunken p-3">
            <div className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{c.rule}</div>
            <div className="mt-1 text-sm font-semibold text-ink">{weatherRule.label}</div>
            <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
              {language === 'nl' ? weatherRule.explanationNl : weatherRule.explanationEn}
            </p>
            <p className="mt-1 text-[10px] text-ink-faint">
              Medium {'>='} {weatherRule.medium}; high {'>='} {weatherRule.high} · {weatherRule.mode}
            </p>
          </div>

          <div className="rounded-md border border-panel-line bg-panel-sunken p-3">
            <div className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{c.floor}</div>
            <div className="mt-1 text-sm font-semibold text-ink">
              {covenantFloor == null ? 'n/a' : eurCompact(covenantFloor)}
            </div>
            <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
              {language === 'nl'
                ? 'De vloer is configureerbaar voor de waarschuwing en covenant headroom.'
                : 'The floor is configurable for warning status and covenant headroom.'}
            </p>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">{c.weak}</h3>
            <ul className="space-y-1 text-2xs leading-relaxed text-ink-muted">
              {c.weakItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Explanation({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-panel-line bg-panel-sunken p-3">
      <div className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <p className="mt-1 text-2xs leading-relaxed text-ink-muted">{text}</p>
    </div>
  );
}
