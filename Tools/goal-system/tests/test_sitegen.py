"""sitegen.py — 단일 HTML 사이트 (외부 의존 0) 스모크 테스트."""

from __future__ import annotations

import json
import re
from pathlib import Path

from goalsys.parser import load_goals
from goalsys.sitegen import generate_site


FIXTURES = Path(__file__).parent / "fixtures"


def test_generate_site_embeds_goal_data() -> None:
    goals = load_goals(FIXTURES)
    html = generate_site(goals, generated_at="2026-05-04T00:00:00")
    # 기본 골격
    assert "<!doctype html>" in html
    assert "Goal Browser" in html
    # 데이터 임베드
    m = re.search(r'<script type="application/json" id="goal-data">(.*?)</script>',
                  html, re.DOTALL)
    assert m is not None
    payload = json.loads(m.group(1).replace("<\\/", "</"))
    assert payload["total"] == len(goals)
    ids = [g["id"] for g in payload["goals"]]
    assert "G-0001" in ids
    assert "G-0142" in ids


def test_generate_site_has_no_external_dependencies() -> None:
    """오프라인 100% 동작을 위해 외부 CDN 참조가 없어야 한다."""
    goals = load_goals(FIXTURES)
    html = generate_site(goals)
    assert "cdn.jsdelivr" not in html
    assert "cdnjs" not in html
    assert "unpkg" not in html
    assert "mermaid" not in html.lower()


def test_generate_site_escapes_script_close_tag_in_json() -> None:
    """``</script>`` 가 JSON 페이로드 내부에 그대로 들어가면 HTML 파서가 깨진다."""
    goals = load_goals(FIXTURES)
    html = generate_site(goals)
    open_count = html.count('<script type="application/json"')
    close_count = html.count("</script>")
    # JSON 데이터 script 1개 + 본문 IIFE script 1개 = open 1, close 2 — IIFE 가 inline 이라
    # 닫는 태그 하나 더 카운트됨.
    assert close_count == open_count + 1
