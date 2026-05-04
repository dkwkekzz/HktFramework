"""Task 1.1 — Goal 파일 형식(YAML frontmatter + Markdown) 파서.

설계 문서 §3, §8 참고. Goal 파일은 다음 형태를 따른다:

    ---
    id: G-XXXX
    title: ...
    status: active
    ...
    ---

    ## Intent
    (markdown text)

    ## Success Criteria
    - description: ...
      measurable: true
      measure: ...

    ## Rationale / Alternatives Considered / ...
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import yaml


class GoalParseError(ValueError):
    """파싱 단계에서 발생하는 오류. 위치 정보를 포함한다."""

    def __init__(self, message: str, source: Optional[Path] = None) -> None:
        prefix = f"[{source}] " if source is not None else ""
        super().__init__(f"{prefix}{message}")
        self.source = source


@dataclass
class Goal:
    """파싱된 Goal. frontmatter 메타데이터 + 본문 섹션."""

    id: str
    title: str
    status: str
    created_at: str
    updated_at: str
    parents: List[str] = field(default_factory=list)
    children: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    superseded_by: Optional[str] = None
    realizes: List[Dict[str, str]] = field(default_factory=list)
    related_docs: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

    # 본문 섹션 — 길이가 길어 frontmatter 가 아닌 markdown body 에 둔다.
    intent: str = ""
    success_criteria: List[Dict[str, Any]] = field(default_factory=list)
    rationale: str = ""
    alternatives_considered: List[Dict[str, str]] = field(default_factory=list)

    # 원본 frontmatter / body — 검증·재직렬화 시 raw 접근용.
    raw_frontmatter: Dict[str, Any] = field(default_factory=dict)
    raw_body: str = ""
    sections: Dict[str, str] = field(default_factory=dict)
    source_path: Optional[Path] = None


_FRONTMATTER_RE = re.compile(
    r"\A---\s*\r?\n(?P<fm>.*?)\r?\n---\s*\r?\n?(?P<body>.*)\Z",
    re.DOTALL,
)
_H2_RE = re.compile(r"^##\s+(?P<title>.+?)\s*$", re.MULTILINE)


def _split_sections(body: str) -> Dict[str, str]:
    """`## Heading` H2 단위로 본문을 분할한다.

    H2 직전까지의 텍스트는 무시된다 (Goal 본문은 항상 H2 로 시작한다고 가정).
    같은 이름의 섹션이 두 번 등장하면 두 번째가 우선한다 (마지막-우선).
    """

    sections: Dict[str, str] = {}
    matches = list(_H2_RE.finditer(body))
    for idx, match in enumerate(matches):
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(body)
        title = match.group("title").strip()
        sections[title] = body[start:end].strip("\n")
    return sections


def _parse_success_criteria_block(text: str) -> List[Dict[str, Any]]:
    """## Success Criteria 본문을 YAML 리스트로 파싱한다.

    본문 형태 (8.1 예시):

        - description: ...
          measurable: true
          measure: ...

    YAML 으로 직접 로드 가능하지만, 빈 본문이거나 형식이 어긋나면
    빈 리스트를 반환한다 (스키마 검증기에서 별도 진단).
    """

    stripped = text.strip()
    if not stripped:
        return []
    try:
        data = yaml.safe_load(stripped)
    except yaml.YAMLError as exc:
        raise GoalParseError(f"Success Criteria YAML 파싱 실패: {exc}") from exc
    if data is None:
        return []
    if not isinstance(data, list):
        raise GoalParseError(
            f"Success Criteria 는 YAML 리스트여야 한다. 실제: {type(data).__name__}"
        )
    return data


def _parse_alternatives_block(text: str) -> List[Dict[str, Any]]:
    """## Alternatives Considered 본문을 YAML 리스트로 파싱한다."""

    stripped = text.strip()
    if not stripped:
        return []
    try:
        data = yaml.safe_load(stripped)
    except yaml.YAMLError as exc:
        raise GoalParseError(f"Alternatives Considered YAML 파싱 실패: {exc}") from exc
    if data is None:
        return []
    if not isinstance(data, list):
        raise GoalParseError(
            f"Alternatives Considered 는 YAML 리스트여야 한다. 실제: {type(data).__name__}"
        )
    return data


