"""Tolerant JSON parsing for LLM output.

Real workshop inputs (long, messy, multi-line ideas) push the model into JSON that
`json.loads` rejects on its defaults — most often a literal newline or control
character inside a string ("Invalid control character at ..."), or a trailing comma
before a closing bracket. Those are cosmetic, not structural, so we parse leniently
rather than dead-end the participant. Genuinely truncated output (an unterminated
string) still raises — that's what the caller's retry is for.
"""
import json
import re

_TRAILING_COMMA = re.compile(r",(\s*[}\]])")


def loads_tolerant(text: str) -> dict:
    """json.loads, but forgiving of the two ways LLM JSON usually trips: control
    characters inside strings (strict=False) and trailing commas."""
    try:
        return json.loads(text, strict=False)
    except json.JSONDecodeError:
        # Strip trailing commas (", }" / ", ]") and retry once.
        return json.loads(_TRAILING_COMMA.sub(r"\1", text), strict=False)
