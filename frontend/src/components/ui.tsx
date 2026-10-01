/* Shared primitives so Overview, Learn, Plan and Build speak the Sit-Down's design language:
   DM Sans; four sizes (titles 28/600, lead 18, body 15, labels 12/500 sentence case);
   12px radii; one accent system (grade colours + green for "just changed"). */
import type { ReactNode } from "react";
import { AppWindow, Sparkles } from "lucide-react";
import type { BuildTool } from "../lib/types";

export const Label = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`text-[12px] font-medium text-navy-3 ${className}`}>{children}</div>
);
export const Title = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <h1 className={`text-[28px] font-semibold leading-[1.2] tracking-[-0.01em] text-navy ${className}`}>{children}</h1>
);
export const Lead = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p className={`text-[18px] leading-[1.55] text-navy-2 ${className}`}>{children}</p>
);
export const Card = ({ children, className = "", as: As = "div" }: { children: ReactNode; className?: string; as?: any }) => (
  <As className={`rounded-xl border border-line bg-white ${className}`}>{children}</As>
);

// Where a step happens. Two tools, two distinct badges.
export function ToolBadge({ tool, size = "sm" }: { tool: BuildTool; size?: "sm" | "md" }) {
  const app = tool === "app_builder";
  const pad = size === "md" ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[11.5px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${pad}
      ${app ? "bg-[#e6f2f6] text-[#1f6480]" : "bg-[#e8f7f1] text-[#046a48]"}`}>
      {app ? <AppWindow className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      {app ? "Genie App Builder" : "Genie Code"}
    </span>
  );
}

// A primary action, the ONE obvious next step on a screen.
export const Primary = ({ children, onClick, disabled, className = "" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
  <button onClick={onClick} disabled={disabled}
    className={`inline-flex items-center gap-2 rounded-[10px] bg-navy px-5 py-3 text-[15px] font-semibold text-white transition
      hover:bg-navy-2 disabled:cursor-not-allowed disabled:bg-line-2 ${className}`}>
    {children}
  </button>
);
export const Go = ({ children, onClick, disabled, className = "" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
  <button onClick={onClick} disabled={disabled}
    className={`inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-14px_rgba(0,168,112,.8)]
      transition hover:-translate-y-px hover:bg-green-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${className}`}>
    {children}
  </button>
);
export const Quiet = ({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) => (
  <button onClick={onClick} className={`text-[15px] text-navy-2 underline decoration-line-2 underline-offset-[3px] hover:text-navy ${className}`}>{children}</button>
);
