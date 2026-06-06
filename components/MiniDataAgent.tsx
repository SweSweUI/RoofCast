'use client';
import { FormEvent, useState } from 'react';
import type { ForecastParams, Scenario } from '@/lib/types';
import { Card } from './ui';

type AgentLanguage = 'en' | 'nl';

interface AgentResponse {
  answer?: string;
  bullets?: string[];
  sources?: string[];
  mode?: string;
  error?: string;
}

const SUGGESTIONS: Record<AgentLanguage, string[]> = {
  en: [
    'Explain weeks at risk',
    'Explain covenant headroom',
    'What should I say if challenged?',
  ],
  nl: [
    'Leg weken met risico uit',
    'Leg covenant headroom uit',
    'Wat zeg ik bij kritische vragen?',
  ],
};

export function MiniDataAgent({
  company,
  scenario,
  overrides,
  language,
}: {
  company: string;
  scenario: Scenario;
  overrides: Partial<ForecastParams>;
  language: AgentLanguage;
}) {
  const [question, setQuestion] = useState(SUGGESTIONS[language][0]);
  const [answer, setAnswer] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, company, scenario, overrides }),
      });
      const body = (await res.json()) as AgentResponse;
      setAnswer(res.ok ? body : { error: body.error ?? `HTTP ${res.status}` });
    } catch (err) {
      setAnswer({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      title={language === 'nl' ? 'Vraag de data-agent' : 'Ask the data agent'}
      subtitle={language === 'nl' ? 'Gebruikt dezelfde forecast en instellingen als dit scherm' : 'Uses this view’s forecast and settings'}
    >
      <form onSubmit={ask} className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS[language].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuestion(s);
                setAnswer(null);
              }}
              className="rounded-md border border-panel-line bg-panel-sunken px-2 py-1 text-2xs font-medium text-ink-muted hover:border-accent/40 hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            aria-label={language === 'nl' ? 'Agentvraag' : 'Agent question'}
            data-testid="mini-agent-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-panel-line bg-panel px-2.5 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="submit"
            data-testid="mini-agent-submit"
            disabled={loading}
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? (language === 'nl' ? '...' : '...') : language === 'nl' ? 'Vraag' : 'Ask'}
          </button>
        </div>
      </form>

      {answer?.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-risk-high">{answer.error}</p>
      )}
      {answer?.answer && (
        <div className="mt-3 rounded-md bg-panel-sunken p-3">
          <p className="text-sm leading-relaxed text-ink-soft">{answer.answer}</p>
          {!!answer.bullets?.length && (
            <ul className="mt-2 space-y-1 text-2xs leading-relaxed text-ink-muted">
              {answer.bullets.slice(0, 4).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {!!answer.sources?.length && (
            <p className="mt-2 text-[10px] uppercase tracking-wide text-ink-faint">
              {answer.mode ?? 'rules'} · {answer.sources.slice(0, 3).join(' · ')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
