import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTilt } from "../lib/fx";

/** A router Link that gently tilts toward the cursor in 3D with a light sheen. */
export default function TiltLink({
  to,
  className = "",
  children,
  max = 7,
}: {
  to: string;
  className?: string;
  children: ReactNode;
  max?: number;
}) {
  const ref = useTilt<HTMLAnchorElement>(max);
  return (
    <Link to={to} ref={ref} className={`tilt ${className}`}>
      {children}
    </Link>
  );
}
