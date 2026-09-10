import { useEffect, useRef } from "react";

export const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Cursor-follow 3D tilt for cards. Attach the returned ref to the element.
 * No-op under prefers-reduced-motion or on touch devices.
 */
export function useTilt<T extends HTMLElement>(max = 8) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion || window.matchMedia("(pointer: coarse)").matches)
      return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(700px) rotateX(${(-py * max).toFixed(
          2,
        )}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-3px)`;
        el.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
      });
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      cancelAnimationFrame(raf);
    };
  }, [max]);

  return ref;
}

/** Lightweight confetti burst — pure DOM, no dependency. */
export function confetti(originX = 0.5, originY = 0.4) {
  if (reducedMotion) return;
  const colors = ["#0e5b6b", "#6d43c8", "#3aa6b9", "#e3ad5b", "#1f7a4d"];
  const n = 90;
  const root = document.createElement("div");
  root.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(root);

  const ox = window.innerWidth * originX;
  const oy = window.innerHeight * originY;

  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const vel = 6 + Math.random() * 9;
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${size}px;height:${
      size * (0.4 + Math.random())
    }px;background:${colors[i % colors.length]};border-radius:${
      Math.random() > 0.5 ? "50%" : "2px"
    };will-change:transform,opacity`;
    root.appendChild(p);

    const dx = Math.cos(angle) * vel * 14;
    const dy = Math.sin(angle) * vel * 14 - 120;
    const rot = (Math.random() - 0.5) * 720;
    p.animate(
      [
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy + 300}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 1100 + Math.random() * 700,
        easing: "cubic-bezier(.2,.6,.35,1)",
        fill: "forwards",
      },
    );
  }
  setTimeout(() => root.remove(), 2200);
}
