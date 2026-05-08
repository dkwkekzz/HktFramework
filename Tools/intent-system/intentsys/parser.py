"""Intent 파일 파서 — YAML frontmatter + Markdown body.

Goal 파서와 형태는 같지만 Intent 스키마는 의도적으로 작다:
    - frontmatter: id, title, status, created_at, updated_at, parents, children, tags?, goals?
    - body: ## Intent 섹션만

success_criteria / realizes / constraints / alternatives_considered 는 다루지 않는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import yaml


class IntentParseError(ValueError):
    def __init__(self, message: str, source: Optional[Path] = None) -> None:
        prefix = f"[{source}] " if source is not None else ""
        super().__init__(f"{prefix}{message}")
        self.source = source


@dataclass
class Intent:
    id: str
    title: str
    status: str
    created_at: str
    updated_at: str
    parents: List[str] = field(default_factory=list)
    children: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    goals: List[str] = field(default_factory=list)  # leaf Intent → Goal 다리 (선택)
    intent: str = ""
    raw_frontmatter: Dict[str, Any] = field(default_factory=dict)
    source_path: Optional[Path] = None


_FRONTMATTER_RE = re.compile(
    r"\A---\s*\r?\n(?P<fm>.*?)\r?\n---\s*\r?\n?(?P<body>.*)\Z",
    re.DOTALL,
)
_H2_RE = re.compile(r"^##\s+(?P<title>.+?)\s*$", re.MULTILINE)


def _split_sections(body: str) -> Dict[str, str]:
    sections: Dict[str, str] = {}
    matches = list(_H2_RE.finditer(body))
    for idx, match in enumerate(matches):
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(body)
        title = match.group("title").strip()
        sections[title] = body[start:end].strip("\n")
    return sections


def _split_frontmatter(text: str) -> Tuple[Dict[str, Any], str]:
    match = _FRONTMATTER_RE.match(text)
    if not match:
        raise IntentParseError("YAML frontmatter (`---` 블록) 가 없다")
    try:
        fm = yaml.safe_load(match.group("fm")) or {}
    except yaml.YAMLError as exc:
        raise IntentParseError(f"frontmatter YAML 파싱 실패: {exc}") from exc
    if not isinstance(fm, dict):
        raise IntentParseError(
            f"frontmatter 는 YAML 매핑이어야 한다. 실제: {type(fm).__name__}"
        )
    return fm, match.group("body")


def parse_intent_text(text: str, source: Optional[Path] = None) -> Intent:
    try:
        fm, body = _split_frontmatter(text)
    except IntentParseError as exc:
        raise IntentParseError(str(exc), source=source) from exc

    sections = _split_sections(body)

    return Intent(
        id=str(fm.get("id", "")),
        title=str(fm.get("title", "")),
        status=str(fm.get("status", "")),
        created_at=str(fm.get("created_at", "")),
        updated_at=str(fm.get("updated_at", "")),
        parents=[str(x) for x in (fm.get("parents") or [])],
        children=[str(x) for x in (fm.get("children") or [])],
        tags=[str(x) for x in (fm.get("tags") or [])],
        goals=[str(x) for x in (fm.get("goals") or [])],
        intent=sections.get("Intent", "").strip(),
        raw_frontmatter=fm,
        source_path=source,
    )


def parse_intent_file(path: Path | str) -> Intent:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    return parse_intent_text(text, source=p)


def load_intents(directory: Path | str, pattern: str = "I-*.md") -> List[Intent]:
    base = Path(directory)
    if not base.is_dir():
        raise FileNotFoundError(f"Intents 디렉토리 없음: {base}")
    files = sorted({*base.glob(pattern), *base.glob(f"**/{pattern}")})
    out: List[Intent] = []
    for f in files:
        if f.name in {"INDEX.md", "TREE.md"}:
            continue
        out.append(parse_intent_file(f))
    return out


def intents_by_id(intents: Iterable[Intent]) -> Dict[str, Intent]:
    out: Dict[str, Intent] = {}
    for i in intents:
        if i.id in out:
            raise IntentParseError(
                f"중복 Intent ID: {i.id} ({out[i.id].source_path} vs {i.source_path})"
            )
        out[i.id] = i
    return out
