import { useEffect, useRef, useState } from "react";

const reduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Animate a number from 0 → `value` on mount / when value changes.
 * Non-numeric values (e.g. "₹12.00", "Yes") pass straight through.
 */
export function useCountUp(
  value: number | string,
  { duration = 900 }: { duration?: number } = {},
): string {
  const isNumeric = typeof value === "number" && isFinite(value);
  const [display, setDisplay] = useState<number>(isNumeric ? 0 : NaN);
  const frame = useRef<number>();

  useEffect(() => {
    if (!isNumeric || reduced) return;
    const target = value as number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(target * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else setDisplay(target);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, isNumeric]);

  if (!isNumeric) return String(value);
  if (reduced) return formatNum(value as number);
  return formatNum(display);
}

function formatNum(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString()
    : Math.round(n).toLocaleString();
}
