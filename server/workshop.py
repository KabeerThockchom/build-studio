"""Per-workshop configuration — set in the admin console, read by the harness.

A single shared config (stored in Lakebase via sessions.get/set_config) lets a
facilitator shape the experience per workshop. The generation code reads
effective_config(); today the load-bearing levers are `allowed_capabilities` (hard
filter on the palette) and `industry`/`company` and a prescribed use case (injected
into the SA prompt). `data_path` is a soft preference hint, not a hard lock.
"""
from . import sessions
from .design_plan import CAPABILITIES as ALL_CAPABILITIES  # single source of truth

DEFAULT_CONFIG = {
    "workshop_name": "",
    "allowed_capabilities": list(ALL_CAPABILITIES),   # constrains the SA's palette
    "prescribed": False,                              # everyone builds the same use case
    "prescribed_use_case": "",                        # the fixed idea, when prescribed
    "industry": "",                                   # silent context into the SA prompt
    "company": "",                                    # target company (branding + context)
    "data_path": "any",                               # soft preference: any | synthetic | upload | existing
    "catalog": "",                                    # Unity Catalog the build lands in (baked into build prompts)
    "serving_endpoint": "",                           # FM model for generation + participant apps; "" = use the deploy default
    "admin_emails": [],                               # break-glass proctor allowlist
}


def build_catalog() -> str:
    """The Unity Catalog participants build into, from workshop config. Empty when the
    facilitator hasn't set one — build prompts then tell Genie Code to use the workshop's
    default catalog / ask, rather than inventing a name."""
    return (effective_config().get("catalog") or "").strip()


def effective_config() -> dict:
    """Stored config merged over defaults (missing keys fall back to default)."""
    stored = sessions.get_config() or {}
    cfg = dict(DEFAULT_CONFIG)
    for k, v in stored.items():
        if k in cfg and v is not None:
            cfg[k] = v
    # never let allowed_capabilities be empty or contain unknowns
    caps = [c for c in cfg.get("allowed_capabilities", []) if c in ALL_CAPABILITIES]
    cfg["allowed_capabilities"] = caps or list(ALL_CAPABILITIES)
    return cfg


def config_context_for_prompt(cfg: dict) -> str:
    """A short block injected into the SA prompt so config shapes generation."""
    bits = []
    if cfg.get("industry"):
        bits.append(f"Industry context for this workshop: {cfg['industry']}.")
    if cfg.get("company"):
        bits.append(f"This workshop is for {cfg['company']} — reflect their world in examples and naming.")
    if cfg.get("prescribed") and cfg.get("prescribed_use_case"):
        bits.append(f"The workshop prescribes this use case for everyone: \"{cfg['prescribed_use_case']}\".")
    if cfg.get("data_path") and cfg["data_path"] != "any":
        bits.append(f"Prefer the '{cfg['data_path']}' data path for this workshop when it fits.")
    return ("\nWORKSHOP CONFIG:\n- " + "\n- ".join(bits)) if bits else ""
