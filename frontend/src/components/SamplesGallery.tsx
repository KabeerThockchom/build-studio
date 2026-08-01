import { useState } from "react";
import { Sparkles, ChevronDown, ArrowUpRight } from "lucide-react";
import { GALLERY } from "../lib/gallery";

/* Progressive-disclosure samples gallery for the Shape screen. Collapsed by
   default (just an affordance beside the idea box); expands to an outcome-map
   grid — verticals as tabs, each a set of outcome-grouped columns of sample
   apps. Picking a card SEEDS the idea box with an editable starter sentence and
   silently records the vertical's industry for the SA prompt. It seeds; it does
   not hijack — the user can edit freely afterward. */

interface Props {
  onPick: (idea: string, industry: string) => void;
}

export function SamplesGallery({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [vert, setVert] = useState(GALLERY[0].id);
  const active = GALLERY.find((v) => v.id === vert) ?? GALLERY[0];

  return (
    <div className="mt-5">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[13.5px] font-semibold text-green-ink hover:text-green">
        <Sparkles className="h-4 w-4" />
        Need inspiration? See what people build
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="rise mt-4 rounded-2xl border border-line bg-white p-5">
          {/* vertical tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {GALLERY.map((v) => (
              <button key={v.id} onClick={() => setVert(v.id)}
                className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors
                  ${v.id === vert ? "border-navy bg-navy text-white" : "border-line bg-white text-navy-2 hover:border-navy-3"}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* outcome-map: one column per business outcome */}
          <div className="grid grid-cols-3 gap-3.5">
            {active.columns.map((col) => (
              <div key={col.outcome}>
                <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-green-ink">{col.outcome}</div>
                <div className="flex flex-col gap-2">
                  {col.apps.map((app) => (
                    <button key={app.id} onClick={() => onPick(app.starter, active.industry)}
                      className="group rounded-xl border border-line bg-oat/40 px-3.5 py-3 text-left transition-colors hover:border-green hover:bg-green-soft">
                      <div className="flex items-start justify-between gap-2">
                        <b className="text-[13.5px] font-semibold leading-tight text-navy">{app.label}</b>
                        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-line-2 group-hover:text-green" />
                      </div>
                      <p className="mt-1 text-[12px] leading-snug text-navy-3">{app.blurb}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[12px] text-navy-3">
            Pick one to start from it — we'll drop it into the box above, yours to edit.
          </p>
        </div>
      )}
    </div>
  );
}
