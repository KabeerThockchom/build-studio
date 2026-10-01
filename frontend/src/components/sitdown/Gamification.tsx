/* Gamification: flying chips celebrate grade improvements.
   After a turn completes, we diff previous and new grades/brief to find what improved.
   Each improvement shows a small green chip that lifts from the turn and arcs into the rubric.
   Respects prefers-reduced-motion. */

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

export interface GamificationEvent {
  dim: string;           // the dimension that improved
  label: string;         // what improved (e.g. "Success target sharpened")
  oldGrade?: string;     // old grade (e.g. "B-")
  newGrade?: string;     // new grade (e.g. "B+")
  x: number;             // starting x position (from turn)
  y: number;             // starting y position (from turn)
}

export function FlyingChip({ event, onEnd }: { event: GamificationEvent; onEnd: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!ref.current) return;

    // Calculate target position (the rubric row for this dimension)
    // This is approximate; in a real implementation, we'd measure the rubric row's position
    const targetY = window.innerHeight * 0.65; // Rough position of the brief pane
    const targetX = window.innerWidth * 0.85; // Right side where rubric is

    if (prefersReducedMotion) {
      // Just fade in and out, no movement
      ref.current.style.animation = "none";
      ref.current.style.opacity = "1";
      setTimeout(() => onEnd(), 600);
    } else {
      // Animate the chip flying from the turn to the rubric
      const keyframes = `
        @keyframes fly-and-plop {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          70% {
            transform: translate(${targetX - event.x}px, ${targetY - event.y}px) scale(1);
            opacity: 1;
          }
          85% {
            transform: translate(${targetX - event.x}px, ${targetY - event.y}px) scale(0.85);
            opacity: 1;
          }
          100% {
            transform: translate(${targetX - event.x}px, ${targetY - event.y}px) scale(1);
            opacity: 0;
          }
        }
      `;
      const style = document.createElement("style");
      style.textContent = keyframes;
      document.head.appendChild(style);

      ref.current.style.animation = "fly-and-plop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards";
      setTimeout(() => {
        onEnd();
        document.head.removeChild(style);
      }, 1200);
    }
  }, [event, prefersReducedMotion, onEnd]);

  return (
    <div ref={ref} className="pointer-events-none fixed z-50" style={{ left: event.x, top: event.y }}>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-green px-2.5 py-1 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(0,168,112,0.3)]">
        <Sparkles className="h-3 w-3" />
        {event.label}
      </div>
    </div>
  );
}

export function detectGamificationEvents(
  prevGrades: Record<string, string | undefined>,
  newGrades: Record<string, string | undefined>,
  prevBrief: Record<string, string>,
  newBrief: Record<string, string>,
  dims: Array<{ key: string; label: string }>
): Omit<GamificationEvent, "x" | "y">[] {
  const events: Omit<GamificationEvent, "x" | "y">[] = [];
  const gradeOrder: Record<string, number> = { F: 0, "D-": 1, D: 2, "D+": 3, C: 4, "C+": 5, B: 6, "B+": 7, A: 8 };
  const gradeVal = (g?: string) => gradeOrder[g || ""] ?? -1;

  for (const dim of dims) {
    const oldG = prevGrades[dim.key], newG = newGrades[dim.key];
    const oldB = prevBrief[dim.key], newB = newBrief[dim.key];

    // Grade improved
    if (oldG && newG && gradeVal(newG) > gradeVal(oldG)) {
      events.push({
        dim: dim.key,
        label: `+ ${dim.label}`,
        oldGrade: oldG,
        newGrade: newG,
      });
    }
    // Brief filled or sharpened
    else if (!oldB && newB) {
      events.push({
        dim: dim.key,
        label: `+ ${dim.label} stated`,
      });
    } else if (oldB && newB && oldB !== newB && newB.length > oldB.length + 5) {
      events.push({
        dim: dim.key,
        label: `+ ${dim.label} sharpened`,
      });
    }
  }

  // Cap at 3 events, sort by dimension order for consistency
  return events.slice(0, 3).sort((a, b) => {
    const aIdx = dims.findIndex((d) => d.key === a.dim);
    const bIdx = dims.findIndex((d) => d.key === b.dim);
    return aIdx - bIdx;
  });
}
