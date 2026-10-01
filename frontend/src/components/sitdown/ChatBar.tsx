/* The persistent chat bar: always there for an open answer ("it's a combination of two of
   these", "I hadn't thought of it like that"). Enter sends, Shift+Enter is a new line. When the
   SA asks something only the participant can answer, it glows softly and takes focus. */
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: (v: string) => void;
  enabled: boolean;          // a session exists, nothing streaming, no tour
  started: boolean;
  askme: string | null;      // an open question's hint: the bar is the obvious next action
  wrapUp: boolean;           // show the quick finish
  onWrapUp: () => void;
  focusNonce: number;        // bump to pull focus (Back / Edit)
}

export function ChatBar({ value, onChange, onSend, enabled, started, askme, wrapUp, onWrapUp, focusNonce }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const grow = () => { const t = ta.current; if (!t) return; t.style.height = "auto"; t.style.height = Math.min(120, t.scrollHeight) + "px"; };
  useEffect(grow, [value]);
  useEffect(() => {
    if (askme && enabled) { const t = setTimeout(() => ta.current?.focus({ preventScroll: true }), 420); return () => clearTimeout(t); }
  }, [askme, enabled]);
  useEffect(() => {
    if (!focusNonce || !ta.current) return;
    const t = ta.current; t.focus({ preventScroll: true }); t.setSelectionRange(t.value.length, t.value.length);
  }, [focusNonce]);
  const send = () => { const v = value.trim(); if (!v || !enabled) return; onSend(v); };
  const placeholder = !started ? "Start with your idea above" : askme || "Say it your way, or tell me what I'm missing…";
  return (
    <div className={`chatbar ${askme ? "askme" : ""}`}>
      {wrapUp && <button className="wrapup" onClick={onWrapUp}>I'm ready to see how to build it →</button>}
      <textarea ref={ta} className="cin" rows={1} value={value} disabled={!enabled} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
      <button className="csend" disabled={!enabled || !value.trim()} onClick={send}>Send</button>
    </div>
  );
}
