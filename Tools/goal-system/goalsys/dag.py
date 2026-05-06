"""Task 1.3 — DAG 무결성 검증.

설계 §4.2 의 6가지 규칙:
- R1 순환 금지 (Acyclicity)
- R2 고아 금지 (No orphans) — Pillar/Constraint Goal 만 ``parents=[]`` 허용
- R3 참조 무결성 (Referential integrity) — 모든 ID 가 실재
- R4 양방향 일관성 (Bidirectional consistency) — A.parents 에 B 면 B.children 에 A
- R5 상태 일관성 (Status consistency)
  * achieved: success_criteria 가 충족 표시되어야 한다 (``achieved: true``)
  * abandoned: 자식들은 abandoned 또는 다른 부모로 재배치되어야 한다
  * superseded: ``superseded_by`` 필수
- R6 ``constraints`` 의 참조 대상은 ``tags`` 에 ``constraint`` 포함
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

from .parser import Goal


@dataclass
class DagError:
    """DAG 무결성 위반 — 빌드를 막아야 하는 강한 위반."""

    rule: str
    goal_id: str
    message: str

    def __str__(self) -> str:
        return f"[{self.rule}] {self.goal_id}: {self.message}"

    def to_dict(self) -> dict:
        return {
            "issue": "dag_error",
            "rule": self.rule,
            "goal": self.goal_id,
            "message": self.message,
        }


@dataclass
class DagWarning:
    """경고 — 일관성 권고지만 빌드는 통과시킨다 (정책에 따라 강화 가능)."""

    rule: str
    goal_id: str
    message: str

    def __str__(self) -> str:
        return f"[{self.rule}] {self.goal_id}: {self.message}"

    def to_dict(self) -> dict:
        return {
            "issue": "dag_warning",
            "rule": self.rule,
            "goal": self.goal_id,
            "message": self.message,
        }


def _index(goals: Iterable[Goal]) -> Dict[str, Goal]:
    out: Dict[str, Goal] = {}
    for g in goals:
        out[g.id] = g
    return out


def _check_referential_integrity(
    goals_by_id: Dict[str, Goal],
) -> List[DagError]:
    errors: List[DagError] = []
    for gid, g in goals_by_id.items():
        for field_name, ids in (
            ("parents", g.parents),
            ("children", g.children),
            ("constraints", g.constraints),
        ):
            for ref in ids:
                if ref == gid:
                    # 자기 참조 = 길이 1의 순환. R1 (Acyclicity) 로 분류.
                    errors.append(DagError(
                        "Acyclicity", gid,
                        f"{field_name} 가 자기 자신({ref})을 가리킨다",
                    ))
                elif ref not in goals_by_id:
                    errors.append(DagError(
                        "ReferentialIntegrity", gid,
                        f"{field_name} 의 ID {ref} 가 실재하지 않는다",
                    ))
        if g.superseded_by and g.superseded_by not in goals_by_id:
            errors.append(DagError(
                "ReferentialIntegrity", gid,
                f"superseded_by 의 ID {g.superseded_by} 가 실재하지 않는다",
            ))
    return errors


def _check_bidirectional(goals_by_id: Dict[str, Goal]) -> List[DagError]:
    errors: List[DagError] = []
    for gid, g in goals_by_id.items():
        for parent_id in g.parents:
            parent = goals_by_id.get(parent_id)
            if parent is None:
                continue  # ReferentialIntegrity 가 따로 보고
            if gid not in parent.children:
                errors.append(DagError(
                    "Bidirectional", gid,
                    f"{gid}.parents 가 {parent_id} 를 가리키지만 {parent_id}.children 에 {gid} 가 없다",
                ))
        for child_id in g.children:
            child = goals_by_id.get(child_id)
            if child is None:
                continue
            if gid not in child.parents:
                errors.append(DagError(
                    "Bidirectional", gid,
                    f"{gid}.children 가 {child_id} 를 가리키지만 {child_id}.parents 에 {gid} 가 없다",
                ))
    return errors


def _find_cycles(goals_by_id: Dict[str, Goal]) -> List[List[str]]:
    """parents 그래프에서 순환을 찾는다 (DFS, white/gray/black).

    반환값: 발견된 모든 순환의 노드 시퀀스 (한 순환은 한 번만 보고).
    """

    WHITE, GRAY, BLACK = 0, 1, 2
    color: Dict[str, int] = {gid: WHITE for gid in goals_by_id}
    parent_in_dfs: Dict[str, Optional[str]] = {gid: None for gid in goals_by_id}
    cycles: List[List[str]] = []
    seen_cycle_keys: set[Tuple[str, ...]] = set()

    def dfs(start: str) -> None:
        stack: List[Tuple[str, int]] = [(start, 0)]
        while stack:
            node, idx = stack[-1]
            if idx == 0:
                color[node] = GRAY
            g = goals_by_id[node]
            # children 방향으로 DFS — A→B 가 있으면 cycle 의 의미는 'A 가 후손을 통해 자기 자신에 닿음'.
            if idx < len(g.children):
                stack[-1] = (node, idx + 1)
                child = g.children[idx]
                if child not in goals_by_id:
                    continue
                if color[child] == WHITE:
                    parent_in_dfs[child] = node
                    stack.append((child, 0))
                elif color[child] == GRAY:
                    # 순환 발견 — child 부터 node 까지의 경로 복원.
                    cyc: List[str] = [child]
                    cur: Optional[str] = node
                    while cur is not None and cur != child:
                        cyc.append(cur)
                        cur = parent_in_dfs[cur]
                    cyc.append(child)
                    cyc.reverse()
                    # 동일 순환을 중복 보고하지 않기 위해 정규화 키 사용 (최소 ID 시작 회전).
                    body = cyc[:-1]
                    if body:
                        min_idx = min(range(len(body)), key=lambda i: body[i])
                        rotated = tuple(body[min_idx:] + body[:min_idx])
                        if rotated not in seen_cycle_keys:
                            seen_cycle_keys.add(rotated)
                            cycles.append(list(rotated) + [rotated[0]])
            else:
                color[node] = BLACK
                stack.pop()

    for gid in goals_by_id:
        if color[gid] == WHITE:
            dfs(gid)
    return cycles


def _check_no_orphans(goals_by_id: Dict[str, Goal]) -> List[DagError]:
    """최상위 Pillar 외 모든 active Goal 은 parents 가 있어야 한다.

    Pillar 식별 규칙:
    - tags 에 `pillar:*` 가 있거나
    - tags 에 `constraint` 가 있거나 (제약 Goal 은 부모 없이 단독 가능, §3.5)
    - id 가 G-0001 ~ G-0099 범위 (§3.4 의 예약 범위)

    이외에 parents 가 빈 Goal 은 고아.
    """

    errors: List[DagError] = []
    for gid, g in goals_by_id.items():
        if g.parents:
            continue
        if any(t.startswith("pillar:") for t in g.tags):
            continue
        if "constraint" in g.tags:
            continue
        # 예약 ID 범위: G-0001 ~ G-0099 — Pillar/메타 Goal 영역
        try:
            num = int(g.id.split("-", 1)[1])
        except (ValueError, IndexError):
            num = -1
        if 1 <= num <= 99:
            continue
        if g.status in {"abandoned", "superseded"}:
            continue
        errors.append(DagError(
            "NoOrphan", gid,
            "parents 가 비었지만 Pillar/Constraint/예약범위 어느 것에도 해당하지 않는다",
        ))
    return errors


def _check_status_consistency(
    goals_by_id: Dict[str, Goal],
) -> Tuple[List[DagError], List[DagWarning]]:
    errors: List[DagError] = []
    warnings: List[DagWarning] = []
    for gid, g in goals_by_id.items():
        if g.status == "achieved":
            for i, sc in enumerate(g.success_criteria):
                if not isinstance(sc, dict):
                    continue
                # 충족 표시는 `achieved: true` 또는 `met: true` 키로 표현한다고 가정.
                if not (sc.get("achieved") is True or sc.get("met") is True):
                    warnings.append(DagWarning(
                        "StatusConsistency", gid,
                        f"status=achieved 이지만 success_criteria[{i}] 가 충족(`achieved: true`)으로 표시되지 않았다",
                    ))
        elif g.status == "abandoned":
            for child_id in g.children:
                child = goals_by_id.get(child_id)
                if child is None:
                    continue  # 참조 무결성에서 별도 보고
                if child.status == "abandoned":
                    continue
                # 자식이 다른 부모로 재배치되었는지 확인.
                other_parents = [p for p in child.parents if p != gid and p in goals_by_id]
                if other_parents:
                    continue
                errors.append(DagError(
                    "StatusConsistency", gid,
                    f"abandoned Goal 의 자식 {child_id} 가 다른 부모로 재배치되지 않았고 abandoned 상태도 아니다",
                ))
        elif g.status == "superseded":
            if g.superseded_by is None:
                # schema 단계에서 처리되지만 DAG 차원에서도 보강.
                errors.append(DagError(
                    "StatusConsistency", gid,
                    "status=superseded 이지만 superseded_by 가 없다",
                ))
    return errors, warnings


def _check_constraint_targets(goals_by_id: Dict[str, Goal]) -> List[DagError]:
    """R6 — ``constraints`` 가 가리키는 Goal 은 ``tags`` 에 ``constraint`` 가 있어야 한다."""

    errors: List[DagError] = []
    for gid, g in goals_by_id.items():
        for ref in g.constraints:
            target = goals_by_id.get(ref)
            if target is None:
                continue  # ReferentialIntegrity 가 따로 보고
            if "constraint" not in target.tags:
                errors.append(DagError(
                    "ConstraintTarget", gid,
                    f"constraints 의 {ref} 가 Constraint Goal 이 아니다 (tags 에 'constraint' 없음)",
                ))
    return errors


def validate_dag(goals: Iterable[Goal]) -> Tuple[List[DagError], List[DagWarning]]:
    """6가지 DAG 규칙(R1~R6)을 일괄 검증한다.

    Returns:
        (errors, warnings) 튜플. errors 가 비어있으면 DAG 가 유효하다.
    """

    by_id = _index(goals)
    errors: List[DagError] = []
    warnings: List[DagWarning] = []

    errors.extend(_check_referential_integrity(by_id))
    errors.extend(_check_bidirectional(by_id))

    cycles = _find_cycles(by_id)
    for cyc in cycles:
        errors.append(DagError(
            "Acyclicity", cyc[0],
            f"순환 발견: {' → '.join(cyc)}",
        ))

    errors.extend(_check_no_orphans(by_id))

    sc_errors, sc_warnings = _check_status_consistency(by_id)
    errors.extend(sc_errors)
    warnings.extend(sc_warnings)

    errors.extend(_check_constraint_targets(by_id))

    return errors, warnings
