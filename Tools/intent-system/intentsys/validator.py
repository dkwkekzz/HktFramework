"""Intent 검증기 — rules.json 을 단일 진실 원천으로 사용.

validate(intents) -> List[ValidationError]

검사 항목:
  - required_fields: id, title, status
  - id_pattern: ^I-\\d{4}$
  - valid_statuses: active / proposed / realized / abandoned
  - max_title_length: 200
  - refs_exist: parents / children 에 기재된 ID가 모두 존재해야 함
  - parent_child_bidirectional: parent 가 child 를 child 가 parent 를 상호 참조해야 함
  - dag_no_cycle: DFS 로 사이클 검출
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import List, NamedTuple

from .parser import Intent


class ValidationError(NamedTuple):
    id: str
    field: str
    message: str


_RULES_PATH = Path(__file__).parent / "rules.json"


def _load_rules() -> dict:
    return json.loads(_RULES_PATH.read_text(encoding="utf-8"))


def validate(intents: List[Intent]) -> List[ValidationError]:
    rules = _load_rules()
    errors: List[ValidationError] = []

    id_pattern = re.compile(rules.get("id_pattern", r"^I-\d{4}$"))
    required_fields = rules.get("required_fields", ["id", "title", "status"])
    valid_statuses = set(rules.get("valid_statuses", []))
    max_title_length = rules.get("max_title_length", 200)
    checks = rules.get("checks", {})

    all_ids = {it.id for it in intents}

    for it in intents:
        iid = it.id or "(unknown)"

        # --- required fields ---
        for field in required_fields:
            value = getattr(it, field, None)
            if value is None or str(value).strip() == "":
                errors.append(ValidationError(iid, field, f"필수 필드 누락: {field}"))

        # --- id pattern ---
        if it.id:
            if not id_pattern.match(it.id):
                errors.append(ValidationError(iid, "id", f"ID 형식 오류 (기대: {rules.get('id_pattern')}): {it.id!r}"))

        # --- status validity ---
        if valid_statuses and it.status and it.status not in valid_statuses:
            errors.append(ValidationError(iid, "status",
                          f"유효하지 않은 status: {it.status!r}. 허용값: {sorted(valid_statuses)}"))

        # --- title length ---
        if it.title and len(it.title) > max_title_length:
            errors.append(ValidationError(iid, "title",
                          f"title 이 {max_title_length}자를 초과함 ({len(it.title)}자)"))

        # --- refs_exist ---
        if checks.get("refs_exist"):
            for ref in it.parents:
                if ref not in all_ids:
                    errors.append(ValidationError(iid, "parents",
                                  f"존재하지 않는 parent ID: {ref!r}"))
            for ref in it.children:
                if ref not in all_ids:
                    errors.append(ValidationError(iid, "children",
                                  f"존재하지 않는 child ID: {ref!r}"))

    # --- parent_child_bidirectional ---
    if checks.get("parent_child_bidirectional"):
        intent_map = {it.id: it for it in intents}
        for it in intents:
            for child_id in it.children:
                child = intent_map.get(child_id)
                if child is None:
                    continue  # refs_exist 에서 이미 잡힘
                if it.id not in child.parents:
                    errors.append(ValidationError(it.id, "children",
                                  f"{child_id} 는 children 에 있지만, {child_id}.parents 에 {it.id!r} 가 없음"))
            for parent_id in it.parents:
                parent = intent_map.get(parent_id)
                if parent is None:
                    continue
                if it.id not in parent.children:
                    errors.append(ValidationError(it.id, "parents",
                                  f"{parent_id} 는 parents 에 있지만, {parent_id}.children 에 {it.id!r} 가 없음"))

    # --- dag_no_cycle (DFS) ---
    if checks.get("dag_no_cycle"):
        intent_map = {it.id: it for it in intents}
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {it.id: WHITE for it in intents}

        def dfs(node_id: str) -> bool:
            """True if cycle detected."""
            color[node_id] = GRAY
            node = intent_map.get(node_id)
            if node:
                for child_id in node.children:
                    if child_id not in color:
                        continue
                    if color[child_id] == GRAY:
                        return True
                    if color[child_id] == WHITE and dfs(child_id):
                        return True
            color[node_id] = BLACK
            return False

        for it in intents:
            if color[it.id] == WHITE:
                if dfs(it.id):
                    errors.append(ValidationError(it.id, "children",
                                  f"DAG 사이클 감지: {it.id} 에서 시작하는 순환 참조"))

    return errors
