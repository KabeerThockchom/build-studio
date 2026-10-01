"""The Sit-Down API — the SA pressure-test behind the new Shape stage.

Stateless: the client holds the (small) session state and sends it back each call, so
there is nothing to lose on a reload and nothing to clean up. Every model call streams
NDJSON so the UI can show the SA's reaction the moment it is written:

    {"type": "reaction", "text": "..."}       once, as soon as the reaction field closes
    {"type": "done", "out": {...}, "state": {...}, "model": "...", "ms": 1234}
    {"type": "error", "message": "..."}

Routing: the conversational beats (open, turn) use a fast model; the drafting moments
(shapes, scope, readback) use a stronger one. Both are env-overridable. Chosen by the
bench in optimize/sitdown_eval (Haiku 4.5 + Sonnet 4.6 matched Sonnet 5 at ~2.5x speed).
"""
import json
import os
import re
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import llm, sitdown as sd

router = APIRouter()

FAST = os.environ.get("SITDOWN_FAST_MODEL", "databricks-claude-haiku-4-5")
DRAFT = os.environ.get("SITDOWN_DRAFT_MODEL", "databricks-claude-sonnet-4-6")
ROUTE = {"open": FAST, "turn": FAST, "shapes": DRAFT, "scope": DRAFT, "readback": DRAFT}
MAX_TOKENS = {"open": 1500, "turn": 1500, "shapes": 2000, "scope": 2000, "readback": 2000}
REACTION_OPEN = re.compile(r'"reaction"\s*:\s*"')


def _reaction_feeder():
    r"""Given the growing raw buffer, yield new decoded characters of the `reaction`
    string as they stream in, then signal when the value closes. Real token streaming:
    we decode only the complete prefix, so an in-flight \uXXXX or \" never breaks."""
    st = {"start": None, "emitted": 0, "closed": False}

    def feed(buf: str):
        if st["closed"]:
            return "", True
        if st["start"] is None:
            m = REACTION_OPEN.search(buf)
            if not m:
                return "", False
            st["start"] = m.end()
        i, out, closed = st["start"], [], False
        while i < len(buf):
            ch = buf[i]
            if ch == "\\":
                if i + 1 >= len(buf):
                    break            # dangling escape: wait for more
                out.append(buf[i:i + 2]); i += 2; continue
            if ch == '"':
                closed = True; break
            out.append(ch); i += 1
        try:
            text = json.loads('"' + "".join(out) + '"')
        except Exception:
            return "", False          # mid-escape/unicode: wait
        delta = text[st["emitted"]:]
        st["emitted"] = len(text)
        st["closed"] = closed
        return delta, closed

    return feed


class StepRequest(BaseModel):
    action: str                      # open | turn | shapes | scope | readback | refine_shape
    idea: str = ""                   # open only
    state: dict | None = None        # everything else
    answer: dict | None = None       # turn: {"kind": card|free|pushback_reply|correction, "text": str}
    require_pushback: bool = False
    custom_feature: str = ""         # scope
    mode: str = ""                   # refine_shape: refine | combine | custom
    base: list = []                  # refine_shape: option keys the refine builds on
    note: str = ""                   # refine_shape: participant's words


class ChooseShape(BaseModel):
    state: dict
    key: str


class SetFeatures(BaseModel):
    state: dict
    features: list


def _messages(req: StepRequest, state: dict, ds):
    a = req.action
    if a == "open":
        return sd.open_messages(state, ds)
    if a == "turn":
        return sd.turn_messages(state, ds, req.answer or {"kind": "free", "text": ""}, req.require_pushback)
    if a == "shapes":
        return sd.shapes_messages(state, ds)
    if a == "scope":
        return sd.scope_messages(state, ds, req.custom_feature)
    if a == "readback":
        return sd.readback_messages(state, ds)
    if a == "refine_shape":
        return sd.refine_shape_messages(state, ds, req.mode or "custom", req.base, req.note)
    raise ValueError(f"unknown action {a}")


# refine_shape uses the DRAFT model (it shapes a real build option, like shapes/scope).
ROUTE["refine_shape"] = DRAFT
MAX_TOKENS["refine_shape"] = 2000


def _client_state(state: dict) -> dict:
    return {k: v for k, v in state.items() if k != "history"}


