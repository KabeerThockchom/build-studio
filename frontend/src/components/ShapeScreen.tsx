import type { StudioState } from "../lib/store";
import { EXPERTISE, INTERESTS } from "../lib/constants";
import { SamplesGallery } from "./SamplesGallery";

interface Props {
  state: StudioState;
  onIdea: (v: string) => void;
  onPickSample: (idea: string, industry: string, components: string[]) => void;
  onExpertise: (v: string) => void;
  onToggleInterest: (v: string) => void;
  onNext: () => void;
}

export function ShapeScreen({ state, onIdea, onPickSample, onExpertise, onToggleInterest, onNext }: Props) {
  return (
    <div className="rise max-w-[1080px]">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.14em] text-green">Vibe to Value</div>
      <h1 className="mb-3 text-[42px] font-extrabold leading-[1.04] tracking-[-0.03em] text-navy">What do you want to build?</h1>
      <p className="mb-7 max-w-[56ch] text-[16.5px] leading-relaxed text-navy-2">
        Describe it in a few sentences, in your own words. The more you tell us about the problem and who it helps, the better we can shape it with you.
      </p>

      {/* Inputs grouped on the left, guidance on the right — one consistent divide. */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-8 items-start">
        <div className="flex flex-col gap-6">
          <textarea
            value={state.idea} onChange={(e) => onIdea(e.target.value)}
            placeholder={"Start typing…\n\nWhat's the problem? Who runs into it? What would a good outcome look like?"}
            className="min-h-[180px] w-full resize-none rounded-2xl border-[1.5px] border-line bg-white px-6 py-5 text-[17px] leading-[1.55] text-navy outline-none focus:border-green focus:ring-4 focus:ring-green-soft"
          />
          <div>
            <div className="text-[13px] font-bold text-navy">How much Databricks do you know?</div>
            <div className="mb-[11px] text-[12.5px] text-navy-3">Tunes how much we explain as we go.</div>
            <div className="flex flex-wrap gap-2">
              {EXPERTISE.map((e) => (
                <button key={e} onClick={() => onExpertise(e)}
                  className={`rounded-full border-[1.5px] px-4 py-2 text-[14px] font-semibold transition-colors
                    ${state.expertise === e ? "border-navy bg-navy text-white" : "border-line bg-white text-navy-2 hover:border-navy-3"}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[13px] font-bold text-navy">Interested in anything specific?</div>
            <div className="mb-[11px] text-[12.5px] text-navy-3">Optional. Shapes what we surface, not a filter.</div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((it) => (
                <button key={it} onClick={() => onToggleInterest(it)}
                  className={`rounded-full border-[1.5px] px-4 py-2 text-[14px] font-semibold transition-colors
                    ${state.interests.includes(it) ? "border-green bg-green text-white" : "border-line bg-white text-navy-2 hover:border-navy-3"}`}>{it}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white px-[22px] py-5">
          <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-navy-3">A good description covers</div>
          <ul className="flex flex-col gap-[11px]">
            {["The problem you're trying to solve", "Who would use it, and when", "What data or knowledge it draws on", "What a good result looks like"].map((t) => (
              <li key={t} className="relative pl-[22px] text-[14px] leading-tight text-navy-2">
                <span className="absolute left-0 top-[7px] h-[7px] w-[7px] rounded-full bg-green" />{t}
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-[15px] text-[13px] italic leading-relaxed text-navy-3">
            "Our reps manage 80 accounts each and only notice one is slipping once orders drop. I want something that catches the early signs and tells them what to do about it."
          </div>
        </div>
      </div>

      <SamplesGallery onPick={onPickSample} />

      <div className="mt-9 flex justify-end">
        <button onClick={onNext} disabled={state.idea.trim().length < 12}
          className="rounded-xl bg-green px-7 py-3.5 text-[15.5px] font-bold text-white transition-transform hover:-translate-y-px hover:bg-green-l disabled:opacity-40 disabled:hover:translate-y-0">
          Start designing →
        </button>
      </div>
    </div>
  );
}
