#!/usr/bin/env python3
"""설계 문서의 원문 충실성 검증.

design/ 의 설계 문서가 사용자 원문에서 빠지거나 왜곡된 내용 없이 옮겨졌는지 검사한다.
원문 사본은 저장소에 두지 않는다 — 검증할 때 원문 파일을 인자로 넘긴다.

사용법:
    python3 tools/verify-docs.py mmo     <원문파일>   # Design-MMO.md 전문 대조
    python3 tools/verify-docs.py modules <원문파일>   # 모듈 분할 설계 장 단위 대조

mmo 모드
    Design-MMO.md 와 원문을 행 단위로 완전 대조한다. 불일치가 하나라도 있으면 실패.

modules 모드
    ① 커버리지  — 원문의 모든 행·표 셀이 문서 어딘가에 존재하는가
    ② 연속성    — 원문 각 장이 담당 문서의 「원문」 절에 순서까지 그대로 연속 유지되는가
    ③ 완전성    — 원문 28개 장 전체가 문서에 배정되었는가
"""
import re
import sys
import difflib
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 원문 장 번호 → 담당 문서
CHAPTER_MAP = {
    'design/Design-Modules.md': [1, 2, 7],
    'design/modules/00-Module-Contract.md': [3, 4, 5, 21, 24],
    'design/modules/01-Global-Invariants.md': [6],
    'design/modules/10-Phase-V-Verification.md': [8],
    'design/modules/11-Phase-K-Kernel.md': [9],
    'design/modules/12-Phase-S-World-State.md': [10],
    'design/modules/13-Phase-U-Subject.md': [11],
    'design/modules/14-Phase-G-Possibility.md': [12],
    'design/modules/15-Phase-I-Interaction.md': [13],
    'design/modules/16-Phase-R-Progression.md': [14],
    'design/modules/17-Phase-C-Complex-Subjects.md': [15],
    'design/modules/18-Phase-W-World-Compiler.md': [16],
    'design/modules/19-Phase-X-Spatial-Client.md': [17],
    'design/modules/20-Phase-N-Runtime.md': [18],
    'design/modules/21-Phase-A-Authoring.md': [19],
    'design/modules/30-Vertical-Slices.md': [20],
    'design/modules/40-Agent-Protocol.md': [22, 23],
    'design/modules/50-Project-Layout.md': [25],
    'design/modules/60-Traceability-And-Completion.md': [26, 27, 28],
}


def norm(s):
    """비교용 정규화 — 공백과 강조 기호만 제거한다 (내용은 손대지 않는다)."""
    s = unicodedata.normalize('NFC', s).replace('`', '').replace('**', '').replace('*', '')
    return re.sub(r'\s+', '', s)


def canon_lines(text):
    """행 단위 대조용 — 빈 행 제거, 표 셀 패딩 정규화."""
    out = []
    for raw in text.split('\n'):
        line = raw.strip()
        if not line:
            continue
        if line.startswith('|'):
            line = '|'.join(c.strip() for c in line.strip('|').split('|'))
            if set(line) <= set('- :|'):
                continue
        out.append(re.sub(r'[ \t]+', ' ', unicodedata.normalize('NFC', line)))
    return out


def unit_seq(text):
    """커버리지·연속성 대조용 단위 열. 표는 셀을 이어 하나의 단위로 만든다."""
    out = []
    for raw in text.split('\n'):
        line = raw.strip()
        if not line or set(line) <= set('-=# '):
            continue
        if line.startswith('|'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            if all(set(c) <= set('- :') for c in cells):
                continue
            out.append(norm('|'.join(cells)))
        else:
            out.append(norm(line))
    return [u for u in out if u]


def contiguous(sub, whole):
    n = len(sub)
    return any(whole[i:i + n] == sub for i in range(len(whole) - n + 1))


def verify_mmo(source_path):
    src = Path(source_path).read_text(encoding='utf-8')
    tgt = (ROOT / 'design/Design-MMO.md').read_text(encoding='utf-8')
    a, b = canon_lines(src), canon_lines(tgt)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    diffs = [op for op in sm.get_opcodes() if op[0] != 'equal']
    print(f"원본 유효행 {len(a)} / 문서 유효행 {len(b)}")
    for tag, i1, i2, j1, j2 in diffs:
        print(f"--- {tag} 원본[{i1}:{i2}] 문서[{j1}:{j2}]")
        for line in a[i1:i2]:
            print("   원본 -", line[:120])
        for line in b[j1:j2]:
            print("   문서 +", line[:120])
    print(f"불일치 구간 {len(diffs)} / 일치율 {sm.ratio():.4f}")
    return not diffs


def verify_modules(source_path):
    src = Path(source_path).read_text(encoding='utf-8')
    chapters = {}
    for part in re.split(r'\n(?=#{1,2} \d+\.)', src):
        m = re.match(r'#{1,2} (\d+)\.', part.strip())
        if m:
            chapters[int(m.group(1))] = part

    docs = {p: (ROOT / p).read_text(encoding='utf-8') for p in CHAPTER_MAP}
    joined = '\n'.join(docs.values())
    joined_units, joined_blob = set(unit_seq(joined)), norm(joined)

    # ① 커버리지
    missing = [u for u in unit_seq(src)
               if len(u) >= 2 and u not in joined_units and u not in joined_blob]
    print(f"① 커버리지: 원문 단위 {len(unit_seq(src))} / 미발견 {len(missing)}")
    for u in missing[:40]:
        print("   미발견 -", u[:120])

    # ② 연속성
    broken = []
    for path, chs in CHAPTER_MAP.items():
        m = re.search(r'\n## 원문\n(.*?)(?=\n## 파생 메모|\Z)', docs[path], re.S)
        body = unit_seq(m.group(1)) if m else []
        for ch in chs:
            if ch not in chapters:
                broken.append((ch, path, 'ABSENT_IN_SOURCE'))
            elif not contiguous(unit_seq(chapters[ch]), body):
                broken.append((ch, path, 'NOT_CONTIGUOUS'))
    print(f"② 연속성: 검사한 장 {sum(len(v) for v in CHAPTER_MAP.values())} / 깨진 장 {len(broken)}")
    for ch, path, why in broken:
        print(f"   {why} 원문 {ch}장 → {path}")

    # ③ 완전성
    assigned = {c for v in CHAPTER_MAP.values() for c in v}
    unassigned = sorted(set(chapters) - assigned)
    print(f"③ 완전성: 원문 장 {len(chapters)} / 미배정 {len(unassigned)} {unassigned}")

    return not missing and not broken and not unassigned


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ('mmo', 'modules'):
        print(__doc__)
        return 2
    ok = (verify_mmo if sys.argv[1] == 'mmo' else verify_modules)(sys.argv[2])
    print("\n결과:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
