from server.scope import strip_em_dashes, clamp_idea


def test_strips_spaced_em_dash():
    assert strip_em_dashes("audience — now tell us") == "audience, now tell us"


def test_strips_unspaced_em_dash():
    assert strip_em_dashes("objective—what it moves") == "objective, what it moves"


def test_en_dash_range_becomes_hyphen():
    assert strip_em_dashes("range 5–10") == "range 5-10"


def test_plain_text_unchanged():
    assert strip_em_dashes("plain text, no dashes") == "plain text, no dashes"


def test_empty_and_none_safe():
    assert strip_em_dashes("") == ""
    assert strip_em_dashes(None) is None


def test_clamp_idea_leaves_short_text():
    s = "Flag stores whose sales dropped."
    assert clamp_idea(s) == s


def test_clamp_idea_truncates_long_text():
    long = "x" * 5000
    out = clamp_idea(long, limit=2000)
    assert len(out) <= 2004 and out.endswith("...")


def test_clamp_idea_empty_safe():
    assert clamp_idea("") == ""
    assert clamp_idea(None) is None
