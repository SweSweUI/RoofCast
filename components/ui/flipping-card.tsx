'use client';
import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface FlippingCardProps {
  className?: string;
  height?: number;
  width?: number;
  frontContent?: React.ReactNode;
  backContent?: React.ReactNode;
}

export function FlippingCard({
  className,
  frontContent,
  backContent,
  height = 300,
  width = 350,
}: FlippingCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="group [perspective:1000px] cursor-pointer"
      style={{
        "--height": `${height}px`,
        "--width": `${width}px`,
      } as React.CSSProperties}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={cn(
          "relative rounded-md border border-panel-line bg-panel shadow-card transition-all duration-700 [transform-style:preserve-3d]",
          "h-[var(--height)] w-[var(--width)]",
          // Flip on hover (desktop); click toggles for touch devices.
          "group-hover:[transform:rotateY(180deg)]",
          isFlipped && "[transform:rotateY(180deg)]",
          className
        )}
      >
        {/* Front Face */}
        <div className="absolute inset-0 h-full w-full rounded-[inherit] bg-panel text-ink [transform-style:preserve-3d] [backface-visibility:hidden] [transform:rotateY(0deg)]">
          <div className="[transform:translateZ(70px)_scale(.93)] h-full w-full">
            {frontContent}
          </div>
        </div>

        {/* Back Face */}
        <div className="absolute inset-0 h-full w-full rounded-[inherit] bg-panel text-ink [transform-style:preserve-3d] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="[transform:translateZ(70px)_scale(.93)] h-full w-full">
            {backContent}
          </div>
        </div>
      </div>
    </div>
  );
}