def _stream(req: StepRequest):
    t0 = time.perf_counter()
    try:
        if req.action == "open":
            state = sd.new_state(req.idea)
            state.pop("history", None)
        else:
            state = dict(req.state or {})
        ds = sd.match_dataset(state.get("idea", "") + " " + " ".join((state.get("brief") or {}).values()))
        model = ROUTE[req.action]
        stream = llm.client().chat.completions.create(
            model=model, messages=_messages(req, state, ds),
            max_tokens=MAX_TOKENS[req.action], stream=True)
        buf, feed, react_done = "", _reaction_feeder(), False
        for ev in stream:
            if not ev.choices:
                continue
            piece = llm.text_of(ev.choices[0].delta.content)
            if not piece:
                continue
            buf += piece
            if not react_done:
                delta, react_done = feed(buf)
                if delta:
                    yield json.dumps({"type": "reaction_delta", "text": sd._strip_dashes(delta)}) + "\n"
        out = sd.guard(state, req.action, sd.parse(buf), req.answer, req.require_pushback)
        if not isinstance(out, dict):
            yield json.dumps({"type": "error", "message": "The SA's reply didn't come through cleanly. Try again."}) + "\n"
            return
        if req.action == "refine_shape":
            sd.set_shape(state, out.get("shape"))
        else:
            sd.apply(state, req.action, out, req.answer)
        yield json.dumps({"type": "done", "out": out, "state": _client_state(state), "model": model,
                          "dataset": (ds or {}).get("schema"),
                          "ms": int((time.perf_counter() - t0) * 1000)}) + "\n"
    except Exception as e:  # fail soft: the UI offers a retry
        yield json.dumps({"type": "error", "message": f"{type(e).__name__}: {str(e)[:300]}"}) + "\n"


@router.post("/sitdown/step")
def step(req: StepRequest):
    return StreamingResponse(_stream(req), media_type="application/x-ndjson")


@router.post("/sitdown/choose_shape")
def choose_shape(req: ChooseShape):
    return {"state": _client_state(sd.choose_shape(dict(req.state), req.key))}


@router.post("/sitdown/set_features")
def set_features(req: SetFeatures):
    return {"state": _client_state(sd.set_features(dict(req.state), req.features))}


class ApplyPackage(BaseModel):
    state: dict
    key: str


@router.post("/sitdown/apply_package")
def apply_package(req: ApplyPackage):
    st = sd.apply_package(dict(req.state), req.key)
    return {"state": _client_state(st), "packages": sd.build_packages(st.get("features") or [])["packages"]}


class Handoff(BaseModel):
    state: dict
    readback: dict | None = None


@router.post("/sitdown/handoff")
def handoff(req: Handoff):
    """Finished Sit-Down -> Build Studio state that lands on the Learn step."""
    return {"studio": sd.to_studio(dict(req.state), req.readback or {})}


@router.get("/sitdown/config")
def config():
    return {"fast_model": FAST, "draft_model": DRAFT, "day_capacity": sd.DAY_CAPACITY,
            "blocks": {k: {"effort": v[0], "means": v[1]} for k, v in sd.BLOCKS.items()},
            "dims": [{"key": k, "label": sd.DIM_LABEL[k]} for k in sd.DIMS], "grades": sd.GRADES,
            "stages": sd.STAGES}


# ── Conversational agent (the Sit-Down as a real chat) ────────────────────────
from .. import sitdown_agent as sa  # noqa: E402
from .. import cast as cast_gen  # noqa: E402
import uuid  # noqa: E402

AGENT_MODEL = os.environ.get("SITDOWN_AGENT_MODEL", "databricks-claude-sonnet-5")


class ChatRequest(BaseModel):
    session: dict | None = None      # null on the first message
    text: str                        # what they typed, or the card labels they picked
    meta: dict = {}                  # {picked, shape_key, scope_done, wrap_up, model}


def _merge_cast(st: dict, wait: float = 0.0):
    if st.get("cast") or not st.get("sid") or st.get("cast_failed"):
        return
    got = cast_gen.collect(st["sid"], wait)
    if not got:
        return
    if got.get("failed"):
        st["cast_failed"] = True                  # generic cast stays; never retried mid-session
        return
    st["cast"], st["context"] = got["cast"], got["context"]
    if got.get("unknowns") and not st.get("unknowns"):
        st["unknowns"] = [{**u, "resolved": False} for u in got["unknowns"]]
    if not got["host_business"]:
        st["dataset_schema"] = None               # the host's seeded tables don't fit another business


