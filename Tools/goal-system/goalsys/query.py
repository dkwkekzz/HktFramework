"""Goal 그래프 빠른 쿼리·네비게이션.

검색·서빙 컨텍스트 번들·역참조의 단일 진입점. CLI (`show`, `find`,
`neighbors`, `serve-context`, `which-goal`) 와 HTML 사이트 생성기가 함께 사용한다.

설계 원칙:
- 결과는 ``Goal`` / ``GoalId`` 단순 자료. 출력 포매팅은 호출자(CLI/뷰)에서.
- DAG 탐색은 ``children``/``parents`` 양방향 모두 활용 — DAG 검증을 통과한
  데이터라면 두 방향이 일관됨이 보장된다. 통과 안 된 경우에도 가능한
  방향으로 폴백한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Set

from .codescan import CodeTagIndex, normalize_rel
from .parser import Goal


GoalId = str


# ---------------------------------------------------------------------------
# 그래프 탐색 (transitive)
# ---------------------------------------------------------------------------


def _index(goals: Iterable[Goal]) -> Dict[GoalId, Goal]:
    return {g.id: g for g in goals}


def ancestors(goal_id: GoalId, by_id: Dict[GoalId, Goal]) -> Set[GoalId]:
    """``goal_id`` 의 모든 조상 — parents 그래프 폐포. 자기 자신 제외."""

    seen: Set[GoalId] = set()
    stack = [goal_id]
    while stack:
        cur = stack.pop()
        node = by_id.get(cur)
        if node is None:
            continue
        for p in node.parents:
            if p in seen or p == goal_id:
                continue
            seen.add(p)
            stack.append(p)
    return seen


def descendants(goal_id: GoalId, by_id: Dict[GoalId, Goal]) -> Set[GoalId]:
    """``goal_id`` 의 모든 후손 — children 그래프 폐포. 자기 자신 제외."""

    seen: Set[GoalId] = set()
    stack = [goal_id]
    while stack:
        cur = stack.pop()
        node = by_id.get(cur)
        if node is None:
            continue
        for c in node.children:
            if c in seen or c == goal_id:
                continue
            seen.add(c)
            stack.append(c)
    return seen


def path_between(
    src: GoalId,
    dst: GoalId,
    by_id: Dict[GoalId, Goal],
) -> Optional[List[GoalId]]:
    """``src`` 에서 ``dst`` 까지 children 방향 BFS 경로. 없으면 ``None``.

    역방향(자식→부모) 도 시도한다 — UI 에서 두 Goal 사이 연결을 탐색할 때 유용.
    """

    forward = _bfs(src, dst, by_id, lambda g: g.children)
    if forward is not None:
        return forward
    reverse = _bfs(src, dst, by_id, lambda g: g.parents)
    return reverse


def _bfs(
    src: GoalId,
    dst: GoalId,
    by_id: Dict[GoalId, Goal],
    edges: Callable[[Goal], Sequence[GoalId]],
) -> Optional[List[GoalId]]:
    if src == dst:
        return [src]
    if src not in by_id or dst not in by_id:
        return None
    prev: Dict[GoalId, GoalId] = {}
    seen: Set[GoalId] = {src}
    queue: List[GoalId] = [src]
    while queue:
        cur = queue.pop(0)
        node = by_id.get(cur)
        if node is None:
            continue
        for nxt in edges(node):
            if nxt in seen or nxt not in by_id:
                continue
            seen.add(nxt)
            prev[nxt] = cur
            if nxt == dst:
                # 경로 복원
                path: List[GoalId] = [dst]
                while path[-1] != src:
                    path.append(prev[path[-1]])
                path.reverse()
                return path
            queue.append(nxt)
    return None


# ---------------------------------------------------------------------------
# 이웃 — 단일 Goal 의 직접 연결 요약
# ---------------------------------------------------------------------------


@dataclass
class Neighbors:
    """단일 Goal 의 직접 연결 요약. CLI/HTML 양쪽이 같은 dict 형태로 소비."""

    goal_id: GoalId
    parents: List[GoalId] = field(default_factory=list)
    children: List[GoalId] = field(default_factory=list)
    siblings: List[GoalId] = field(default_factory=list)
    constraints: List[GoalId] = field(default_factory=list)
    constrained_by: List[GoalId] = field(default_factory=list)
    realizes_paths: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "goal_id": self.goal_id,
            "parents": list(self.parents),
            "children": list(self.children),
            "siblings": list(self.siblings),
            "constraints": list(self.constraints),
            "constrained_by": list(self.constrained_by),
            "realizes_paths": list(self.realizes_paths),
        }


def neighbors(goal_id: GoalId, goals: Sequence[Goal]) -> Optional[Neighbors]:
    """``goal_id`` 의 직접 이웃을 모은다 — Goal 이 없으면 ``None``."""

    by_id = _index(goals)
    target = by_id.get(goal_id)
    if target is None:
        return None

    # 형제 = 부모 중 누구의 자식이지만 자신은 제외
    sibling_set: Set[GoalId] = set()
    for p in target.parents:
        parent = by_id.get(p)
        if parent is None:
            continue
        for ch in parent.children:
            if ch != goal_id and ch in by_id:
                sibling_set.add(ch)

    # 역방향 제약 — 누가 나를 constraint 로 가리키는가
    constrained_by: List[GoalId] = sorted(
        g.id for g in goals if goal_id in g.constraints
    )

    return Neighbors(
        goal_id=goal_id,
        parents=list(target.parents),
        children=list(target.children),
        siblings=sorted(sibling_set),
        constraints=list(target.constraints),
        constrained_by=constrained_by,
        realizes_paths=[r.get("path", "") for r in target.realizes if r.get("path")],
    )


# ---------------------------------------------------------------------------
# 필터 검색
# ---------------------------------------------------------------------------


@dataclass
class FindFilter:
    """``find_goals`` 의 필터 명세. 모든 필드는 AND 결합."""

    status: Optional[str] = None
    tag: Optional[str] = None
    parent: Optional[GoalId] = None  # 직속 부모
    ancestor: Optional[GoalId] = None  # 조상(transitive)
    child: Optional[GoalId] = None  # 직속 자식
    descendant: Optional[GoalId] = None  # 후손(transitive)
    text: Optional[str] = None  # 제목 + intent 부분일치 (대소문자 무시)
    has_constraint: Optional[GoalId] = None  # constraints 포함

    def is_empty(self) -> bool:
        return all(v is None for v in (
            self.status, self.tag, self.parent, self.ancestor,
            self.child, self.descendant, self.text, self.has_constraint,
        ))


def find_goals(goals: Sequence[Goal], flt: FindFilter) -> List[Goal]:
    """필터에 매칭되는 Goal 목록. 입력 순서를 ID 오름차순으로 정규화한다."""

    by_id = _index(goals)
    needle = flt.text.casefold() if flt.text else None

    # 조상/후손 필터를 위한 미리계산 — 큰 코퍼스에서도 한 번만 계산.
    ancestor_set: Optional[Set[GoalId]] = None
    if flt.ancestor:
        # ancestor=A 인 Goal = A 의 후손들
        ancestor_set = descendants(flt.ancestor, by_id)
    descendant_set: Optional[Set[GoalId]] = None
    if flt.descendant:
        # descendant=D 인 Goal = D 의 조상들
        descendant_set = ancestors(flt.descendant, by_id)

    out: List[Goal] = []
    for g in goals:
        if flt.status and g.status != flt.status:
            continue
        if flt.tag and flt.tag not in g.tags:
            continue
        if flt.parent and flt.parent not in g.parents:
            continue
        if flt.child and flt.child not in g.children:
            continue
        if flt.has_constraint and flt.has_constraint not in g.constraints:
            continue
        if ancestor_set is not None and g.id not in ancestor_set:
            continue
        if descendant_set is not None and g.id not in descendant_set:
            continue
        if needle is not None:
            haystack = (g.title + "\n" + g.intent).casefold()
            if needle not in haystack:
                continue
        out.append(g)
    out.sort(key=lambda x: x.id)
    return out


# ``status:active``, ``tag:layer:vm``, ``parent:G-0010`` 형태의 토큰을 받아
# ``FindFilter`` 로 구성한다. 첫 토큰의 prefix 가 알려진 키가 아니면 ``text`` 로 처리.
_TOKEN_KEYS = {
    "status", "tag", "parent", "ancestor",
    "child", "descendant", "text", "constraint",
}


def parse_filter_tokens(tokens: Iterable[str]) -> FindFilter:
    """``parent:G-0010 status:active`` 같은 토큰열 → ``FindFilter``.

    동일 키 중복 시 마지막 값이 우선. ``constraint:`` 는 ``has_constraint`` 에 매핑.
    키 없는 토큰은 ``text`` 에 누적(공백으로 결합).
    """

    flt = FindFilter()
    free_text: List[str] = []
    for tok in tokens:
        if ":" in tok:
            key, _, value = tok.partition(":")
            key = key.strip().lower()
            value = value.strip()
            if not value:
                free_text.append(tok)
                continue
            if key == "status":
                flt.status = value
            elif key == "tag":
                flt.tag = value
            elif key == "parent":
                flt.parent = value
            elif key == "ancestor":
                flt.ancestor = value
            elif key == "child":
                flt.child = value
            elif key == "descendant":
                flt.descendant = value
            elif key == "constraint":
                flt.has_constraint = value
            elif key == "text":
                free_text.append(value)
            else:
                # 콜론을 포함한 자유 텍스트 — `tag:layer:vm` 같은 다단 태그에서 등장 가능.
                # 알려진 키가 아니면 원본 토큰을 텍스트로 흡수.
                free_text.append(tok)
        else:
            free_text.append(tok)
    if free_text:
        flt.text = " ".join(free_text)
    return flt


# ---------------------------------------------------------------------------
# 서빙 컨텍스트 번들 — `/goal serve` 한 호출 컨텍스트
# ---------------------------------------------------------------------------


@dataclass
class ServeContext:
    """봉사 작업 시작 시 한 번에 로드할 컨텍스트.

    - ``goal``: 대상 Goal 본체.
    - ``constraint_goals``: ``goal.constraints`` 가 가리키는 Constraint Goal 들 (전이).
    - ``parents``: 직속 부모(의도 맥락).
    - ``realizes_paths``: ``goal`` 및 후손이 가리키는 코드 경로 (중복 제거).
    """

    goal: Goal
    constraint_goals: List[Goal] = field(default_factory=list)
    parents: List[Goal] = field(default_factory=list)
    realizes_paths: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "goal": _goal_summary(self.goal),
            "constraints": [_goal_summary(g) for g in self.constraint_goals],
            "parents": [_goal_summary(g) for g in self.parents],
            "realizes_paths": list(self.realizes_paths),
        }


def _goal_summary(g: Goal) -> dict:
    return {
        "id": g.id,
        "title": g.title,
        "status": g.status,
        "tags": list(g.tags),
        "intent": g.intent,
        "success_criteria": list(g.success_criteria),
    }


def serve_context(goal_id: GoalId, goals: Sequence[Goal]) -> Optional[ServeContext]:
    """``goal_id`` 봉사 작업에 필요한 컨텍스트를 한 번에 모은다.

    - constraint Goal 은 transitive — 어느 constraint 가 또 다른 constraint 를
      가리키면 함께 포함. 순환은 자연 차단(set 사용).
    - realizes 경로는 자기 + 후손 합집합 — 봉사 작업이 후손 코드 영역까지
      터치할 가능성이 있을 때 빠진 파일을 줄인다.
    """

    by_id = _index(goals)
    target = by_id.get(goal_id)
    if target is None:
        return None

    constraint_ids: Set[GoalId] = set()
    stack: List[GoalId] = list(target.constraints)
    while stack:
        cid = stack.pop()
        if cid in constraint_ids or cid not in by_id:
            continue
        constraint_ids.add(cid)
        # constraint Goal 도 자신의 constraints 를 가질 수 있음 — 전이 수집.
        stack.extend(by_id[cid].constraints)

    parent_goals = [by_id[p] for p in target.parents if p in by_id]
    constraint_goals = sorted(
        (by_id[c] for c in constraint_ids), key=lambda g: g.id,
    )

    paths: List[str] = []
    seen_paths: Set[str] = set()

    def add_paths_from(goal: Goal) -> None:
        for entry in goal.realizes:
            p = entry.get("path", "")
            if p and p not in seen_paths:
                seen_paths.add(p)
                paths.append(p)

    add_paths_from(target)
    for d_id in sorted(descendants(goal_id, by_id)):
        add_paths_from(by_id[d_id])

    return ServeContext(
        goal=target,
        constraint_goals=constraint_goals,
        parents=parent_goals,
        realizes_paths=paths,
    )


# ---------------------------------------------------------------------------
# 코드 → Goal 역참조
# ---------------------------------------------------------------------------


def which_goal(
    rel_path: str,
    code_index: CodeTagIndex,
    goals: Optional[Sequence[Goal]] = None,
) -> List[GoalId]:
    """파일 경로에 적용되는 모든 Goal ID.

    합집합 = 헤더 ``@goal`` 태그 + 상위 ``GOALS.md`` ``## Realizes`` +
    (제공된 경우) Goal frontmatter ``realizes`` 의 path 가 prefix 일치하는 Goal.
    frontmatter realizes 는 디렉토리 경로(예: ``HktGameplay/Source/HktCore``)
    로도 자주 적히므로 ``rel_path.startswith(realizes_path)`` 까지 인정.

    입력 경로는 미리 정규화한다.
    """

    norm = normalize_rel(rel_path)
    out: List[GoalId] = list(code_index.tags_for(norm))
    seen: Set[GoalId] = set(out)

    if goals is not None:
        for g in goals:
            if g.id in seen:
                continue
            for entry in g.realizes:
                p = entry.get("path", "")
                if not p:
                    continue
                pn = normalize_rel(p)
                if norm == pn:
                    out.append(g.id)
                    seen.add(g.id)
                    break
                # 디렉토리 형태(확장자 없음)일 때만 prefix 매칭 — 파일 경로의
                # 확장자 뒤에 ``/something`` 이 붙는 일은 없으므로 안전하게 차단.
                if not PurePosixPath(pn).suffix and norm.startswith(pn.rstrip("/") + "/"):
                    out.append(g.id)
                    seen.add(g.id)
                    break
    return out
