"""sitegen.py — 단일 HTML 사이트 생성 스모크 테스트."""

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
    # 데이터 임베드 — application/json 스크립트
    m = re.search(r'<script type="application/json" id="goal-data">(.*?)</script>',
                  html, re.DOTALL)
    assert m is not None
    payload = json.loads(m.group(1).replace("<\\/", "</"))
    assert payload["total"] == len(goals)
    ids = [g["id"] for g in payload["goals"]]
    assert "G-0001" in ids
    assert "G-0142" in ids
    # Mermaid 소스가 같이 들어있어야 클라이언트에서 렌더 가능
    assert "graph TD" in payload["mermaid"]


def test_generate_site_escapes_script_close_tag_in_json() -> None:
    """``</script>`` 가 JSON 페이로드 내부에 그대로 들어가면 HTML 파서가 깨진다."""
    goals = load_goals(FIXTURES)
    html = generate_site(goals)
    # script 종료 태그는 정확히 한 번만 — `</script>` 데이터 영역에 있어선 안 됨.
    # 안전 이스케이프(`<\/`) 적용 후엔 시작 스크립트와 종료 스크립트가 균형.
    open_count = html.count('<script type="application/json"')
    close_count = html.count("</script>")
    # open 1개 (json) + open 2개 (mermaid CDN, 본문 IIFE) = 3개
    # 그에 대응하는 close 도 3개. 그 외에 데이터 안에 노출된 </script> 가 있으면 안 됨.
    assert close_count == open_count + 2  # mermaid CDN + 본문 IIFE
