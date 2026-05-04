"""Task 1.4 — 자동 생성 뷰: INDEX.md / TREE.md / graph.mmd.

설계 §7.3 의 사양 준수.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Sequence

from .parser import Goal


_AUTOGEN_HEADER = "> ⚠️ 자동 생성 — 직접 수정 금지. `python -m goalsys.cli build-views` 로 재생성한다."


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _index_by_id(goals: Iterable[Goal]) -> Dict[str, Goal]:
    return {g.id: g for g in goals}


def _short(g: Goal) -> str:
    return f"{g.id} {g.title}"


def _is_pillar(g: Goal) -> bool:
    return any(t.startswith("pillar:") for t in g.tags)


def _is_constraint(g: Goal) -> bool:
    return "constraint" in g.tags


# ---------------------------------------------------------------------------
# INDEX.md — 다축 인덱스 (§7.3.1)
# ---------------------------------------------------------------------------


def generate_index(goals: Sequence[Goal], *, generated_at: Optional[str] = None) -> str:
    """INDEX.md 문자열 생성. By Pillar / By Status / By Tag 다축 인덱스."""

    by_id = _index_by_id(goals)
    timestamp = generated_at or _now_iso()

    out: List[str] = []
    out.append("# Goals Index")
    out.append("")
    out.append(_AUTOGEN_HEADER)
    out.append(f"> Last generated: {timestamp}")
    out.append(f"> Total goals: {len(goals)}")
    out.append("")

    # --- By Pillar ---
    out.append("## By Pillar")
    out.append("")
    pillars = sorted([g for g in goals if _is_pillar(g)], key=lambda g: g.id)
    if not pillars:
        out.append("_(아직 Pillar Goal 이 정의되지 않음)_")
        out.append("")
    for pillar in pillars:
        out.append(f"### {_short(pillar)}")
        out.append("")
        descendants = _collect_descendants(pillar.id, by_id)
        if not descendants:
            out.append("_(하위 Goal 없음)_")
            out.append("")
            continue
        for desc_id in sorted(descendants):
            desc = by_id[desc_id]
            other_pillars = _other_pillars_of(desc, by_id, exclude=pillar.id)
            extra = f"  *(also under {', '.join(other_pillars)})*" if other_pillars else ""
            out.append(f"- {_short(desc)}{extra}")
        out.append("")

    # 어느 Pillar 에도 속하지 않는 Goal — 보강 섹션.
    pillar_descendants: set[str] = set()
    for pillar in pillars:
        pillar_descendants.update(_collect_descendants(pillar.id, by_id))
    pillar_descendants.update(p.id for p in pillars)
    orphans = [g for g in goals if g.id not in pillar_descendants and not _is_constraint(g)]
    if orphans:
        out.append("### (Pillar 미분류)")
        out.append("")
        for g in sorted(orphans, key=lambda x: x.id):
            out.append(f"- {_short(g)}")
        out.append("")

    # --- By Status ---
    out.append("## By Status")
    out.append("")
    by_status: Dict[str, List[Goal]] = defaultdict(list)
    for g in goals:
        by_status[g.status].append(g)
    for status in ("active", "proposed", "achieved", "abandoned", "superseded"):
        bucket = by_status.get(status, [])
        out.append(f"### {status.capitalize()} ({len(bucket)})")
        out.append("")
        if not bucket:
            out.append("_(없음)_")
            out.append("")
            continue
        for g in sorted(bucket, key=lambda x: x.id):
            out.append(f"- {_short(g)}")
        out.append("")

    # --- By Tag ---
    out.append("## By Tag")
    out.append("")
    by_tag: Dict[str, List[Goal]] = defaultdict(list)
    for g in goals:
        for t in g.tags:
            by_tag[t].append(g)
    if not by_tag:
        out.append("_(태그 없음)_")
        out.append("")
    for tag in sorted(by_tag.keys()):
        bucket = by_tag[tag]
        out.append(f"### {tag} ({len(bucket)})")
        out.append("")
        for g in sorted(bucket, key=lambda x: x.id):
            out.append(f"- {_short(g)}")
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def _collect_descendants(root_id: str, by_id: Dict[str, Goal]) -> set[str]:
    """root_id 의 모든 후손 ID. children 그래프를 따라간다."""

    seen: set[str] = set()
    stack = [root_id]
    while stack:
        cur = stack.pop()
        node = by_id.get(cur)
        if node is None:
            continue
        for ch in node.children:
            if ch in seen or ch == root_id:
                continue
            seen.add(ch)
            stack.append(ch)
    return seen


def _other_pillars_of(goal: Goal, by_id: Dict[str, Goal], *, exclude: str) -> List[str]:
    """goal 이 속한 다른 Pillar(들) 의 ID 리스트."""

    pillars = [g for g in by_id.values() if _is_pillar(g) and g.id != exclude]
    out: List[str] = []
    for p in pillars:
        if goal.id in _collect_descendants(p.id, by_id):
            out.append(p.id)
    return sorted(out)


# ---------------------------------------------------------------------------
# TREE.md — 사람이 읽는 계층 뷰 (§7.3.2)
# ---------------------------------------------------------------------------


def generate_tree(goals: Sequence[Goal], *, generated_at: Optional[str] = None) -> str:
    """TREE.md 생성. Pillar 부터 깊이 우선으로 펼친다.

    다중 부모 Goal 은 첫 등장에서만 자식까지 펼치고, 이후 등장은 참조만 표기.
    """

    by_id = _index_by_id(goals)
    timestamp = generated_at or _now_iso()

    out: List[str] = []
    out.append("# Goal Tree")
    out.append("")
    out.append(_AUTOGEN_HEADER)
    out.append(f"> Last generated: {timestamp}")
    out.append("")

    expanded: set[str] = set()
    pillars = sorted(
        [g for g in goals if _is_pillar(g) and not g.parents],
        key=lambda g: g.id,
    )

    if not pillars:
        out.append("_(Pillar Goal 미정의)_")
        out.append("")

    for pillar in pillars:
        _render_node(pillar.id, by_id, depth=0, expanded=expanded, out=out)

    constraints = sorted(
        [g for g in goals if _is_constraint(g)],
        key=lambda g: g.id,
    )
    if constraints:
        out.append("")
        out.append("## Constraints (횡단 제약)")
        out.append("")
        for c in constraints:
            out.append(f"- {_short(c)}")
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def _render_node(
    node_id: str,
    by_id: Dict[str, Goal],
    *,
    depth: int,
    expanded: set[str],
    out: List[str],
) -> None:
    node = by_id.get(node_id)
    if node is None:
        return
    indent = "  " * depth
    if node_id in expanded:
        out.append(f"{indent}- → {_short(node)} _(자식 트리 위 참조)_")
        return
    expanded.add(node_id)
    status_marker = "" if node.status == "active" else f" _[{node.status}]_"
    out.append(f"{indent}- {_short(node)}{status_marker}")
    for ch in node.children:
        _render_node(ch, by_id, depth=depth + 1, expanded=expanded, out=out)


# ---------------------------------------------------------------------------
# graph.mmd — Mermaid DAG (§7.3.3)
# ---------------------------------------------------------------------------


def generate_graph(goals: Sequence[Goal], *, generated_at: Optional[str] = None) -> str:
    """Mermaid graph.mmd 생성. parents 관계 + 제약 관계."""

    by_id = _index_by_id(goals)
    timestamp = generated_at or _now_iso()

    out: List[str] = []
    out.append(f"%% 자동 생성 — 직접 수정 금지. Last generated: {timestamp}")
    out.append("graph TD")

    # 노드 선언 — 단축 ID, 라벨은 ID + 제목.
    for g in sorted(goals, key=lambda x: x.id):
        node_id = _mermaid_id(g.id)
        label = _mermaid_label(f"{g.id} {g.title}")
        if _is_constraint(g):
            out.append(f"  {node_id}[\"{label}\"]:::constraint")
        elif _is_pillar(g):
            out.append(f"  {node_id}[\"{label}\"]:::pillar")
        else:
            out.append(f"  {node_id}[\"{label}\"]")

    # parent → child 엣지.
    for g in sorted(goals, key=lambda x: x.id):
        for ch in g.children:
            if ch not in by_id:
                continue
            out.append(f"  {_mermaid_id(g.id)} --> {_mermaid_id(ch)}")

    # constraint 점선 엣지: G(constraint) -.제약.-> Target
    for g in sorted(goals, key=lambda x: x.id):
        for c in g.constraints:
            if c not in by_id:
                continue
            out.append(f"  {_mermaid_id(c)} -. 제약 .-> {_mermaid_id(g.id)}")

    out.append("  classDef pillar fill:#fef3c7,stroke:#b45309,stroke-width:2px;")
    out.append("  classDef constraint fill:#fee2e2,stroke:#b91c1c,stroke-width:1px,stroke-dasharray: 3 3;")

    return "\n".join(out) + "\n"


def _mermaid_id(goal_id: str) -> str:
    """Mermaid 노드 ID 는 alphanumeric 만 허용 — 'G-0142' → 'G0142'."""

    return goal_id.replace("-", "")


def _mermaid_label(text: str) -> str:
    """Mermaid 라벨 내 따옴표 이스케이프."""

    return text.replace('"', "'")
