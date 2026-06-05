import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { BEATS, s, COLORS } from './theme';
import { Intro } from './scenes/Intro';
import { Beat1FragmentedData } from './scenes/Beat1FragmentedData';
import { Beat2OneSource } from './scenes/Beat2OneSource';
import { Beat3Weather } from './scenes/Beat3Weather';
import { Beat4Forecast } from './scenes/Beat4Forecast';
import { Beat5Dashboards } from './scenes/Beat5Dashboards';
import { Beat6Risk } from './scenes/Beat6Risk';
import { Beat7Close } from './scenes/Beat7Close';

// Scene definitions: [startSec, endSec, component, label]
const SCENES = [
  { start: BEATS.intro,  end: BEATS.beat1,  comp: Intro,               label: 'Intro' },
  { start: BEATS.beat1,  end: BEATS.beat2,  comp: Beat1FragmentedData,  label: 'Beat1' },
  { start: BEATS.beat2,  end: BEATS.beat3,  comp: Beat2OneSource,       label: 'Beat2' },
  { start: BEATS.beat3,  end: BEATS.beat4,  comp: Beat3Weather,         label: 'Beat3' },
  { start: BEATS.beat4,  end: BEATS.beat5,  comp: Beat4Forecast,        label: 'Beat4' },
  { start: BEATS.beat5,  end: BEATS.beat6,  comp: Beat5Dashboards,      label: 'Beat5' },
  { start: BEATS.beat6,  end: BEATS.beat7,  comp: Beat6Risk,            label: 'Beat6' },
  { start: BEATS.beat7,  end: BEATS.end,    comp: Beat7Close,           label: 'Beat7' },
];

// Cross-fade duration in frames
const XFADE = 12;

function SceneLayer({
  sceneStart,
  sceneEnd,
  startFrame,
  children,
}: {
  sceneStart: number;
  sceneEnd: number;
  startFrame: number;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [sceneStart, sceneStart + XFADE], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [sceneEnd - XFADE, sceneEnd], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = Math.min(fadeIn, fadeOut);

  if (frame < sceneStart || frame > sceneEnd) return null;

  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
}

// Progress bar at the bottom
function ProgressBar() {
  const frame = useCurrentFrame();
  const totalFrames = s(BEATS.end);
  const progress = (frame / totalFrames) * 100;
  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      width: '100%',
      height: 4,
      background: `${COLORS.slateLight}66`,
      zIndex: 100,
    }}>
      <div style={{
        width: `${progress}%`,
        height: '100%',
        background: `linear-gradient(90deg, ${COLORS.teal} 0%, ${COLORS.tealLight} 100%)`,
      }} />
    </div>
  );
}

// Beat label overlay (subtle, bottom-right)
function BeatLabel() {
  const frame = useCurrentFrame();
  const current = SCENES.find((sc) => frame >= s(sc.start) && frame < s(sc.end));
  if (!current || current.label === 'Intro') return null;

  const beatNum = parseInt(current.label.replace('Beat', ''), 10);
  const beatLabels: Record<number, string> = {
    1: 'Fragmented data',
    2: 'One source of truth',
    3: 'Weather insight',
    4: '13-week forecast',
    5: 'Role dashboards',
    6: 'Risk + traceability',
    7: 'Honest close',
  };
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      right: 24,
      fontSize: 12,
      color: `${COLORS.muted}88`,
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontWeight: 600,
      zIndex: 99,
    }}>
      {beatLabels[beatNum]}
    </div>
  );
}

export const AltisDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {SCENES.map((scene) => {
        const Comp = scene.comp;
        const startF = s(scene.start);
        const endF = s(scene.end);
        return (
          <SceneLayer
            key={scene.label}
            sceneStart={startF}
            sceneEnd={endF}
            startFrame={startF}
          >
            <Comp startFrame={startF} />
          </SceneLayer>
        );
      })}
      <ProgressBar />
      <BeatLabel />
    </AbsoluteFill>
  );
};
