"""FMAPI client + content coercion. Reused from the North Star app.

- `_client()` builds an OpenAI-compatible client against the workspace serving
  endpoint (AI Gateway URL if set, else {host}/serving-endpoints).
- `text_of()` coerces Claude's content (which may be a list of blocks) to a string.
- NOTE: Sonnet 5 rejects the `temperature` param — never pass it.
"""
import os
from openai import OpenAI
from . import config


def client() -> OpenAI:
    token = config.get_oauth_token()
    gateway = os.environ.get("AI_GATEWAY_URL")
    base_url = gateway.rstrip("/") if gateway else f"{config.get_workspace_host()}/serving-endpoints"
    return OpenAI(api_key=token, base_url=base_url)


def text_of(content) -> str:
    """Coerce an OpenAI/Claude message content into a plain string.

    Claude's serving endpoint can return content as a list of content blocks
    (e.g. [{'type':'text','text':'...'}]) instead of a string.
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(block.get("text") or block.get("content") or "")
            else:
                parts.append(getattr(block, "text", "") or "")
        return "".join(parts)
    return str(content)


def complete(messages: list, max_tokens: int = 2048) -> str:
    """Single non-streaming completion, returns text. No temperature (Sonnet 5)."""
    resp = client().chat.completions.create(
        model=config.get_serving_endpoint(), messages=messages, max_tokens=max_tokens)
    return text_of(resp.choices[0].message.content)
