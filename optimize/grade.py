"""LLM quality grader for a build report.

Materialization ("did a table/app appear") is necessary but not sufficient — this
grades whether what got built is actually GOOD for the idea. It reads the idea, the
moves (the prompts a participant pasted), and what genie reported creating, and
scores a short rubric. This complements human grading of the live app links; an LLM
can't open the SSO-gated app, so it grades move quality, build coherence, and
whether the delivered artifacts serve the idea — and flags what a human should
eyeball in the running app.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server import llm  # noqa: E402

RUBRIC = """You are a senior Databricks SA grading a workshop build produced by an AI coding
agent (Genie Code) from step-by-step "moves". You are given the participant's idea, each move
(the exact instruction pasted), and what the agent reported building, plus which artifacts
actually materialized in the workspace.

Grade this build. Return ONLY a JSON object:
{
  "relevance": <1-5>,        // do the moves + artifacts actually serve THIS idea?
  "move_clarity": <1-5>,     // are the moves clear, self-contained, pasteable by a newcomer?
  "completeness": <1-5>,     // together, do they deliver a usable thing for the idea (not half-built)?
  "data_realism": <1-5>,     // is the sample data plausible/rich enough to make the build feel real?
  "overall": <1-5>,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],           // concrete, specific
  "prompt_fixes": ["..."],                // specific edits to the build-move prompts that would raise the score
  "human_should_check": ["..."]           // what to verify by opening the live app (LLM can't see it)
}
Be a tough grader. 3 = acceptable, 5 = genuinely good. Ground every point in the specifics given."""


def grade_build(report: dict) -> dict:
    moves_txt = "\n\n".join(
        f"MOVE {m['n']} — {m['title']} [{m.get('capability')}]\n"
        f"  concept: {m.get('concept','')}\n"
        f"  move (pasted): {m['move']}\n"
        f"  verify: {m['verify']}\n"
        f"  verdict: {m['verdict']} | new_tables: {m['new_tables']} | "
        f"new_apps: {[a.get('name') for a in m.get('new_apps',[])]}\n"
        f"  agent reported: {(m.get('final') or '(stream cut before final message)')[:400]}"
        for m in report["moves"])
    user = (f"IDEA:\n{report['idea']}\n\n"
            f"CAPABILITIES CHOSEN: {report['capabilities']}\n"
            f"SCORE: {report['pass']}/{report['n_moves']} moves materialized "
            f"(full_build={report['full_build']})\n"
            f"FINAL TABLES: {report['tables_final']}\n\n"
            f"MOVES:\n{moves_txt}\n\nGrade now. JSON only.")
    raw = llm.complete([{"role": "system", "content": RUBRIC},
                        {"role": "user", "content": user}], max_tokens=1200)
    t = raw.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1].lstrip("json").strip() if t.count("```") >= 2 else t.strip("`")
    s, e = t.find("{"), t.rfind("}")
    return json.loads(t[s:e + 1]) if s != -1 else {"error": "unparseable", "raw": raw[:300]}


if __name__ == "__main__":
    rep = json.load(open(sys.argv[1]))
    g = grade_build(rep)
    print(json.dumps(g, indent=2))
