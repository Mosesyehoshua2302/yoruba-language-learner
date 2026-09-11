"""Tests for the content/sentences validation gate."""

import json
from pathlib import Path

import validate

# The real, currently-published content is the canonical valid fixture.
DATA_DIR = Path(__file__).parents[2] / "frontend" / "src" / "data"


def _write(tmp_path: Path, name: str, obj) -> Path:
    p = tmp_path / name
    p.write_text(json.dumps(obj), encoding="utf-8")
    return p


def _minimal_content() -> dict:
    return {
        "meta": {
            "title": "T",
            "author": "A",
            "license": "L",
            "isbn": "1",
            "extractionNotes": [],
        },
        "intro": {"title": "I", "notes": []},
        "chapters": [
            {
                "id": 1,
                "yorubaTitle": "Orí Kìíní",
                "title": "One",
                "objectives": [],
                "items": [
                    {"id": "c1-v1", "type": "vocab", "pos": "noun", "yo": "a", "en": "b"},
                    {
                        "id": "c1-g1",
                        "type": "grammar",
                        "lesson": 1,
                        "title": "G",
                        "explanation": "x",
                        "examples": [{"yo": "a", "en": "b"}],
                    },
                ],
            }
        ],
    }


# ---- real files validate (Phase 0 verification) ----

def test_real_content_json_is_valid():
    errors = validate.validate_content(DATA_DIR / "content.json", None)
    assert errors == [], errors


def test_real_sentences_json_is_valid():
    errors = validate.validate_sentences(DATA_DIR / "sentences.json")
    assert errors == [], errors


# ---- minimal valid fixture ----

def test_minimal_content_valid(tmp_path):
    p = _write(tmp_path, "c.json", _minimal_content())
    assert validate.validate_content(p, None) == []


# ---- invariant violations fail ----

def test_unknown_item_type_fails(tmp_path):
    c = _minimal_content()
    c["chapters"][0]["items"][0]["type"] = "audio"
    p = _write(tmp_path, "c.json", c)
    errors = validate.validate_content(p, None)
    assert any("audio" in e or "unknown type" in e for e in errors)


def test_duplicate_item_id_fails(tmp_path):
    c = _minimal_content()
    c["chapters"][0]["items"][1]["id"] = "c1-v1"  # collide with the vocab id
    p = _write(tmp_path, "c.json", c)
    errors = validate.validate_content(p, None)
    assert any("duplicated" in e for e in errors)


def test_non_sequential_chapter_ids_fail(tmp_path):
    c = _minimal_content()
    c["chapters"][0]["id"] = 5
    p = _write(tmp_path, "c.json", c)
    errors = validate.validate_content(p, None)
    assert any("sequential" in e for e in errors)


def test_append_only_removal_fails(tmp_path):
    baseline = _minimal_content()
    candidate = _minimal_content()
    # remove the grammar item from the candidate
    candidate["chapters"][0]["items"] = candidate["chapters"][0]["items"][:1]
    bp = _write(tmp_path, "base.json", baseline)
    cp = _write(tmp_path, "cand.json", candidate)
    errors = validate.validate_content(cp, bp)
    assert any("removed vs baseline" in e for e in errors)


def test_append_only_type_change_fails(tmp_path):
    baseline = _minimal_content()
    candidate = _minimal_content()
    # keep id c1-v1 but flip it to grammar
    candidate["chapters"][0]["items"][0] = {
        "id": "c1-v1",
        "type": "grammar",
        "lesson": 1,
        "title": "G",
        "explanation": "x",
        "examples": [],
    }
    bp = _write(tmp_path, "base.json", baseline)
    cp = _write(tmp_path, "cand.json", candidate)
    errors = validate.validate_content(cp, bp)
    assert any("type changed" in e for e in errors)


def test_editing_text_on_same_id_is_allowed(tmp_path):
    baseline = _minimal_content()
    candidate = _minimal_content()
    candidate["chapters"][0]["items"][0]["en"] = "edited gloss"  # same id, new text
    bp = _write(tmp_path, "base.json", baseline)
    cp = _write(tmp_path, "cand.json", candidate)
    assert validate.validate_content(cp, bp) == []


def test_missing_required_field_fails_schema(tmp_path):
    c = _minimal_content()
    del c["chapters"][0]["items"][0]["yo"]
    p = _write(tmp_path, "c.json", c)
    errors = validate.validate_content(p, None)
    assert any("schema:" in e for e in errors)
