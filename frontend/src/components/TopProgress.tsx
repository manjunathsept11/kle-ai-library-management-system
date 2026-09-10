import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/** Thin animated progress bar that runs on every route change. */
export default function TopProgress() {
  const loc = useLocation();
  const [state, setState] = useState<"idle" | "run" | "done">("idle");

  useEffect(() => {
    setState("run");
    const a = setTimeout(() => setState("done"), 380);
    const b = setTimeout(() => setState("idle"), 700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [loc.pathname]);

  if (state === "idle") return null;
  return (
    <div className={`topprogress ${state}`}>
      <span />
    </div>
  );
}
