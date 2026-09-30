"""Drive the Genie Code CLI headlessly as an execution oracle for Build Studio moves.

This is the closed-loop piece we were missing: our Build phase emits "moves"
(plain-language instructions a workshop participant pastes into Genie Code). Here
we actually RUN each move through the Genie Code CLI against a real workspace and
observe what it produced, so we can measure and then optimize the move prompts.

Notes / hard-won setup (see the session that built this):
  - The local `genie` is wired to the `ai_devtools` workspace (its AI Gateway model
    lives there), so we run the eval builds there too, in a scratch schema.
  - genie's exec sandbox blocks network and its approval reviewer mandates the
    configured profile. We run the PERMITTED mode: `--approve-for-me` +
    `sandbox_workspace_write.network_access=true`, and inject a freshly-minted
    token as env (DATABRICKS_*), because genie's sandboxed subshell can't read the
    macOS keyring when spawned headlessly.
  - genie keeps its own deterministic safeguards (no destructive SQL / deletes),
    so the loop can't nuke data; we clean up scratch schemas with our own CLI.
"""
import json
import os
import subprocess

GENIE = os.path.expanduser("~/.local/bin/genie")
DBX = "/opt/homebrew/bin/databricks"
# Eval workspace = build-studio (a throwaway FEVM Azure sandbox we admin; has the
# build_studio catalog we own). genie's MODEL still runs on the ai_devtools AI
# Gateway (its own config) — we only retarget genie's Databricks TOOL ops here by
# injecting this workspace's token + overriding databricks_profile.
PROFILE = os.environ.get("GENIE_EVAL_PROFILE", "build-studio")
HOST = os.environ.get("GENIE_EVAL_HOST", "https://adb-7405615677967120.0.azuredatabricks.net")


def mint_token() -> str:
    out = subprocess.run([DBX, "auth", "token", "--profile", PROFILE],
                         capture_output=True, text=True, timeout=40)
    if out.returncode != 0:
        raise RuntimeError(f"token mint failed: {out.stderr[:200]}")
    return json.loads(out.stdout)["access_token"]


def _env(token: str) -> dict:
    return {**os.environ,
            "PATH": os.path.expanduser("~/.local/bin") + ":" + os.environ.get("PATH", ""),
            "DATABRICKS_HOST": HOST,
            "DATABRICKS_TOKEN": token,
            "DATABRICKS_CONFIG_PROFILE": PROFILE}


def _session_id_from_events(events_path: str) -> str | None:
    """Pull the session id out of the JSONL event stream (best-effort across shapes)."""
    if not os.path.exists(events_path):
        return None
    try:
        for line in open(events_path):
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except Exception:
                continue
            for key in ("session_id", "sessionId", "conversation_id", "thread_id"):
                v = e.get(key) if isinstance(e, dict) else None
                if v:
                    return v
            msg = e.get("msg") if isinstance(e, dict) else None
            if isinstance(msg, dict):
                for key in ("session_id", "sessionId", "conversation_id"):
                    if msg.get(key):
                        return msg[key]
    except Exception:
        pass
    return None


def run_move(prompt: str, workdir: str, session_id: str | None = None, timeout: int = 420) -> dict:
    """Run one genie exec (fresh session, or `resume` an existing one).

    Returns: { ok, session_id, final, events_path, returncode, timed_out }.
    """
    os.makedirs(workdir, exist_ok=True)
    token = mint_token()
    tag = f"m{len([f for f in os.listdir(workdir) if f.startswith('events_')]) + 1}"
    out_file = os.path.join(workdir, f"last_{tag}.txt")
    events_file = os.path.join(workdir, f"events_{tag}.jsonl")

    base = [GENIE, "exec", "--skip-git-repo-check", "--approve-for-me",
            "-c", "shell_environment_policy.inherit=all",
            "-c", "sandbox_workspace_write.network_access=true",
            "-c", f"databricks_profile={PROFILE}",
            "--json", "-o", out_file]
    cmd = base + (["resume", session_id, prompt] if session_id else [prompt])

    timed_out = False
    with open(events_file, "w") as ev:
        try:
            p = subprocess.run(cmd, cwd=workdir, stdin=subprocess.DEVNULL,
                               stdout=ev, stderr=subprocess.STDOUT,
                               env=_env(token), timeout=timeout)
            rc = p.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
            rc = -1

    final = open(out_file).read().strip() if os.path.exists(out_file) else ""
    sid = session_id or _session_id_from_events(events_file)
    return {"ok": rc == 0 and not timed_out, "session_id": sid, "final": final,
            "events_path": events_file, "returncode": rc, "timed_out": timed_out}


if __name__ == "__main__":
    # Smoke: start a session, then resume it, proving state carries across moves.
    import tempfile
    wd = tempfile.mkdtemp(prefix="genie-eval-")
    print("workdir:", wd)
    r1 = run_move("Remember the secret word BUILDSTUDIO. Reply 'stored'.", wd, timeout=180)
    print("run1 ok=%s sid=%s final=%r" % (r1["ok"], r1["session_id"], r1["final"][:80]))
    if r1["session_id"]:
        r2 = run_move("What was the secret word? Reply with just the word.", wd,
                      session_id=r1["session_id"], timeout=180)
        print("run2 ok=%s final=%r" % (r2["ok"], r2["final"][:80]))
    else:
        print("no session id parsed — will need to inspect events shape")
