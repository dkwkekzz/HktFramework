"""Intent 시스템 CLI 진입점.

현재 지원 커맨드:
    build-site   단일 HTML 사이트 생성 (검색 + 관계 네비 + 본문)
    validate     Intent 파일들 검증 (exit 0=통과, 1=에러, 2=파싱오류)

호출 예:
    python -m intentsys build-site \
        --intents-dir Docs/intents \
        --output Docs/intents/site.html

    python -m intentsys validate --intents-dir Docs/intents
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .parser import IntentParseError, load_intents
from .sitegen import generate_site
from .validator import validate


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


def cmd_validate(intents_dir: Path) -> int:
    """Intent 파일들을 검증한다.

    반환값:
        0  — 모든 검사 통과
        1  — 검증 오류 1건 이상
        2  — 파일 파싱 실패
    """
    try:
        intents = load_intents(intents_dir)
    except (IntentParseError, FileNotFoundError) as exc:
        print(f"파싱 오류: {exc}", file=sys.stderr)
        return 2

    errors = validate(intents)
    if not errors:
        print(f"✓ {len(intents)}개 Intent 모두 통과")
        return 0

    for err in errors:
        print(f"[{err.id}] {err.field}: {err.message}", file=sys.stderr)
    print(f"\n검증 실패: {len(errors)}개 오류", file=sys.stderr)
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="intentsys")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_site = sub.add_parser("build-site", help="단일 HTML 사이트 생성 (검색 + 관계 네비 + 본문)")
    p_site.add_argument("--intents-dir", type=Path, default=Path("Docs/intents"),
                        help="Intent 파일 디렉토리 (기본: Docs/intents)")
    p_site.add_argument("--output", type=Path, default=Path("Docs/intents/site.html"),
                        help="출력 HTML 경로 (기본: Docs/intents/site.html)")

    p_validate = sub.add_parser("validate", help="Intent 파일들 검증 (exit 0=통과, 1=에러, 2=파싱오류)")
    p_validate.add_argument("--intents-dir", type=Path, default=Path("Docs/intents"),
                            help="Intent 파일 디렉토리 (기본: Docs/intents)")

    args = parser.parse_args(argv)
    if args.cmd == "build-site":
        return cmd_build_site(args.intents_dir, args.output)
    if args.cmd == "validate":
        return cmd_validate(args.intents_dir)
    raise AssertionError(f"unreachable: argparse should reject unknown cmd {args.cmd!r}")


if __name__ == "__main__":
    sys.exit(main())
