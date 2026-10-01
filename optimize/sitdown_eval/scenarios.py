"""Six scripted participants for the Sit-Down bench.

Each walks the real flow: open, problem, user & moment, objective (forced pushback),
pushback reply, shapes, scope (with a custom feature), readback. Answers are either
free text or "pick:N" (resolved against the model's OWN offered options, so the bench
also tests whether its options are usable). `expect` holds ground truth for checks.
"""

SCENARIOS = [
    {
        "id": "retail_waste",
        "idea": ("Our store managers throw away a lot of food at the end of the day. I want something that "
                 "helps them order better and see where the waste is."),
        "steps": [
            {"stage": "problem", "kind": "free",
             "text": "mostly sandwiches and pastries. the morning order is basically a guess from last week"},
            {"stage": "user_moment", "kind": "card", "text": "pick:0"},
            {"stage": "objective", "kind": "free", "push": True,
             "text": "Honestly the bigger issue might be that we have too many staff on in the afternoon when it's quiet."},
            {"stage": "objective", "kind": "correction",
             "text": "No, stay on waste. Labour was a side note. I want to cut fresh food waste."},
        ],
        "custom_feature": "managers take a photo of the bin at close and it counts the waste",
        "expect": {"alignment": [["on_track", "reframed"], ["on_track", "reframed"], ["drifting"], ["on_track", "reframed"]],
                   "must_generate": r"waste", "custom_heavy": True},
    },
    {
        "id": "ap_invoices",
        "idea": ("AP clerks spend hours chasing invoices that don't match the PO. I want a tool that flags "
                 "mismatches and duplicate invoices before we pay them."),
        "steps": [
            {"stage": "problem", "kind": "card", "text": "pick:1"},
            {"stage": "user_moment", "kind": "free",
             "text": "the AP clerk, first thing each morning, working the exceptions queue on their laptop"},
            {"stage": "objective", "kind": "free", "push": True,
             "text": "zero duplicate payments and the exceptions queue cleared by noon"},
            {"stage": "objective", "kind": "pushback_reply", "text": "pick:0"},
        ],
        "custom_feature": "automatically email the supplier when an invoice doesn't match",
        "expect": {"alignment": [["on_track", "reframed"]] * 4, "must_generate": None, "custom_heavy": False},
    },
    {
        "id": "hr_attrition_vague",
        "idea": "somethign for HR to see who might leave before they do",
        "steps": [
            {"stage": "problem", "kind": "free",
             "text": "we loose good ppl in the first year esp in stores, exit interviews are too late"},
            {"stage": "user_moment", "kind": "card", "text": "pick:2"},
            {"stage": "objective", "kind": "free", "push": True, "text": "reduce first year attrition"},
            {"stage": "objective", "kind": "correction",
             "text": "thats not what I meant, we can't use performance data. only tenure, department and leave dates"},
        ],
        "custom_feature": "a machine learning model that predicts each person's flight risk",
        "expect": {"alignment": [["on_track", "reframed"]] * 4, "must_generate": None, "custom_heavy": True},
    },
    {
        "id": "bi_sql_copilot",
        "idea": ("Our BI developers keep writing different SQL for the same KPI, so Power BI reports disagree. "
                 "I want a helper that writes the right SQL from our KPI definitions and checks report numbers."),
        "steps": [
            {"stage": "problem", "kind": "card", "text": "pick:0"},
            {"stage": "user_moment", "kind": "free",
             "text": "Oliver's team of 6 BI developers, while they're building a report in Power BI Desktop"},
            {"stage": "objective", "kind": "free", "push": True,
             "text": "every report matches the KPI definition and fewer 'which number is right' tickets"},
            {"stage": "objective", "kind": "pushback_reply",
             "text": "we have a KPI reference sheet already, revenue, gross profit, AOV, YoY, target vs actual"},
        ],
        "custom_feature": "connect to the Power BI service API and scan every published report",
        "expect": {"alignment": [["on_track", "reframed"]] * 4, "must_generate": r"kpi", "custom_heavy": True},
    },
    {
        "id": "ai_roi_drift",
        "idea": "Leadership wants to know if the AI tools we pay for are actually being used and are worth it.",
        "steps": [
            {"stage": "problem", "kind": "card", "text": "pick:0"},
            {"stage": "user_moment", "kind": "card", "text": "pick:1"},
            {"stage": "objective", "kind": "free", "push": True,
             "text": "Actually what I'd love is for it to recommend which training courses each person should take next."},
            {"stage": "objective", "kind": "pushback_reply", "text": "pick:1"},
        ],
        "custom_feature": "send a Slack nudge to people who haven't used their AI seat this month",
        "expect": {"alignment": [["on_track", "reframed"], ["on_track", "reframed"], ["drifting"], ["on_track", "reframed", "drifting"]],
                   "must_generate": None, "custom_heavy": False},
    },
    {
        "id": "vague_stores",
        "idea": "I want to use AI to help our stores do better.",
        "steps": [
            {"stage": "problem", "kind": "free", "text": "not sure, maybe sales are down in some stores?"},
            {"stage": "user_moment", "kind": "free", "text": "area managers I guess"},
            {"stage": "objective", "kind": "free", "push": True, "text": "sell more"},
            {"stage": "objective", "kind": "pushback_reply", "text": "I don't know, what would you suggest?"},
        ],
        "custom_feature": "",
        "expect": {"alignment": [["on_track", "reframed"]] * 4, "must_generate": None, "custom_heavy": False,
                   "open_max_mean": "C"},
    },
]