def _split_frontmatter(text: str) -> Tuple[Dict[str, Any], str]:
    """`---` 로 감싼 frontmatter 와 body 를 분리한다."""

    match = _FRONTMATTER_RE.match(text)
    if not match:
        raise GoalParseError("YAML frontmatter (`---` 블록) 가 없다")
    try:
        fm = yaml.safe_load(match.group("fm")) or {}
    except yaml.YAMLError as exc:
        raise GoalParseError(f"frontmatter YAML 파싱 실패: {exc}") from exc
    if not isinstance(fm, dict):
        raise GoalParseError(
            f"frontmatter 는 YAML 매핑이어야 한다. 실제: {type(fm).__name__}"
        )
    return fm, match.group("body")


def parse_goal_text(text: str, source: Optional[Path] = None) -> Goal:
    """문자열로부터 Goal 을 파싱한다.

    스키마 검증은 수행하지 않는다 — 형식이 명백히 어긋난 경우에만 예외.
    필드 타입/필수 검증은 :func:`schema.validate_goal` 에서 처리한다.
    """

    try:
        fm, body = _split_frontmatter(text)
    except GoalParseError as exc:
        raise GoalParseError(str(exc), source=source) from exc

    sections = _split_sections(body)

    try:
        success_criteria = _parse_success_criteria_block(sections.get("Success Criteria", ""))
        alternatives = _parse_alternatives_block(sections.get("Alternatives Considered", ""))
    except GoalParseError as exc:
        raise GoalParseError(str(exc), source=source) from exc

    # frontmatter 에서 success_criteria 를 직접 제공한 경우 우선 사용한다.
    fm_criteria = fm.get("success_criteria")
    if isinstance(fm_criteria, list):
        success_criteria = fm_criteria

    realizes_raw = fm.get("realizes") or []
    realizes: List[Dict[str, str]] = []
    if isinstance(realizes_raw, list):
        for entry in realizes_raw:
            if isinstance(entry, dict):
                realizes.append({str(k): str(v) for k, v in entry.items()})

    goal = Goal(
        id=str(fm.get("id", "")),
        title=str(fm.get("title", "")),
        status=str(fm.get("status", "")),
        created_at=str(fm.get("created_at", "")),
        updated_at=str(fm.get("updated_at", "")),
        parents=[str(x) for x in (fm.get("parents") or [])],
        children=[str(x) for x in (fm.get("children") or [])],
        constraints=[str(x) for x in (fm.get("constraints") or [])],
        superseded_by=(str(fm["superseded_by"]) if fm.get("superseded_by") else None),
        realizes=realizes,
        related_docs=[str(x) for x in (fm.get("related_docs") or [])],
        risks=[str(x) for x in (fm.get("risks") or [])],
        tags=[str(x) for x in (fm.get("tags") or [])],
        intent=sections.get("Intent", "").strip(),
        success_criteria=success_criteria,
        rationale=sections.get("Rationale", "").strip(),
        alternatives_considered=alternatives,
        raw_frontmatter=fm,
        raw_body=body,
        sections=sections,
        source_path=source,
    )
    return goal


def parse_goal_file(path: Path | str) -> Goal:
    """파일에서 Goal 을 파싱한다."""

    p = Path(path)
    text = p.read_text(encoding="utf-8")
    return parse_goal_text(text, source=p)


def load_goals(directory: Path | str, pattern: str = "G-*.md") -> List[Goal]:
    """디렉토리에서 모든 Goal 파일을 평탄하게 로드한다.

    설계 §7.5 의 ID 범위 샤딩 ('0000-0099/' 등) 도 자동 지원하기 위해
    `**/G-*.md` 글로브를 함께 사용한다.
    """

    base = Path(directory)
    if not base.is_dir():
        raise FileNotFoundError(f"Goals 디렉토리 없음: {base}")

    files = sorted({*base.glob(pattern), *base.glob(f"**/{pattern}")})
    goals: List[Goal] = []
    for f in files:
        # 자동 생성 뷰 파일은 제외 (INDEX.md / TREE.md / graph.mmd 는 패턴 자체가 다름)
        if f.name in {"INDEX.md", "TREE.md"}:
            continue
        goals.append(parse_goal_file(f))
    return goals


def goals_by_id(goals: Iterable[Goal]) -> Dict[str, Goal]:
    """ID → Goal 사전. 중복 ID 는 GoalParseError."""

    out: Dict[str, Goal] = {}
    for g in goals:
        if g.id in out:
            raise GoalParseError(
                f"중복 Goal ID: {g.id} ({out[g.id].source_path} vs {g.source_path})"
            )
        out[g.id] = g
    return out