def _chat_stream(req: ChatRequest):
    t0 = time.perf_counter()
    try:
        st = dict(req.session) if req.session else sa.new_session(req.text)
        meta = req.meta or {}
        if not req.session:                       # first message: cast + context generate in the background
            st["sid"] = uuid.uuid4().hex
            cast_gen.start(st["sid"], req.text)
        _merge_cast(st)                           # pick up a cast that finished since the last turn
        # deterministic UI actions happen in code BEFORE the model speaks
        if meta.get("shape_key"):
            sd.choose_shape(st, meta["shape_key"])
        if meta.get("scope_done") and st.get("stage") == "scope":
            st["stage"] = "readback"
        # Pin the seeded dataset at the start of the session so the context never flips mid-conversation.
        if "dataset_schema" not in st:
            m = sd.match_dataset(st.get("idea", "") + " " + req.text)
            st["dataset_schema"] = (m or {}).get("schema")
        ds = next((d for d in sd.SEEDED_DATASETS if d["schema"] == st["dataset_schema"]), None)
        model = meta.get("model") or AGENT_MODEL
        # Sonnet 5 thinks adaptively by default; for a snappy chat turn we switch it off.
        extra = {"thinking": {"type": "disabled"}} if "sonnet-5" in model or "opus" in model else None
        stream = llm.client().chat.completions.create(
            model=model, messages=sa.messages(st, ds, req.text, meta), tools=sa.tool_specs(),
            max_tokens=2500, stream=True, extra_body=extra)
        text, calls = "", {}
        first = None
        text_ended = False
        for ev in stream:
            if not ev.choices:
                continue
            d = ev.choices[0].delta
            if d.tool_calls and not text_ended:
                text_ended = True                     # prose is complete once tools start
                yield json.dumps({"type": "text_end"}) + "\n"
            piece = llm.text_of(d.content)
            if piece:
                if first is None:
                    first = int((time.perf_counter() - t0) * 1000)
                piece = sd._strip_dashes(piece)
                text += piece
                yield json.dumps({"type": "text_delta", "text": piece}) + "\n"
            for tc in (d.tool_calls or []):
                e = calls.setdefault(tc.index, {"name": "", "args": ""})
                if tc.function and tc.function.name:
                    e["name"] += tc.function.name
                if tc.function and tc.function.arguments:
                    e["args"] += tc.function.arguments
        if not text_ended:
            yield json.dumps({"type": "text_end"}) + "\n"
        parsed, dropped = [], []
        for _, e in sorted(calls.items()):
            try:
                parsed.append({"name": e["name"], "args": json.loads(e["args"] or "{}")})
            except Exception:
                dropped.append({"name": e["name"], "chars": len(e["args"]), "tail": e["args"][-80:]})
        finish = getattr(ev.choices[0], "finish_reason", None) if getattr(ev, "choices", None) else None
        ui, events = sa.apply_tools(st, parsed, meta)
        # Repair: a sharpening turn must end with something to answer. If the model closed out without
        # a question, make one fast forced call for it (only happens on a few percent of turns).
        if st.get("stage") in sa.CONVO_DIMS and not any(u["type"] in ("options", "stakeholder", "drift", "shapes", "open") for u in ui):
            try:
                rep = llm.client().chat.completions.create(
                    model=model, max_tokens=600, extra_body=extra,
                    messages=sa.repair_messages(st, ds, text), tools=sa.tool_specs(),
                    tool_choice={"type": "function", "function": {"name": "present_options"}})
                tcs = rep.choices[0].message.tool_calls or []
                more = [{"name": tc.function.name, "args": json.loads(tc.function.arguments or "{}")} for tc in tcs]
                ui2, _ = sa.apply_tools(st, more, {"repair": True})
                ui += ui2
                parsed += more
            except Exception:
                pass
        sa.remember(st, req.text, text, parsed)
        _merge_cast(st, wait=0.0)                 # ready by the end of the opening reply, or picked up next turn
        yield json.dumps({"type": "done", "ui": ui, "events": events, "session": st, "model": model,
                          "debug": {"tools": [c["name"] for c in parsed], "dropped": dropped, "finish": finish,
                                    "raw": {c["name"]: str(c["args"])[:300] for c in parsed
                                            if c["name"] in ("present_options", "offer_shapes", "stakeholder")}},
                          "first_ms": first, "ms": int((time.perf_counter() - t0) * 1000),
                          "dataset": (ds or {}).get("schema")}) + "\n"
    except Exception as e:
        yield json.dumps({"type": "error", "message": f"{type(e).__name__}: {str(e)[:300]}"}) + "\n"


@router.post("/sitdown/chat")
def chat(req: ChatRequest):
    return StreamingResponse(_chat_stream(req), media_type="application/x-ndjson")
