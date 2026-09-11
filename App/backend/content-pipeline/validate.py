"""Deterministic validation gate for content.json / sentences.json.

Whatever produces content — a Bedrock model call, the Python extraction
scripts, or a hand edit — must pass this gate before it is published, so the
frontend never receives content it can't render and learner SRS progress
(keyed by item id) is never orphaned.

Two layers:
  1. JSON Schema validation (schema/*.schema.json), the structural contract.
  2. Invariant checks beyond what JSON Schema expresses, notably the
     append-only id rule (needs a baseline to diff against).

Usage:
    python validate.py content <candidate.json> [--baseline <current.json>]
    python validate.py sentences <candidate.json>

Exits 0 if valid, 1 if invalid (errors printed to stderr).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

SCHEMA_DIR = Path(__file__).parent / "schema"
KNOWN_ITEM_TYPES = {"vocab", "grammar"}


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _schema_errors(instance: Any, schema_name: str) -> list[str]:
    schema = _load_json(SCHEMA_DIR / schema_name)
    validator = Draft202012Validator(schema)
    errors = []
    for err in sorted(validator.iter_errors(instance), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in err.path) or "(root)"
        errors.append(f"schema: {loc}: {err.message}")
    return errors


def _content_invariants(content: dict, baseline: dict | None) -> list[str]:
    """Checks beyond the JSON Schema for content.json."""
    errors: list[str] = []

    chapters = content.get("chapters", [])

    # Chapter ids present and sequential 1..N.
    ids = [ch.get("id") for ch in chapters]
    expected = list(range(1, len(chapters) + 1))
    if ids != expected:
        errors.append(f"chapters: ids must be sequential {expected}, got {ids}")

    # Collect every item; enforce known type discriminant + globally-unique ids.
    seen: dict[str, str] = {}  # id -> type
    for ch in chapters:
        for item in ch.get("items", []):
            item_id = item.get("id")
            item_type = item.get("type")
            if item_type not in KNOWN_ITEM_TYPES:
                errors.append(
                    f"item {item_id!r}: unknown type {item_type!r} "
                    f"(frontend renders only {sorted(KNOWN_ITEM_TYPES)})"
                )
            if item_id in seen:
                errors.append(f"item id {item_id!r}: duplicated (ids must be unique)")
            else:
                seen[item_id] = item_type

    # Append-only id rule: no id from the baseline may be removed, and an id
    # must not change type (that would repurpose a learner's SRS card).
    if baseline is not None:
        base_types: dict[str, str] = {}
        for ch in baseline.get("chapters", []):
            for item in ch.get("items", []):
                base_types[item.get("id")] = item.get("type")
        for base_id, base_type in base_types.items():
            if base_id not in seen:
                errors.append(
                    f"item id {base_id!r}: removed vs baseline "
                    f"(ids are append-only; removing orphans learner progress)"
                )
            elif seen[base_id] != base_type:
                errors.append(
                    f"item id {base_id!r}: type changed {base_type!r} -> "
                    f"{seen[base_id]!r} (an id must keep its type)"
                )

    return errors


def validate_content(candidate_path: Path, baseline_path: Path | None) -> list[str]:
    content = _load_json(candidate_path)
    errors = _schema_errors(content, "content.schema.json")
    # Only run structural invariants if the shape is a dict (schema failed hard
    # otherwise and item-walking would just add noise).
    if isinstance(content, dict):
        baseline = _load_json(baseline_path) if baseline_path else None
        errors += _content_invariants(content, baseline)
    return errors


def validate_sentences(candidate_path: Path) -> list[str]:
    data = _load_json(candidate_path)
    errors = _schema_errors(data, "sentences.schema.json")
    if isinstance(data, dict):
        # Sentence item ids should be unique across all categories.
        seen: set[str] = set()
        for cat in data.get("categories", []):
            for item in cat.get("items", []):
                sid = item.get("id")
                if sid in seen:
                    errors.append(f"sentence id {sid!r}: duplicated")
                seen.add(sid)
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate content/sentences JSON.")
    sub = parser.add_subparsers(dest="kind", required=True)

    p_content = sub.add_parser("content", help="validate a content.json")
    p_content.add_argument("candidate", type=Path)
    p_content.add_argument(
        "--baseline",
        type=Path,
        default=None,
        help="currently-published content.json to enforce append-only ids against",
    )

    p_sentences = sub.add_parser("sentences", help="validate a sentences.json")
    p_sentences.add_argument("candidate", type=Path)

    args = parser.parse_args(argv)

    if args.kind == "content":
        errors = validate_content(args.candidate, args.baseline)
    else:
        errors = validate_sentences(args.candidate)

    if errors:
        print(f"INVALID ({len(errors)} problem(s)):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print("VALID")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
