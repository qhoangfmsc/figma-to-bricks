"""Generate and validate 6-char Bricks element IDs while authoring source trees."""
from __future__ import annotations

import hashlib
import re
from typing import Iterable

ELEMENT_ID_RE = re.compile(r"^[a-zA-Z0-9]{6}$")
BRICKS_ID_RE = re.compile(r"^[0-9a-f]{6}$")


def _deterministic_id(seed: str, index: int, used: set[str]) -> str:
    n = index
    while True:
        digest = hashlib.blake2s(f"{seed}:{n}".encode(), digest_size=4).hexdigest()
        candidate = digest[:6]
        if BRICKS_ID_RE.match(candidate) and candidate not in used:
            used.add(candidate)
            return candidate
        n += 1


class ElementIdFactory:
    """Stable id sequence for one template — call next() while writing live/trees/*.json."""

    def __init__(self, seed: str | int, *, existing: Iterable[str] = ()):
        self._seed = str(seed)
        self._used = set(existing)
        self._index = 0

    def next(self) -> str:
        eid = _deterministic_id(self._seed, self._index, self._used)
        self._index += 1
        return eid


def collect_element_ids(elements: list[dict]) -> set[str]:
    return {el["id"] for el in elements if el.get("id")}


def validate_tree_element_ids(elements: list[dict]) -> list[str]:
    """Return human-readable errors; empty list means ids are ready for build."""
    errors: list[str] = []
    seen: dict[str, str] = {}

    for el in elements:
        eid = el.get("id", "")
        name = el.get("name") or "?"
        if not eid or not ELEMENT_ID_RE.match(eid):
            errors.append(f"{name}: invalid id {eid!r} (need 6 alphanumeric chars)")
            continue
        if not BRICKS_ID_RE.match(eid):
            errors.append(
                f"{name}: id {eid!r} is not hex — use ElementIdFactory(template_id).next() "
                "when authoring, do not use semantic ids or remap later"
            )
            continue
        if eid in seen:
            errors.append(f"{name}: duplicate id {eid} (also on {seen[eid]})")
        else:
            seen[eid] = name

    return errors


def tree_ids_valid(elements: list[dict]) -> bool:
    return not validate_tree_element_ids(elements)
