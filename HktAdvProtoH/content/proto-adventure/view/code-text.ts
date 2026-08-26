// 의미 코드 → 플레이어 표시 문구 (결정 Layer 데이터).
// World 는 코드만 보낸다 — 불가 사유 코드, 행동 코드 등. 문구는 여기서 정한다.
// 미등록 코드는 코드 그대로 표시된다 — 표현 누락이 게임을 멈추지 않는다.
//
// **기반도 코드만 보낸다** (기반 부채 ② — 표시 문구를 사유 코드로 바꿔 팩에 회수).
// 명령 표면·조작 안내·자원 막대가 쓰던 말이 기반에 살아 있었고, 팩에 이미 있는 이 표와
// 같은 것이 두 곳에 있는 상태였다. 이제 기반은 `command.*` 코드를 부르고 말은 여기 있다 —
// 목록의 단일 출처는 `engine/view-kernel/presentation/command-presentation.ts` 의
// COMMAND_TEXT_CODES 이며, 덮지 못한 것은 `view/tests/command.spec.ts` 가 잡는다.
//
// 문장에 값이 끼는 자리는 `{}` 로 적는다 — 끼울 값은 기반이 데이터로 넘기고,
// 그 값이 문장의 **어디에** 어떤 말과 함께 서는지는 이 표가 정한다.

