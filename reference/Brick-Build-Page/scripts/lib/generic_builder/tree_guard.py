"""Guard against overwriting full cached Bricks trees with thin plan-parse output."""
from __future__ import annotations

from scripts.lib.generic_builder.build import build_from_plan_tree, load_cached_tree
from scripts.lib.plan_parser import SectionSpec


def cached_element_count(plan_path, spec: SectionSpec) -> int | None:
    cached = load_cached_tree(plan_path, spec)
    return len(cached) if cached else None


def generic_element_count(plan_path, spec: SectionSpec) -> int:
    return len(build_from_plan_tree(plan_path, spec))


def assert_safe_force_generic(
    plan_path,
    spec: SectionSpec,
    *,
    confirm: bool,
) -> None:
    """
    Refuse --force-generic when a richer cached tree exists unless explicitly confirmed.
    Prevents autopilot/plan-parse from wiping full Figma-built layouts.
    """
    cached_n = cached_element_count(plan_path, spec)
    if cached_n is None:
        return

    try:
        generic_n = generic_element_count(plan_path, spec)
    except (ValueError, TypeError) as exc:
        raise SystemExit(
            f"Refusing --force-generic for template {spec.template_id}: "
            f"cached tree has {cached_n} elements but plan-parse failed ({exc})"
        ) from exc

    if generic_n >= cached_n:
        return

    label = f"{spec.name} ({spec.template_id})"
    if not confirm:
        raise SystemExit(
            f"BLOCKED --force-generic for {label}: "
            f"cached tree has {cached_n} elements, plan-parse only {generic_n}. "
            f"This would wipe the full layout. "
            f"Use --confirm-overwrite-generic only if intentional."
        )
