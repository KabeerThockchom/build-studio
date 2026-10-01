"""One controlled, headless end-to-end walk of Build Studio v2 (a card-clicking participant).

    python -m optimize.e2e_walk --idea "..." --tag pov [--refine "..."]

One browser, always closed. Screenshots to docs/v2-review/screens/e2e-<tag>-NN-*.png; a JSON log of
what happened at each step (and any page errors) is printed at the end.
"""
import argparse
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "http://localhost:8000/"
OUT = Path(__file__).resolve().parents[1] / "docs" / "v2-review" / "screens"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--idea", required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--refine", default="")
    ap.add_argument("--max-turns", type=int, default=28)
    a = ap.parse_args()
    log, errors, n = [], [], [0]

    def shot(page, name):
        n[0] += 1
        p = OUT / f"e2e-{a.tag}-{n[0]:02d}-{name}.png"
        page.screenshot(path=str(p), full_page=False)
        log.append({"shot": p.name, "t": round(time.time() - t0, 1)})

    t0 = time.time()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("pageerror", lambda e: errors.append(str(e)[:200]))
            page.on("console", lambda m: m.type == "error" and errors.append("console: " + m.text[:200]))
            page.add_init_script("localStorage.clear()")
            page.goto(BASE)
            page.get_by_role("button", name="Pull up a chair").first.click()
            page.locator("textarea.idea").fill(a.idea)
            page.locator(".crow .cbtn", has_text="Pull up a chair").click()
            t1 = time.time()
            page.wait_for_timeout(1200)
            shot(page, "first-wait")
            page.locator(".voiceT").last.wait_for(timeout=30000)
            log.append({"first_words_s": round(time.time() - t1, 1)})
            page.wait_for_timeout(1500)
            shot(page, "tour-step1")
            for _ in range(8):                                  # walk the tour; it must never be empty
                tn = page.locator(".tn")
                if not tn.count():
                    break
                txt = page.locator(".tour, .tt, [class*=tour]").first.inner_text() if page.locator(".tour, .tt, [class*=tour]").count() else ""
                log.append({"tour_text": txt[:80]})
                tn.first.click()
                page.wait_for_timeout(700)

            stage_shots = set()
            idle = 0
            for turn in range(a.max_turns * 3):
                # wait until the latest block has something live to answer
                try:
                    page.wait_for_function("""() => [...document.querySelectorAll('.cbtn')].some(b => !b.disabled)
                        || document.querySelector('.opt:not([disabled])')""", timeout=90000)
                except PWTimeout:
                    log.append({"stuck_turn": turn}); shot(page, "stuck"); break
                page.wait_for_timeout(900)
                if page.locator(".tn").count():
                    page.locator(".tk").first.click()
                last = page.locator(".blk").last                  # only ever act on the latest block
                try:
                    go = last.locator(".cbtn.go:not([disabled])")
                    if go.count():
                        idle = 0; shot(page, "ceremony"); go.first.click(); break
                    scope = last.locator(".cbtn:not([disabled])", has_text="Scope looks good")
                    if scope.count():
                        idle = 0
                        if "scope" not in stage_shots:
                            last.locator(".pgrid").first.scroll_into_view_if_needed(); shot(page, "packages"); stage_shots.add("scope")
                            log.append({"packages": last.locator(".pgrid").first.inner_text()[:900]})
                        scope.first.click(); page.wait_for_timeout(2500); continue
                    if last.locator(".cgrid .cc").count() and last.locator(".cbtn", has_text="Use this").count():
                        idle = 0
                        if "shapes" not in stage_shots:
                            last.locator(".cgrid").scroll_into_view_if_needed(); shot(page, "shapes"); stage_shots.add("shapes")
                            log.append({"shapes": last.locator(".cgrid").inner_text()[:900]})
                        last.locator(".cgrid .cc").first.click(timeout=5000)
                        last.locator(".cbtn:not([disabled])", has_text="Use this").click(timeout=5000)
                        page.wait_for_timeout(2500); continue
                    opt = last.locator(".opt:not([disabled])")
                    if opt.count():
                        idle = 0
                        q = last.locator("h2.q").inner_text() if last.locator("h2.q").count() else ""
                        log.append({"turn": turn, "q": q[:140]})
                        opt.first.click(timeout=5000)
                        send = last.locator(".cbtn:not([disabled])", has_text="Send picks")
                        if send.count():
                            send.first.click(timeout=5000)
                        page.wait_for_timeout(1300)
                        if "gamify" not in stage_shots and page.locator("[class*=fly], [class*=gchip]").count():
                            shot(page, "gamify"); stage_shots.add("gamify")
                        page.wait_for_timeout(1500); continue
                except PWTimeout as e:
                    log.append({"click_timeout": turn, "err": str(e)[:120]})
                idle += 1                                       # reply still streaming: wait, don't give up
                if idle > 40:
                    log.append({"no_action_turn": turn}); shot(page, "no-action"); break
                page.wait_for_timeout(1500); continue

            # Learn
            page.wait_for_timeout(2500)
            shot(page, "learn-arch")
            for i in range(8):
                nxt = page.locator("main button", has_text="See your plan")
                if nxt.count():
                    shot(page, "quiz")
                    log.append({"quiz_questions": page.locator("main").inner_text().count("?")})
                    nxt.first.click(); break
                prim = page.locator("main button:has(svg.lucide-arrow-right)").last
                if not prim.count():
                    break
                prim.click(); page.wait_for_timeout(1200)
                shot(page, f"learn-{i + 1}")
            # Plan
            page.get_by_role("button", name="Looks good, let's build").wait_for(timeout=300000)
            page.wait_for_function("() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes(\"Looks good, let's build\")); return !!b && !b.disabled; }", timeout=300000)
            page.wait_for_timeout(2500)                          # let the diagram finish drawing
            shot(page, "plan")
            log.append({"plan_pieces": page.locator("main").inner_text()[:400]})
            if a.refine:
                page.locator("textarea[placeholder='Say what to change…']").fill(a.refine)
                page.get_by_role("button", name="Rework it").click()
                page.wait_for_timeout(3000)
                page.wait_for_function("() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes(\"Looks good, let's build\")); return !!b && !b.disabled; }", timeout=300000)
                page.wait_for_timeout(1500)
                shot(page, "plan-refined")
                log.append({"after_refine": page.locator("main").inner_text()[:700]})
            page.get_by_role("button", name="Looks good, let's build").click()
            # Build
            page.get_by_role("button", name="Start step 1").wait_for(timeout=300000)
            shot(page, "build-overview")
            log.append({"build_steps": page.locator("main").inner_text()[:900]})
            page.get_by_role("button", name="Start step 1").click(); page.wait_for_timeout(800)
            shot(page, "build-step1")
            h = page.locator("button", has_text="I need help prompting")
            if h.count():
                h.first.click(); page.wait_for_timeout(400); shot(page, "build-step1-help")
            steps = page.locator("button[aria-label^='Step ']")
            if steps.count():
                steps.last.click(); page.wait_for_timeout(800); shot(page, "build-last-step")
                log.append({"last_step": page.locator("main").inner_text()[:500]})
        finally:
            browser.close()
    print(json.dumps({"log": log, "errors": errors, "secs": round(time.time() - t0)}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
