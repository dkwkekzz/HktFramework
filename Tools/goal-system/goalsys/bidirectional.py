"""Phase 2 — `validate-bidirectional` + `sync-realizes`.

설계 §5.4 의 양방향 일관성 4조건 (C1~C4) 검증과, §5.3 의 자동 동기화.

Goal `realizes` 와 코드 ``@goal:`` 태그(또는 디렉토리 ``GOALS.md``) 가
같은 사실을 양쪽에서 표현하는지 점검한다. 모든 위반은 경고 — 빌드를 막지 않는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import yaml

from .codescan import CodeTagIndex, _normalize_rel  # type: ignore[attr-defined]
from .parser import Goal


# ---------------------------------------------------------------------------
# 결과 자료구조
# ---------------------------------------------------------------------------


@dataclass
class BidirectionalViolation:
    """C1~C4 위반 — 항상 ``severity: warning`` (도구 §5.2)."""

    condition: str  # "C1" | "C2" | "C3" | "C4"
    goal_id: Optional[str]
    path: Optional[str]
    message: str
    severity: str = "warning"

    def __str__(self) -> str:
        loc = self.goal_id or self.path or "?"
        return f"[{self.condition}/{self.severity}] {loc}: {self.message}"


@dataclass
class SyncAction:
    """sync-realizes 가 적용(또는 적용 예정)한 한 항목의 변경."""

    goal_id: str
    path: str
    role: str = "TODO"
    applied: bool = False

    def __str__(self) -> str:
        marker = "applied" if self.applied else "would-apply"
        return f"[{marker}] {self.goal_id} += {self.path} (role={self.role})"


# ---------------------------------------------------------------------------
# validate-bidirectional
# ---------------------------------------------------------------------------


def validate_bidirectional(
    goals: Sequence[Goal],
    code_index: CodeTagIndex,
    project_root: Path | str,
) -> List[BidirectionalViolation]:
    """C1~C4 위반을 모두 보고한다 (도구 §5.2 참조).

    Args:
        goals: 모든 Goal 객체.
        code_index: ``scan-code-tags`` 결과.
        project_root: ``realizes.path`` 와 코드 인덱스의 기준 경로.
    """

    root = Path(project_root)
    violations: List[BidirectionalViolation] = []

    by_id: Dict[str, Goal] = {g.id: g for g in goals}

    # --- C1: realizes.path 의 파일 시스템 실재 ---
    for g in goals:
        for entry in g.realizes:
            path = entry.get("path", "")
            if not path:
                continue
            if not (root / path).exists():
                violations.append(BidirectionalViolation(
                    condition="C1",
                    goal_id=g.id,
                    path=path,
                    message="realizes.path 가 파일 시스템에 없다",
                ))

    # --- C2: 코드 태그의 ID 가 실재 Goal ---
    for path, ids in code_index.file_tags.items():
        for gid in ids:
            if gid not in by_id:
                violations.append(BidirectionalViolation(
                    condition="C2",
                    goal_id=gid,
                    path=path,
                    message=f"코드 태그가 가리키는 Goal {gid} 이 존재하지 않는다",
                ))
    for dpath, ids in code_index.dir_tags.items():
        for gid in ids:
            if gid not in by_id:
                violations.append(BidirectionalViolation(
                    condition="C2",
                    goal_id=gid,
                    path=f"{dpath}/GOALS.md",
                    message=f"GOALS.md 가 가리키는 Goal {gid} 이 존재하지 않는다",
                ))

    # --- C3: A.realizes 에 X → X 의 태그 또는 X 디렉토리 GOALS.md 에 A ---
    for g in goals:
        for entry in g.realizes:
            path = entry.get("path", "")
            if not path:
                continue
            if not (root / path).exists():
                # C1 에서 이미 보고됨 — 중복 진단 회피.
                continue
            if g.id not in code_index.tags_for(path):
                violations.append(BidirectionalViolation(
                    condition="C3",
                    goal_id=g.id,
                    path=path,
                    message=(
                        f"Goal {g.id} 이 {path} 를 realize 한다고 주장하지만 "
                        "코드 측에 @goal 태그도 GOALS.md 항목도 없다"
                    ),
                ))

    # --- C4: X 의 태그에 A → A.realizes 에 X ---
    realizes_index: Dict[str, set[str]] = {gid: {e.get("path", "") for e in g.realizes}
                                            for gid, g in by_id.items()}
    for path, ids in code_index.file_tags.items():
        for gid in ids:
            if gid not in by_id:
                continue
            if path not in realizes_index.get(gid, set()):
                violations.append(BidirectionalViolation(
                    condition="C4",
                    goal_id=gid,
                    path=path,
                    message=f"코드 {path} 가 {gid} 태그를 가지지만 {gid}.realizes 에 등재되지 않았다",
                ))
    # 디렉토리 GOALS.md 항목은 디렉토리 단위 봉사 — A.realizes 에 디렉토리 자체가
    # 등재되어야 한다 (설계 §5.2: 디렉토리도 path 가능).
    for dpath, ids in code_index.dir_tags.items():
        for gid in ids:
            if gid not in by_id:
                continue
            paths = realizes_index.get(gid, set())
            # 디렉토리 자체 또는 그 디렉토리 하위 어느 파일이라도 포함되면 OK 로 본다.
            if dpath in paths:
                continue
            if any(p.startswith(dpath + "/") for p in paths if p):
                continue
            violations.append(BidirectionalViolation(
                condition="C4",
                goal_id=gid,
                path=f"{dpath}/GOALS.md",
                message=(
                    f"GOALS.md 가 {gid} 를 realize 한다고 주장하지만 "
                    f"{gid}.realizes 에 {dpath}(또는 그 하위) 가 없다"
                ),
            ))

    return violations


# ---------------------------------------------------------------------------
# sync-realizes
# ---------------------------------------------------------------------------


def sync_realizes(
    goals: Sequence[Goal],
    code_index: CodeTagIndex,
    *,
    dry_run: bool = False,
) -> List[SyncAction]:
    """코드 측에 있지만 Goal 측에 누락된 ``realizes`` 항목을 동기화한다.

    설계 §5.3 의 한쪽 동기화 (코드 → Goal) 만 수행한다:
    - 코드 X 태그 A 있는데 A.realizes 에 X 없음 → 추가 (``role: TODO``).
    - A.realizes 에 X 있는데 X 태그에 A 없음 → 변경 없음 (코드 측 정보 부족 가능성).

    Args:
        dry_run: True 면 파일을 수정하지 않고 적용 예정 액션만 반환한다.

    Returns:
        실제(또는 예정된) 변경 액션 목록.
    """

    by_id: Dict[str, Goal] = {g.id: g for g in goals}
    actions: List[SyncAction] = []

    pending: Dict[str, List[str]] = {}  # goal_id → list of new paths

    def queue(gid: str, path: str) -> None:
        if gid not in by_id:
            return
        existing = {e.get("path", "") for e in by_id[gid].realizes}
        if path in existing:
            return
        added = pending.setdefault(gid, [])
        if path in added:
            return
        added.append(path)
        actions.append(SyncAction(goal_id=gid, path=path, role="TODO"))

    for path, ids in code_index.file_tags.items():
        for gid in ids:
            queue(gid, path)
    for dpath, ids in code_index.dir_tags.items():
        for gid in ids:
            queue(gid, dpath)

    if dry_run:
        return actions

    for gid, new_paths in pending.items():
        goal = by_id[gid]
        if goal.source_path is None:
            continue
        _append_realizes(goal.source_path, new_paths)
        for action in actions:
            if action.goal_id == gid and action.path in new_paths:
                action.applied = True

    return actions


_FRONTMATTER_SPLIT_RE = re.compile(
    r"\A(?P<lead>---\s*\r?\n)(?P<fm>.*?)(?P<sep>\r?\n---\s*\r?\n?)(?P<body>.*)\Z",
    re.DOTALL,
)


def _append_realizes(path: Path, new_paths: Sequence[str]) -> None:
    """frontmatter 의 ``realizes`` 에 항목을 추가한다. 본문은 보존."""

    text = path.read_text(encoding="utf-8")
    m = _FRONTMATTER_SPLIT_RE.match(text)
    if not m:
        raise ValueError(f"frontmatter 를 찾을 수 없다: {path}")
    fm_text = m.group("fm")
    fm = yaml.safe_load(fm_text) or {}
    if not isinstance(fm, dict):
        raise ValueError(f"frontmatter 가 매핑이 아니다: {path}")
    realizes = fm.get("realizes") or []
    if not isinstance(realizes, list):
        raise ValueError(f"realizes 가 리스트가 아니다: {path}")
    existing_paths = {e.get("path") for e in realizes if isinstance(e, dict)}
    for p in new_paths:
        if p in existing_paths:
            continue
        realizes.append({"path": p, "role": "TODO"})
    fm["realizes"] = realizes

    new_fm_text = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False).rstrip()
    new_text = f"{m.group('lead')}{new_fm_text}{m.group('sep')}{m.group('body')}"
    path.write_text(new_text, encoding="utf-8")
