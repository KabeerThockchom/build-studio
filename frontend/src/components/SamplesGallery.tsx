import { useState } from "react";
import { Sparkles, ArrowUpRight, X } from "lucide-react";
import { GALLERY, interestsForComponents, type SampleApp } from "../lib/gallery";

/* Samples gallery for the Shape screen. A teaser row of representative sample
   apps is ALWAYS visible (discoverable without a click); "see all" expands the
   full per-vertical outcome map. Picking any card SEEDS the idea box with an
   editable starter and silently records the vertical's industry for the SA
   prompt. It seeds; it does not hijack — the user edits freely afterward. */

interface Props {
  onPick: (idea: string, name: string, industry: string, components: string[], interests: string[]) => void;
}

// One representative card per vertical for the always-on teaser row.
const FEATURED: { app: SampleApp; industry: string }[] = GALLERY.map((v) => ({
  app: v.columns[0].apps[0],
  industry: v.industry,
}));

export function SamplesGallery({ onPick }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [vert, setVert] = useState(GALLERY[0].id);
  const active = GALLERY.find((v) => v.id === vert) ?? GALLERY[0];

  return (
    <div className="mt-7">
      <div className="mb-3 flex items-end justify-between">
        <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-navy-3">
          <Sparkles className="h-4 w-4 text-green" /> Or start from an example
        </div>
        <button onClick={() => setShowAll((s) => !s)}
          className="text-[13px] font-bold text-green-ink hover:text-green">
          {showAll ? "Show fewer" : "See all examples →"}
        </button>
      </div>

      {/* always-visible teaser row: one card per vertical */}
      {!showAll && (
        <div className="grid grid-cols-3 gap-3">
          {FEATURED.map(({ app, industry }, i) => (
            <SampleCard key={app.id} app={app} tag={GALLERY[i].label}
              onClick={() => onPick(app.starter, app.label, industry, app.components, interestsForComponents(app.components))} />
          ))}
        </div>
      )}

      {/* expanded: full per-vertical outcome map */}
      {showAll && (
        <div className="rise rounded-2xl border border-line bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {GALLERY.map((v) => (
                <button key={v.id} onClick={() => setVert(v.id)}
                  className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors
                    ${v.id === vert ? "border-navy bg-navy text-white" : "border-line bg-white text-navy-2 hover:border-navy-3"}`}>
                  {v.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAll(false)} className="text-navy-3 hover:text-navy" aria-label="Collapse examples">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3.5 items-start">
            {active.columns.map((col) => (
              <div key={col.outcome}>
                <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-green-ink">{col.outcome}</div>
                <div className="flex flex-col gap-2">
                  {col.apps.map((app) => (
                    // Collapse the expanded panel on pick so the page shrinks back and the
                    // now-filled form is in view (the parent also scrolls + highlights it).
                    <SampleCard key={app.id} app={app} detailed onClick={() => { setShowAll(false); onPick(app.starter, app.label, active.industry, app.components, interestsForComponents(app.components)); }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[12px] text-navy-3">
            Each shows the same four things a good idea covers: problem, how, tool, objective. Pick one to start from it, yours to edit.
          </p>
        </div>
      )}
    </div>
  );
}

function SampleCard({ app, tag, detailed, onClick }: { app: SampleApp; tag?: string; detailed?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="group flex h-full flex-col rounded-xl border border-line bg-white px-3.5 py-3 text-left transition-all hover:-translate-y-px hover:border-green hover:bg-green-soft hover:shadow-[0_6px_18px_rgba(0,168,112,0.1)]">
      {tag && <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-navy-3">{tag}</div>}
      <div className="flex items-start justify-between gap-2">
        <b className="text-[13.5px] font-semibold leading-tight text-navy">{app.label}</b>
        <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-line-2 group-hover:text-green" />
      </div>
      <p className="mt-1 text-[12px] leading-snug text-navy-3">{app.blurb}</p>
      {detailed && app.facets && (
        <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
          {([["Problem", app.facets.problem], ["How", app.facets.how], ["Tool", app.facets.tool], ["Objective", app.facets.objective]] as const).map(([label, v]) => (
            <div key={label} className="text-[10.5px] leading-snug">
              <span className="font-bold uppercase tracking-[0.04em] text-navy-3">{label}</span>{" "}
              <span className="text-navy-2">{v}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
