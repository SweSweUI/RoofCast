'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { AnimatedText } from '@/components/ui/animated-text';

// Letter-stagger + underline timings (kept in sync with the AnimatedText props
// below) plus a short hold, after which the splash fades out into the app.
const HOLD_MS = 2200;
const FADE_MS = 600;

/**
 * Full-screen launch animation shown on every load (desktop only). A static
 * RoofCast logo sits on top with the animated app name beneath it; only the
 * name animates. After the animation settles it auto-fades into the app.
 */
export function LaunchSplash() {
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), HOLD_MS);
    const doneTimer = setTimeout(() => setDone(true), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (done) return null;

  return (
    <div
      aria-hidden
      className={clsx(
        // desktop only — skip the splash on phones/small screens
        'fixed inset-0 z-[100] hidden items-center justify-center bg-[#05060a] md:flex',
        'transition-opacity ease-out',
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* subtle radial glow behind the mark */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.18),transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-6">
        <img
          src="/roofcast-logo.png"
          alt="RoofCast"
          width={132}
          height={132}
          className="h-32 w-32 rounded-2xl shadow-[0_0_60px_-10px_rgba(37,99,235,0.6)]"
        />
        <AnimatedText
          text="RoofCast"
          duration={0.08}
          delay={0.1}
          textClassName="text-5xl sm:text-6xl font-bold tracking-tight text-white"
          underlineGradient="from-blue-600 via-sky-400 to-blue-600"
          underlineHeight="h-1.5"
          underlineOffset="-bottom-3"
        />
      </div>
    </div>
  );
}