const CODE_TEXT: Record<string, string> = {
  // 불가 사유 (C001)
  // C023 CHANGED — **코드도 자리도 그대로다. 뜻이 옮겨갔다.**
  // 이전에는 "지니지 않았다" 였고 이제는 "걸지 않았다" 이다. 가방에 곡괭이를 지닌 채로
  // 이 문구를 보는 것이 그 Cycle 의 첫 관찰이다 (04 interactions.mine).
  'no-mining-tool': '채집 도구를 걸지 않았다',
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
  // 소지품과 사용 (C020) — **종류 이름도 문구 표에서 온다.** 규칙이 아니라 표시다.
  // 아이템 종류의 이름은 `item.` 을 앞에 붙여 둔다 — 같은 문자열이 다른 것을 뜻하는
  // 자리가 이미 있기 때문이다 (`stone` 은 아래에서 **광맥의 종류**다).
  // 표에 없는 종류는 코드 그대로 보인다 — 세계가 새 아이템을 정의해도 화면이 멈추지 않는다.
  'item.stone': '돌',
  'item.pickaxe': '곡괭이',
  // C024 — 두 번째로 걸 수 있는 물건. **표에 한 줄이 늘 뿐이다**
  'item.buckler': '손방패',
  // C023 — 걸어서 몸에 생긴 용도와 그것이 보태는 능력의 문구.
  // **표에 없으면 코드 그대로 보인다** — 세계가 새 용도나 새 능력을 보내도 화면은 멈추지 않고,
  // 그때 이 표에 한 줄이 는다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH 의 화면 쪽 자세).
  'use.mine': '채집',
  'stat.physicalAttack': '물리 공격',
  'stat.auraAttack': '오라 공격',
  'stat.armor': '물리 방어',
  'stat.resistance': '오라 방어',
  'stat.armorPenetration': '물리 관통',
  'stat.resistancePenetration': '오라 관통',
  'stat.criticalChance': '치명 가능성',
  'stat.criticalDamage': '치명 배율',
  'use-item': '쓰는 중',
  // 쓸 수 없는 사유 (C020)
  'unknown-item': '세계가 모르는 물건이다',
  'not-usable': '쓸 수 있는 물건이 아니다',
  'not-enough': '모자란다',
  // C022 — 자리
  'no-room': '자리가 없다 — 무엇을 덜어내야 한다',
  'no-way-back': '이걸 놓으면 되돌릴 수 없다',
  // ── C023 적용 ──────────────────────────────────────────────────────
  // `not-equippable` 은 **자리 탓이 아니다** — 그 물건이 걸리는 것이 아니라는 뜻이며,
  // 자리가 여섯이든 하나든 같은 답이다. 문구가 자리를 말하면 사람이 "다른 자리를
  // 보라" 로 읽는다 (03-world-semantic.md JUDGEMENT ②).
  'not-equippable': '걸 수 있는 물건이 아니다',
  'no-empty-slot': '걸 자리가 남지 않았다 — 무엇을 풀거나 바꿔 껴야 한다',
  // ── C024 교체 ──────────────────────────────────────────────────────
  // `no-occupied-slot` 은 **가방 탓이 아니다** — 걸어 둔 것이 없다는 뜻이며,
  // 그때 할 일은 덜어내는 것이 아니라 그냥 거는 것이다.
  'no-occupied-slot': '바꿔 낄 것이 걸려 있지 않다 — 그냥 걸면 된다',
  'slot-not-fit': '그 자리에는 걸리지 않는 물건이다',
  // `unknown-slot` 은 C023 이 푸는 쪽에 이미 세웠다 (아래) — 겪는 일이 하나이므로
  // 문구도 하나다. 교체가 그 사유를 함께 쓴다
  'slot-empty': '그 자리에 걸린 것이 없다',
  'unknown-slot': '그런 자리가 없다',
  'target-gone': '대상이 사라졌다',
  'target-downed': '이미 쓰러졌다',
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
  // ── 명령 표면이 쓰는 말 (기반 부채 ② — COMMAND_TEXT_CODES) ────────
  // 기반은 이 중 어느 것도 짓지 않는다. 무엇을 말해야 하는지만 코드로 부른다.
  'command.domain.entity': '존재의 이름',
  'command.domain.previous': '앞에서 고른 것이 정하는 값',
  'command.domain.value': '값',
  'command.state.on': '켜짐',
  'command.state.off': '꺼짐',
  // 이 명령이 어디로 가는가 — 걸었을 때 세계가 아는가 아닌가의 경계다
  'command.origin.world': '세계',
  'command.origin.observer': '내 화면',
  // 세계가 사유를 밝히지 않고 거절한 자리 — 말없이 회색으로만 서지 않게 한다
  'command.unavailable': '지금은 걸 수 없다',
  'command.omitted': '비우면 {}',
  'command.omitted.nothing': '없음',
  'command.next': '다음: {}',
  'command.close': '닫기',
  // 걸기 전에 알려 주는 것 — `{}` 에는 친 낱말이나 자리에 맞지 않은 값이 온다
  'command.no-such': '그런 명령이 없다 — {}',
  'command.takes-nothing': '{} 은 아무것도 받지 않는다',
  'command.out-of-range': '허용된 범위를 벗어난 값이다 — {}',
  'command.not-here': '그 자리에 넣을 수 없다 — {}',
  'command.leftover': '받지 않는 것이 남았다 — {}',
  'command.incomplete': '아직 다 적지 않았다',
  // ── 자원 막대의 이름 (기반 부채 ②) ────────────────────────────────
  // 기반의 self 패널이 `HP` · `CP` 를 직접 적던 자리다. 세계가 무엇을 자원으로
  // 삼는지는 팩의 일이므로 그 이름도 팩이 쥔다
  'self.health': 'HP',
  'self.energy': 'CP',
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

/**
 * 코드를 사람이 읽는 말로.
 *
 * `detail` 은 **문장에 끼울 값**이다 (친 낱말 · 범위 밖의 값 · 남은 낱말). 등록된 문구에
 * `{}` 가 있으면 그 자리에 들어가고, 없으면 값은 버려진다 — 문장이 값을 부르지 않는데
 * 뒤에 억지로 붙이면 말이 아니라 찌꺼기가 된다.
 *
 * 등록되지 않은 코드는 **코드 그대로**이며, 값이 있으면 코드 뒤에 붙는다 —
 * 표현 누락이 게임을 멈추지 않고, 무엇이 빠졌는지는 화면에 그대로 드러난다.
 */
export function codeText(code: string, detail?: string): string {
  const text = CODE_TEXT[code];
  if (text === undefined) return detail === undefined ? code : `${code}: ${detail}`;
  return detail === undefined ? text : text.replace('{}', detail);
}

/**
 * 같은 사유의 **짧은 표기** — 목록 안에서 쓴다.
 *
 * 문구가 둘인 이유는 자리가 둘이기 때문이다.
 *
 *   긴 문장   지금 하려는 **행동 하나**에 붙는다 (채집 프롬프트).
 *             그 순간 사람이 보고 있는 곳이므로 무엇을 해야 하는지까지 말해 준다
 *   짧은 표기 **목록**의 항목마다 붙는다 (소지품). 항목 수만큼 반복되므로
 *             길면 목록이 아니라 문단이 되고, 문단이 되면 아무도 읽지 않는다
 *
 * 표에 없으면 긴 문장이 그대로 나온다 — 짧은 말을 짓지 않는다. 사유가 사라지는 것보다
 * 줄이 긴 편이 낫고, 없는 말을 화면이 만들어 내는 것은 더 나쁘다.
 */
const SHORT_TEXT: Record<string, string> = {
  // 자리 (C022)
  'no-room': '자리 없음',
  'no-way-back': '되돌릴 수 없음',
  'not-equippable': '걸 수 없음',
  'no-empty-slot': '자리 없음',
  // C024
  'no-occupied-slot': '걸린 것 없음',
  'slot-not-fit': '자리 안 맞음',
  'slot-empty': '빈 자리',
  'unknown-slot': '없는 자리',
  // 대상 (C017)
  'no-target-selected': '대상 없음',
  'target-kind-mismatch': '이 대상엔 안 됨',
  'no-target': '대상 없음',
  // 거리·행동 (C001 · C002)
  'out-of-range': '너무 멀다',
  'action-busy': '행동 중',
  'deposit-depleted': '고갈됨',
  'no-mining-tool': '도구 안 걸림',
  // 아이템 (C020)
  'not-enough': '모자람',
  'not-usable': '쓸 수 없음',
  'unknown-item': '모르는 것',
  'target-gone': '대상이 사라짐',
  'target-downed': '이미 쓰러짐',
  // 기술 (C025) — 띠의 칸마다 붙는 자리이므로 짧아야 한다.
  // `action-busy` 는 위에 이미 있다 (같은 사유가 두 자리에서 같은 말을 한다).
  // `downed` 는 긴 문장 자체가 이미 짧으므로 두지 않는다 — 없는 말을 짓지 않는다.
  guarding: '막는 중',
  'insufficient-cp': '기력 모자람',
};

export function shortCodeText(code: string): string {
  return SHORT_TEXT[code] ?? codeText(code);
}
