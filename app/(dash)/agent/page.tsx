'use client';

import { FormEvent, useState } from 'react';
import { useDashboardState } from '@/lib/client/hooks';
import { SCENARIO_LABELS } from '@/lib/types';
import { Card, LoadingBlock, Pill, SectionTitle } from '@/components/ui';

interface AgentResponse {
  answer: string;
  bullets: string[];
  sources: string[];
  generatedAt: string;
}

interface Message {
  role: 'user' | 'agent';
  text: string;
  bullets?: string[];
  sources?: string[];
}

const SUGGESTIONS = [
  'Which company is most exposed to weather?',
  'Why is cash lower in week 5?',
  'How much cash is deferred by bad weather?',
  'How does the live forecast affect cash?',
  'What accounting APIs can we connect?',
  'What data is missing or assumed?',
];

export default function AgentPage() {
  const { scenario, company } = useDashboardState();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'agent',
      text: 'Ask a finance, weather, data-quality, or connector question. Answers come from the forecast engine, weather rows, source inventory, and connector registry.',
      sources: ['forecast_weeks', 'weather_weekly', 'data_inventory', 'connector registry'],
    },
  ]);

  async function ask(nextQuestion: string) {
    const q = nextQuestion.trim();
    if (!q || loading) return;
    setQuestion('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, company, scenario }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`);
      const data = body as AgentResponse;
      setMessages((prev) => [...prev, {
        role: 'agent',
        text: data.answer,
        bullets: data.bullets,
        sources: data.sources,
      }]);
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: 'agent',
        text: `I could not answer that from the internal data: ${String(error)}`,
        sources: ['agent error'],
      }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle sub={`${company} · ${SCENARIO_LABELS[scenario]} · internal data only`}>
          Data Agent
        </SectionTitle>
        <Pill tone="accent">auditable answers, no external browsing</Pill>
      </div>

      <Card
        title="Ask Altis"
        subtitle="Forecast, weather, risk, data-quality, and accounting connector questions."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-md border border-panel-line px-2.5 py-1 text-xs text-ink-muted hover:bg-panel-sunken hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="max-h-[560px] space-y-3 overflow-y-auto rounded-md border border-panel-line bg-panel-sunken p-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'ml-auto max-w-3xl rounded-md bg-ink px-3 py-2 text-sm text-white' : 'max-w-4xl rounded-md border border-panel-line bg-panel px-3 py-2 text-sm text-ink-soft'}>
              <p className="leading-relaxed">{m.text}</p>
              {m.bullets && m.bullets.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {m.bullets.map((b, j) => (
                    <li key={j} className="flex gap-2 text-2xs leading-relaxed">
                      <span className="mt-0.5 text-ink-faint">-</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.sources.map((s) => (
                    <span key={s} className="rounded bg-panel-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <LoadingBlock label="Querying internal forecast data..." />}
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 md:flex-row">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask why cash moves, which company is exposed, what data is missing, or which accounting connector to use."
            className="min-h-20 flex-1 resize-y rounded-md border border-panel-line bg-panel px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50 md:self-end"
          >
            Ask
          </button>
        </form>
      </Card>
    </div>
  );
}
