/* One page of the chat: the participant's words (a quiet "You" line that becomes the page's
   opener), the SA's voice, the inline brief confirm, and the turn's ui items. The voice is
   written by the streamer straight into the DOM (append-only) while it is live; history and
   resumed turns render their text statically. */
import { memo } from "react";
import { arr, noDash, dimLabel, RM } from "./engine";
import {
  OptionsItem, OpenItem, StakeholderItem, DriftItem, ShapesItem, ScopeItem, CeremonyItem,
  type SendFn, type ScopeOps, type CeremonyOps,
} from "./Items";

export interface NoteLine { kind: string; dim: string; }
export interface TurnData {
  id: string;
  you: string;
  text: string;
  ui: any[];
  events: any[];
  req?: { text: string; meta: Record<string, unknown> };
  sessBefore: any;
  dispBefore: any;
  stage?: string;
  note?: NoteLine[];
  stats?: Record<string, unknown>;
  // transient, never persisted
  _live?: boolean;       // its voice is being streamed in this mount
  _ready?: boolean;      // the words finished: show the ui items
  _fresh?: boolean;      // the items were just revealed (stagger them in)
  _pend?: string;        // a quiet pending cue between the words and the items
  _err?: string;         // the call failed
}

interface Props {
  turn: TurnData;
  index: number;
  last: boolean;
  minH?: number;
  busy: boolean;
  thinking: boolean;     // breathing avatar (thinking lives in the header too)
  north: string;
  voiceRef?: (el: HTMLDivElement | null) => void;
  onSend: SendFn;
  onEdit: (i: number) => void;
  onRetry: () => void;
  scope: ScopeOps;
  ceremony: CeremonyOps;
}

function UiItems({ turn, live, onSend, north, scope, ceremony }: { turn: TurnData; live: boolean; onSend: SendFn; north: string; scope: ScopeOps; ceremony: CeremonyOps }) {
  const fresh = !!turn._fresh && !RM;
  let base = 0;
  return (
    <>
      {arr(turn.ui).map((it, i) => {
        if (!it || typeof it !== "object" || !it.type) { console.warn("sitdown: skipping malformed ui item", it); return null; }
        let node: JSX.Element | null = null;
        const b = base;
        try {
          if (it.type === "options" && arr(it.options).length) { node = <OptionsItem it={it} live={live} fresh={fresh} onSend={onSend} base={b} />; base += 4; }
          else if ((it.type === "stakeholder" || it.type === "pushback") && it.line) node = <StakeholderItem it={it} live={live} fresh={fresh} onSend={onSend} />;
          else if (it.type === "open" && typeof it.question === "string" && it.question.trim()) node = <OpenItem it={it} />;
          else if (it.type === "drift") node = <DriftItem it={it} live={live} onSend={onSend} north={north} />;
          else if (it.type === "shapes" && arr(it.shapes).some((x) => x && typeof x === "object")) { node = <ShapesItem it={it} live={live} fresh={fresh} onSend={onSend} base={b} />; base += 4; }
          else if (it.type === "scope" && (arr(it.packages).length || arr(it.features).length)) { node = <ScopeItem it={it} live={live} fresh={fresh} ops={scope} base={b} />; base += 4; }
          else if (it.type === "readback") node = <CeremonyItem it={it} live={live} ops={ceremony} />;
          else console.warn("sitdown: unknown or empty ui item", it.type);
        } catch (e) { console.warn("sitdown: ui item failed to render, skipped", it.type, e); node = null; }
        if (!node) return null;
        const d = b * 70;
        return <div key={i} className={`uiw ${fresh ? "in" : ""}`} style={fresh ? { animationDelay: `${d}ms` } : undefined}>{node}</div>;
      })}
    </>
  );
}

function TurnBlockInner({ turn, index, last, minH, busy, thinking, north, voiceRef, onSend, onEdit, onRetry, scope, ceremony }: Props) {
  const live = last && !busy && !turn._err;
  const showUi = !turn._live || turn._ready;
  return (
    <div className={`blk ${last ? "" : "past"}`} style={last && minH ? { minHeight: minH } : undefined} data-turn={index}>
      {turn.you && (
        <div className="yrow">
          <button className="yedit" title="Edit this and continue from here" onClick={() => !busy && onEdit(index)}>Edit</button>
          <div className="you"><span className="yl">You</span>{noDash(turn.you)}</div>
        </div>
      )}
      <div className="vrow voiceRow">
        <div className={`av ${thinking ? "breathe" : ""}`}>SA</div>
        <div>
          <div className="who">Your SA</div>
          <div className="voiceBox">
            {/* keyed so a live (streamed, imperative) voice is swapped for a fresh static one, never mixed */}
            <div key={turn._live ? "live" : "static"} className="voiceT" ref={voiceRef}>{turn._live ? null : noDash(turn.text)}</div>
          </div>
        </div>
      </div>
      <div className={`note ${turn.note?.length ? "nb" : ""}`}>
        {(turn.note || []).map((l, i) => (
          <span key={i} className="ln">
            {l.kind === "brief_updated" ? <>Updated <b>{dimLabel(l.dim)}</b> in your brief</> : <>Added to your brief: <b>{dimLabel(l.dim)}</b></>}
            {last && <span className="arr">→</span>}
          </span>
        ))}
      </div>
      <div className="ask">
        {turn._err ? (
          <>
            <div className="errnote">{turn._err}</div>
            <div className="crow"><button className="cbtn" onClick={onRetry}>Retry</button></div>
          </>
        ) : showUi ? (
          <UiItems turn={turn} live={live} onSend={onSend} north={north} scope={scope} ceremony={ceremony} />
        ) : turn._pend ? (
          <div className="pend" aria-label={turn._pend}><i /><i /><i /></div>
        ) : null}
      </div>
    </div>
  );
}
export const TurnBlock = memo(TurnBlockInner);
