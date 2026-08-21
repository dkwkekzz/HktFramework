// 의미 코드 → 플레이어 표시 문구 (결정 Layer 데이터).
// World 는 코드만 보낸다 — 불가 사유 코드, 행동 코드 등. 문구는 여기서 정한다.
// 미등록 코드는 코드 그대로 표시된다 — 표현 누락이 게임을 멈추지 않는다.

const CODE_TEXT: Record<string, string> = {
  // 불가 사유 (C001)
  'no-mining-tool': '곡괭이가 없다',
  'out-of-range': '너무 멀다 — 가까이 이동하자',
  'deposit-depleted': '광맥이 고갈되었다',
  // 불가 사유 (C002)
  'action-busy': '지금 하는 행동이 끝나야 한다',
  'no-target': '대상이 없다',
  'out-of-bounds': '더 갈 수 없는 곳이다',
  // 행동 코드 (C002)
  idle: '대기',
  move: '이동',
  attack: '공격',
  mine: '채굴',
  hit: '피격',
  // 행동 코드 (C007)
  'heavy-attack': '강공격',
  downed: '쓰러짐',
  // 불가 사유 (C007)
  'insufficient-cp': '기력이 모자란다',
  // 둘 사이의 태도 (C018) — 세계가 보내는 갈래 셋
  hostile: '적대',
  neutral: '중립',
  friendly: '우호',
  // 닿았으나 성립하지 않은 사유 (C018)
  'not-hostile': '적대가 아니다',
  // 기술의 구간과 끊김 (C019) — 선딜만 화면에 뜬다 (phase-presentation 의 결정 2)
  startup: '준비!',
  active: '나감',
  recovery: '거둠',
  cancelled: '끊김',
  // 이동 모드 (C007)
  walk: '걷기',
  run: '달리기',
  // 행동 코드 · 피해 방식 (C012)
  'aura-strike': '오라 일격',
  physical: '물리',
  aura: '오라',
  // 방식이 고른 능력의 이름 (C012)
  physicalAttack: '물리 공격',
  auraAttack: '오라 공격',
  armor: '물리 방어',
  resistance: '오라 방어',
  // 관통 둘 (C013) · 치명타 둘 (C015) — 바꿀 수 있는 속성 목록에 세계가 실어 보내는 이름들
  armorPenetration: '물리 관통',
  resistancePenetration: '오라 관통',
  criticalChance: '치명타 확률',
  criticalDamage: '치명타 배율',
  // 어느 쪽이 더 단단한가 (C012) — 세계의 판정을 사람 말로 옮긴다.
  // 단단한 쪽이 아니라 **무른 쪽**을 말한다 — 플레이어가 고르는 것은 칠 방향이다
  'physical-tougher': '오라에 약하다',
  'aura-tougher': '물리에 약하다',
  even: '치우침 없음',
  // 불가 사유 — 막기 (C011)
  guarding: '막는 중에는 휘두를 수 없다',
  'guard-broken': '방어가 무너져 아직 다시 들 수 없다',
  // 불가 사유 — 속성 변경 (C007 R2)
  'debug-closed': '이 세계는 속성 변경을 허용하지 않는다',
  'unknown-target': '그런 존재가 없다',
  'unknown-attribute': '그런 속성이 없다',
  'value-out-of-range': '허용된 범위를 벗어난 값이다',
  // 불가 사유 — 요청 수용 경로 (C009 — 세계가 이제 이 사유들도 되돌려 준다)
  'unknown-interaction': '그런 명령이 없다',
  'unknown-observer': '세계가 나를 알지 못한다',
  'missing-attribute': '무엇을 바꿀지 실리지 않았다',
  'missing-position': '어디로 갈지 실리지 않았다',
  'missing-target': '대상이 실리지 않았다',
  'missing-mode': '어떤 걸음인지 실리지 않았다',
  // 명령이 무엇을 하는가 (C009 — Command.Effect)
  'set-attribute': '존재의 속성 값을 바꾼다',
  'collider-observe': '몸과 휘두름의 충돌체를 보인다',
  'attribute-inspect': '존재의 모든 속성을 그 몸 위에 펼친다',
  // 명령이 받는 자리 (C009 — Parameter.Id)
  'param:target': '대상',
  'param:attribute': '속성',
  'param:value': '값',
  // 비워 두면 무엇이 되는가 (C009 — Parameter.OmittedMeaning)
  'omitted:self': '내 몸',
  // ── 살펴봄 (C014) ──
  // 행동 코드
  observe: '살펴봄',
  // 가려진 항목의 이름 — 세계가 보낸 concealed 의 원소들이다.
  // 무엇이 가려졌는지를 사람 말로 옮기기만 한다. 목록을 여기서 만들지 않는다
  combatStats: '겨루는 힘',
  versusObserver: '나에게 읽히는 방어',
  defenseShape: '약점',
  // 왜 비어 있는가 (Attributes.UnacquaintedReason)
  // C016 — 통찰이 미치지 못한 자리도 이 사유다. 그 자리도 살펴보면 열리므로
  // 틀린 말이 아니며, 사유는 "무엇을 하면 열리는가" 를 말한다 (03 NOTE ④)
  'not-observed': '아직 살펴보지 않았다',
  // 불가 사유 — 살펴봄
  // C016 — 뜻이 "더 열 자리가 없다" 로 넓어졌다. 살펴본 존재뿐 아니라
  // 통찰이 세 문턱을 모두 넘은 존재에도 나온다 (04 interactions.observe)
  'already-known': '이미 알고 있다',
  // C017 CHANGED — 이 사유가 나오는 자리가 살펴봄에서 **고르기**로 옮겨갔다.
  // 뜻은 그대로이고 문구가 그 자리를 따라간다
  'target-is-self': '자기 자신은 고를 수 없다',
  'no-such-target': '그런 존재가 없다',
  'no-body': '세계에 내 몸이 없다',
  'not-known': '아직 모르는 존재다',
  'no-observer': '세계가 나를 알지 못한다',
  // ── 대상 지목 (C017) ──
  // 불가 사유 — 대상을 정해야 하는 행동이 고른 것을 읽을 때
  'no-target-selected': '먼저 대상을 고르자',
  'target-kind-mismatch': '이 대상에게는 할 수 없다',
  // interaction 이름 — 명령·안내에 쓰인다
  'select-target': '대상을 고른다',
  'clear-target': '고른 대상을 푼다',
  // 광맥의 종류 — 이름이 없는 존재를 대상 자리에서 부르는 말 (target-presentation)
  stone: '돌 광맥',
  // 광맥의 상태 (C001) — 대상 자리의 "지금" 줄로 읽힌다. 몸의 행동 코드와 같은 자리이며,
  // 광맥에는 행동이 아니라 상태가 온다
  available: '캘 수 있다',
  depleted: '고갈되었다',
  // 명령이 무엇을 하는가 (Command.Effect)
  'forget-acquaintance': '이 존재를 다시 모르는 상태로 되돌린다',
  // 비워 두면 무엇이 되는가
  'omitted:all-known': '알고 있는 전부',
};

export function codeText(code: string): string {
  return CODE_TEXT[code] ?? code;
}
