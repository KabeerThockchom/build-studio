"""Run the baseline suite: every case end-to-end through Genie Code, keep the
artifacts alive (so app links work for human grading), LLM-grade each build, and
write a scorecard (markdown + json) with the idea, the exact moves, the live app
link, and both the materialization verdict and the quality grade per case.

  DATABRICKS_PROFILE=build-studio uv run --with-requirements requirements.txt \
    python optimize/run_suite.py            # all cases
    python optimize/run_suite.py ka_app lakebase_app   # subset
"""
import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from optimize.run_build import CASES, run_case  # noqa: E402
from optimize.grade import grade_build  # noqa: E402

OUT_DIR = "/tmp/genie-eval/suite"


def main(cases):
    os.makedirs(OUT_DIR, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    reports = []
    for key in cases:
        print(f"\n{'='*70}\nCASE: {key}\n{'='*70}")
        try:
            rep = run_case(key, keep=True)  # keep artifacts alive for grading
            try:
                rep["grade"] = grade_build(rep)
            except Exception as e:
                rep["grade"] = {"error": f"grade failed: {e}"}
            reports.append(rep)
        except Exception as e:
            print(f"  CASE ERRORED: {e}")
            reports.append({"case": key, "error": str(e),
                            "traceback": traceback.format_exc()[-800:]})
        # persist after each case so a mid-suite crash still leaves partial results
        json.dump(reports, open(f"{OUT_DIR}/suite-{stamp}.json", "w"), indent=2)

    write_scorecard(reports, f"{OUT_DIR}/SCORECARD-{stamp}.md")
    print(f"\n\nSCORECARD: {OUT_DIR}/SCORECARD-{stamp}.md")
    print(f"RAW JSON:  {OUT_DIR}/suite-{stamp}.json")


def write_scorecard(reports, path):
    L = ["# Build Studio × Genie Code — baseline scorecard", ""]
    # summary table
    L += ["| Case | Build | Moves passed | Overall grade |", "|---|---|---|---|"]
    for r in reports:
        if "error" in r and "moves" not in r:
            L.append(f"| {r['case']} | ERROR | — | — |")
            continue
        g = r.get("grade", {})
        overall = g.get("overall", "?")
        full = "✓ full" if r.get("full_build") else f"{r.get('pass',0)}/{r.get('n_moves','?')}"
        L.append(f"| {r['case']} | {full} | {r.get('pass',0)}/{r.get('n_moves','?')} | {overall}/5 |")
    L.append("")

    for r in reports:
        L.append(f"\n## {r['case']}")
        if "error" in r and "moves" not in r:
            L.append(f"\n**ERRORED:** {r['error']}\n```\n{r.get('traceback','')}\n```")
            continue
        L.append(f"\n**Idea:** {r['idea']}")
        L.append(f"\n**Capabilities:** {', '.join(r['capabilities'])}")
        # live app links (for human grading)
        app_links = []
        for m in r["moves"]:
            for a in m.get("new_apps", []):
                if a.get("url"):
                    app_links.append(f"[{a['name']}]({a['url']}) ({a.get('state')})")
        if app_links:
            L.append(f"\n**🔗 Live app(s) to grade:** {', '.join(app_links)}")
        L.append(f"\n**Tables built:** `{r.get('tables_final')}`  ·  **Schema:** `{r.get('schema')}`")

        g = r.get("grade", {})
        if "error" not in g:
            L.append(f"\n**Quality grade** — overall **{g.get('overall','?')}/5** "
                     f"(relevance {g.get('relevance','?')}, clarity {g.get('move_clarity','?')}, "
                     f"completeness {g.get('completeness','?')}, data-realism {g.get('data_realism','?')})")
            if g.get("strengths"):
                L.append("- Strengths: " + "; ".join(g["strengths"]))
            if g.get("weaknesses"):
                L.append("- Weaknesses: " + "; ".join(g["weaknesses"]))
            if g.get("prompt_fixes"):
                L.append("- **Prompt fixes:** " + "; ".join(g["prompt_fixes"]))
            if g.get("human_should_check"):
                L.append("- **You should check in the app:** " + "; ".join(g["human_should_check"]))
        else:
            L.append(f"\n_grade unavailable: {g.get('error')}_")

        # the exact moves (the prompts) — for human grading
        L.append("\n<details><summary>Moves (the exact prompts pasted into Genie Code)</summary>\n")
        for m in r["moves"]:
            L.append(f"\n**Move {m['n']} — {m['title']}** [{m.get('capability')}] → **{m['verdict']}**")
            L.append(f"> {m['move']}")
            L.append(f"\n_verify:_ {m['verify']}  ·  _agent reported:_ "
                     f"{(m.get('final') or '(stream cut)')[:200]}")
        L.append("\n</details>")

    open(path, "w").write("\n".join(L))


if __name__ == "__main__":
    cases = sys.argv[1:] or list(CASES)
    bad = [c for c in cases if c not in CASES]
    if bad:
        print(f"unknown cases: {bad}; valid: {list(CASES)}"); sys.exit(1)
    main(cases)
