"""Intent 시스템 CLI 진입점.

현재 지원 커맨드:
    build-site   단일 HTML 사이트 생성 (검색 + 관계 네비 + 본문)

호출 예:
    python -m intentsys build-site \
        --intents-dir Docs/intents \
        --output Docs/intents/site.html
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .parser import IntentParseError, load_intents
from .sitegen import generate_site


def cmd_build_site(intents_dir: Path, output: Path) -> int:
    try:
        intents = load_intents(intents_dir)
    except (IntentParseError, FileNotFoundError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 2
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(generate_site(intents), encoding="utf-8")
    print(f"생성 완료: {output} ({len(intents)} intents)")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="intentsys")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_site = sub.add_parser("build-site", help="단일 HTML 사이트 생성 (검색 + 관계 네비 + 본문)")
    p_site.add_argument("--intents-dir", type=Path, default=Path("Docs/intents"),
                        help="Intent 파일 디렉토리 (기본: Docs/intents)")
    p_site.add_argument("--output", type=Path, default=Path("Docs/intents/site.html"),
                        help="출력 HTML 경로 (기본: Docs/intents/site.html)")

    args = parser.parse_args(argv)
    if args.cmd == "build-site":
        return cmd_build_site(args.intents_dir, args.output)
    raise AssertionError(f"unreachable: argparse should reject unknown cmd {args.cmd!r}")


if __name__ == "__main__":
    sys.exit(main())
