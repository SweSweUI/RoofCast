import React from 'react';
import { Composition } from 'remotion';
import { AltisDemo } from './AltisDemo';

// 30fps × 82.5s ≈ 2475 frames (we use 2460 = 82s)
const TOTAL_FRAMES = 2460;
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="AltisDemo"
        component={AltisDemo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{}}
      />
    </>
  );
};
