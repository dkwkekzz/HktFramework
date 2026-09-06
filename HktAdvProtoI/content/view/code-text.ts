// 의미 코드 → 플레이어 표시 문구 (결정 Layer 데이터).
// World 는 코드만 보낸다 — 불가 사유 코드, 행동 코드 등. 문구는 여기서 정한다.
// 미등록 코드는 코드 그대로 표시된다 — 표현 누락이 게임을 멈추지 않는다.
//
// 재료 계통의 코드들만은 **키를 직접 적지 않고 데이터의 이름을 그대로 받아 쓴다** (C011).
// 그 이름의 원본은 content/regions 하나이고(soilStainTag 의 주석: "데이터도 표현도 이
// 함수 하나로 이름을 짓는다"), 여기 사본을 두면 데이터가 태그를 옮겼을 때 화면이 말을
// 잃는 것이 아니라 **옛 말을 계속 한다** — 그쪽이 훨씬 나쁘다.

import {
  BIO_ORE,
  BLOCK_COLLAPSED,
  FORM_MOLT_LITTER,
  FORM_OUTCROP,
  FORM_ROOT_NODULE,
  FORM_SPOIL_PILE,
  ORE_EATER_MOLT,
  RECOVERY_STALLED,
  soilStainTag,
} from '../regions/index';

const CODE_TEXT: Record<string, string> = {
  // 불가 사유
  'no-mining-tool': '곡괭이가 없다',
  'out-of-range': '너무 멀다 — 가까이 이동하자',
  // 세계가 그 원천을 알지 못한다 (C011 R1 · R2 의 거절)
  'unknown-source': '그런 원천이 없다',
  // 다 캐 간 원천이다 (C012 R1 의 거절). **몇 번 캘 수 있었는지도 언제 돌아오는지도 말하지
  // 않는다** — 실려 오지 않는 것이고(spec Observable), 관찰된 사실은 "지금 여기 없다" 하나다
  'source-depleted': '남은 것이 없다',
  // 아직 되돌아오는 중인 원천이다 (C013 R3 의 거절). **얼마나 남았는지도 무엇이 그것을
  // 되돌리는지도 말하지 않는다** — 실려 오지 않는 것이고(spec Observable), 관찰된 사실은
  // "지금은 아직 아니다" 하나다. 언제 돌아오는지는 흙과 그림이 예보할 뿐이다 (§5.6)
  'source-recovering': '아직 되돌아오는 중이다',
  // 불가 사유
  'action-busy': '지금 하는 행동이 끝나야 한다',
  'no-target': '대상이 없다',
  'out-of-bounds': '더 갈 수 없는 곳이다',
  // 행동 코드
  idle: '대기',
  move: '이동',
  attack: '공격',
  mine: '채굴',
  hit: '피격',
  // 행동 코드
  'heavy-attack': '강공격',
  downed: '쓰러짐',
  // 불가 사유
  'insufficient-cp': '기력이 모자란다',
  // 이동 모드
  walk: '걷기',
  run: '달리기',
  // 불가 사유 — 속성 변경
  'debug-closed': '이 세계는 속성 변경을 허용하지 않는다',
  'unknown-target': '그런 존재가 없다',
  'unknown-attribute': '그런 속성이 없다',
  'value-out-of-range': '허용된 범위를 벗어난 값이다',
  // 불가 사유 — 요청 수용 경로 (세계가 이제 이 사유들도 되돌려 준다)
  'unknown-interaction': '그런 명령이 없다',
  'unknown-observer': '세계가 나를 알지 못한다',
  'missing-attribute': '무엇을 바꿀지 실리지 않았다',
  'missing-position': '어디로 갈지 실리지 않았다',
  'missing-target': '대상이 실리지 않았다',
  'missing-mode': '어떤 걸음인지 실리지 않았다',
  // 깊이 태그 (C001 — hud region.depth 의 값. L2-World-Concept §3.2)
  civil: '문명권',
  outer: '문명의 경계를 넘었다',
  // 문명권 → 경계 → 그 다음 한 걸음. 여기서부터는 아무도 돌보지 않는다 (C002)
  wild: '아무도 돌보지 않는 야생',
  // 야생 다음 한 걸음 — 기존 생물학·자연법칙으로 설명하기 어려워지는 곳 (§3.2 · C003)
  deep: '법칙이 낯설어지는 심부',
  // 불가 사유 — 건너기 (RULE-REGION-TRANSIT-001)
  'unknown-connector': '그런 길이 없다',
  'wrong-region': '여기서 갈 수 있는 길이 아니다',
  // 닫힌 Connector (C002). 여는 법은 이 세계에 아직 없다 — 그래서 무엇이 잠갔는지도 말하지 않는다
  'connector-inactive': '잠겨 있다',
  // 아직 짓지 않은 곳(frontier). 세계의 끝이 아니라 "아직" 이다 — 목적지는 여전히 밝히지 않는다
  'region-not-built': '아직 갈 수 없는 곳이다',
  // 불가 사유 — 돌아갈 자리가 없는 방 (C009 RULE-EMERGENCY-RETURN-001 의 ELSE).
  // 명령이 고장난 것이 아니라 **이 방에 그 자리가 없다**는 것이 읽혀야 한다 — 그래야
  // 다른 방에서는 걸린다는 것이 같은 문구에서 나온다 (비상 자리는 방의 성질이다)
  'no-emergency-exit': '이 방에는 돌아갈 자리가 없다',
  // 내 데이터와 세계의 방이 다르다 (region.hash 대조)
  'region.hash-mismatch': '세계와 다른 땅을 보고 있다',
  // 불가 사유 — 땅이 막는다 (C006 RULE-MOVE-001 의 traversable 전제).
  // 둘 다 세계의 대답이며 몸의 자리는 바뀌지 않는다. 왜 막혔는지를 **땅의 성질**로 말한다 —
  // "갈 수 없다" 가 아니라 "가파르다 · 깊다" 여야 다음에 어디로 걸을지가 화면에서 읽힌다.
  'too-steep': '너무 가파르다', // Play §4 막힘이 준 말 그대로
  'deep-water': '물이 너무 깊다', // 같은 어법 — 땅(물)의 성질 하나로 끝나는 한 줄
  // 무너져 내린 자리 (C012 R3 · R4 — 이동의 거절이자 그 자리의 막는 것).
  // 위의 둘과 같은 어법이되 **땅의 성질이 아니라 겪은 일**이다: 가파른 곳은 언제나
  // 가팔랐지만 여기는 그렇게 된 것이다. 무엇이 무너뜨렸는지는 말하지 않는다 —
  // 그 옆에 선 원천의 그림이 이미 그것을 말하고 있고, 잇는 것은 관찰자의 일이다
  [BLOCK_COLLAPSED]: '무너져 내려앉았다',
  // ── 지목한 자리가 답하는 말 (C026) ────────────────────────────
  //
  // 판에 서는 값은 전부 **이미 있는 코드**를 옮긴 것이다 — 새 의미를 만들지 않는다.
  // 표면 태그 넷은 땅을 컴파일하는 규칙 표(content/regions/terrain-rules.ts)의 이름이고,
  // 여기서 처음 사람이 읽는 말이 된다: 화면은 이 넷을 색으로만 갈라 놓았을 뿐 여태
  // 이름을 불러 준 적이 없다 (terrain-presentation 의 SURFACE_COLORS).
  flat: '평지',
  slope: '비탈',
  steep: '급경사',
  wet: '젖은 땅',
  // 지날 수 있는가 — **사유는 따로 뜬다** (too-steep · deep-water · passage-closed).
  // 그래서 이 둘은 판정 하나만 말하고 이유를 겸하지 않는다
  'place.passable': '지날 수 있다',
  'place.impassable': '지날 수 없다',
  // 통로가 지금 어떤가. 모름을 닫힘으로 적지 않는다 — 세계가 하지 않은 말이다
  // (PASSAGE_UNKNOWN_ZONE 이 색에서 지키는 것과 같은 구분)
  'place.passage.open': '열려 있다',
  'place.passage.closed': '닫혀 있다',
  'place.passage.unknown': '알 수 없다',
  // 판의 제목 — 자리에는 이름이 없으므로 이 말 하나이고, 어느 자리인지는 좌표가 말한다
  'target.place': '지목한 자리',
  // ── 존재가 답하는 말 (C027) ──────────────────────────────────
  //
  // 아무것도 지목하지 않았을 때 판이 지는 것 — 지목한 자리가 아니라 **내 발밑**이다.
  // 제목이 그것을 말해야 판이 무엇에 대한 답인지 갈린다 (C027 SPEC-005)
  'target.standing': '내가 선 자리',
  // 이름 없는 것의 이름 ① 종류(entity.kind).
  // 세계는 이 코드들을 이미 싣고 있었고 화면은 그것을 색으로만 갈라 놓았다 —
  // 여기서 처음 사람이 읽는 말이 된다 (표면 태그 넷이 C026 에서 그랬던 것과 같다).
  // 방 사이 전이의 일곱은 region-presentation 의 TRANSITION_TINTS 가 색으로 적어 둔 뜻 그대로다.
  road: '길',
  trail: '오솔길',
  door: '문',
  pass: '고개',
  interaction: '들어감',
  falling: '추락',
  river: '물길',
  // 재료의 자연 형태 (entity.kind — C011). 같은 계통이 자리마다 다른 형태로 난다.
  // 판의 제목이 이 말이다 — 지목하면 그것이 **무엇으로 보이는가**가 먼저 온다.
  // 쓰임은 한 글자도 없다 (spec SPEC-002 경계 · S10): 관찰된 것만 적는다
  [FORM_OUTCROP]: '광맥의 노두',
  [FORM_ROOT_NODULE]: '거목의 부푼 뿌리혹',
  [FORM_MOLT_LITTER]: '나무 밑동에 흩어진 껍질 조각',
  [FORM_SPOIL_PILE]: '헐린 선광 더미',
  // 재료의 이름 (Material Seed 코드 — C011). 소지품 줄의 이름표가 이 말이다.
  // **무엇에 쓰는지는 여기에도 어디에도 없다**
  [BIO_ORE]: '생체 광석',
  [ORE_EATER_MOLT]: '광식충 허물',
  // 사람·짐승의 종류 (CharacterKind) — kind-presentation · character-catalog 와 같은 이름들
  wanderer: '방랑자',
  'rabbit-swordsman': '토끼 검사',
  // 이름 없는 것의 이름 ② 역할(entity.role) — 종류마저 모를 때 마지막으로 남는 표
  'resource-source': '재료의 원천',
  'region-exit': '출구 표식',
  // 존재가 지금 하는 일 — 사람의 행동 코드(idle · move · mine …)는 위에 이미 있고,
  // 여기 넷은 사람이 아닌 것들의 상태다. 세계가 보내던 코드에 말을 줄 뿐이다
  available: '남아 있다', // 원천이 아직 그 자리에 있다
  depleted: '바닥났다',
  // C013 — 세계가 그것을 되돌리고 있다. **언제 끝나는지 적지 않는다** (남은 시간도 진행도
  // 실려 오지 않는다). 그림과 흙이 그 다음을 말하고, 판은 지금이 어느 때인지만 말한다
  recovering: '되돌아오는 중이다',
  // 그 원천에 지금 걸린 것 (C012 R6 — entity.conditions 의 코드. 판의 '걸린 것' 줄이 이 말이다).
  // **무엇에 매달렸는지도 언제 풀리는지도 적지 않는다** — 세계가 싣는 것은 코드 하나이고,
  // 무엇이 이것을 멎게 했는지는 같은 방에서 관찰자가 잇는다 (흔적을 잇게 한 것과 같은 규율)
  [RECOVERY_STALLED]: '되돌아옴이 멎었다',
  open: '열려 있다', // 출구 표식 — 건널 수 있는 길이다
  locked: '잠겨 있다',
  // ── 판에 남는 기록이 쓰는 말 (C028) ──────────────────────────
  //
  // 얼마 전 일인가 — 세계 시각이 초이므로 초로 적는다 (strikes.since · rearrangedAt 이
  // 나이를 재는 그 값과 같은 단위다). 어법은 이어짐 표의 `link.since-last.value`
  // ('{}ms 전') 와 같은 계열이다 — 값 하나와 "전" 뿐이고 문장을 짓지 않는다.
  //
  // **이 한 줄이 나이를 적는 유일한 말이다.** 기록의 줄도, 판의 규칙 줄에 실리는 마지막
  // 재배열도 같은 코드를 부른다 (answer-log 의 agoText) — 같은 값이 두 자리에서 다르게
  // 적히면 둘 중 하나를 믿을 수 없다
  'ago.seconds': '{}초 전',
  // 지목하는 법 (C027 R6) — 보조키의 이름은 pointer-rules 의 원본에서 끼워진다.
  // 어법은 조작 안내의 기존 줄들과 같다 ("이름: 키")
  'hint.designate': '지목: {} + 클릭',
  // 불가 사유 — 통로가 막는다 (C008 RULE-MOVE-001 의 셋째 전제).
  // 위의 둘과 같은 어법이되 **땅의 성질이 아니라 지금의 상태**다: 가파른 곳은 언제나 가파르지만
  // 이 길은 지금 닫혀 있을 뿐이다. "갈 수 없다" 가 아니라 "닫혀 있다" 여야 다시 열릴 수 있다는
  // 것이 문구에서 읽히고, 그것이 이 Play 가 관찰시키려는 것이다.
  'passage-closed': '길이 닫혀 있다',
  // 길이 바뀐 순간 (C008). 무엇이 왜 바뀌었는지는 말하지 않는다 — 압력이 원인이라는 것은
  // HUD 의 압력 줄과 함께 보고 관찰자가 잇는 것이고, 세계가 답을 먼저 주면 이 Play 가 없다
  'maze-rearranged': '길이 바뀌었다',
  // 안전한 이유 (C006 R4 — settlement/condition 태그). Play §4 이해:
  // "산맥이 막고 · 강이 먹이고 · 거목이 물린다". 셋은 **왜 여기에 사람이 사는가** 의 답이며
  // (Concept W2: 안전한 구역을 칠하는 것이 아니라 안전할 수 있는 조건을 적는다),
  // 겹치면 셋 다 뜬다 — 하나로 줄이면 "조건이 모여서 도시가 된다" 가 화면에서 사라진다.
  'condition:ridge': '산맥이 막는다', // 외부 생물의 이동 차단 (Concept §3)
  'condition:river': '강이 먹인다', // 식수 + 농업 (Concept §3)
  'condition:tree': '거목이 포식자를 물린다', // 백색 거목 둘레에는 포식자가 오지 않는다 (Concept §3 · §3.2)
  // 조건 셋이 모인 자리 — 그래서 사람이 산다. 조건(왜)과 결과(그래서)를 다른 말로 둔다
  city: '사람이 사는 자리',
  // 흙의 변색 다섯 (C011 — trace layer 의 soil-stain 태그. 물었을 때 판의 "흙" 줄이 이 말이다).
  //
  // **짙기의 사다리 한 벌이다** — 다섯 마디가 한 줄로 세워졌을 때 어느 쪽이 더 짙은지가
  // 말만 읽고도 갈려야 한다 (Playable Goal: 짙어지는 쪽을 따라간다). 그래서 다섯이 같은
  // 축 하나(흙이 얼마나 물들었는가)만 말하고 다른 사실을 섞지 않는다.
  //
  // **수를 적지 않는다.** 단계는 데이터의 것이고, 관찰자가 보는 것은 흙뿐이다 —
  // "3단계" 라고 적는 순간 세계에 없는 눈금이 생기고 따라갈 것이 색이 아니라 숫자가 된다.
  // 무엇이 그렇게 만들었는지도 말하지 않는다 (그것을 잇는 것이 이 Play 다).
  [soilStainTag(1)]: '흙 색이 조금 다르다',
  [soilStainTag(2)]: '흙에 붉은 기가 돈다',
  [soilStainTag(3)]: '흙이 붉게 물들었다',
  [soilStainTag(4)]: '붉은 흙이 검게 짙어졌다',
  [soilStainTag(5)]: '흙이 검붉게 절었다',
  // 명령이 무엇을 하는가 (Command.Effect)
  'set-attribute': '존재의 속성 값을 바꾼다',
  // 돌아가기 (C009 RULE-EMERGENCY-RETURN-001). **방을 건너지 않는다** — 같은 방 안의
  // 비상 자리로 몸만 옮기는 것이므로 "나간다" 가 아니라 "돌아간다" 여야 한다.
  // 어느 자리인지는 방마다 다른 데이터이므로 말하지 않는다 (미로의 것은 입구지만,
  // 그 사실을 문구가 미리 알려 주면 세계가 하지 않은 말이 된다)
  'emergency-return': '이 방의 비상 자리로 돌아간다',
  'collider-observe': '몸과 휘두름의 충돌체를 보인다',
  'attribute-inspect': '존재의 모든 속성을 그 몸 위에 펼친다',
  // 명령이 받는 자리 (Parameter.Id)
  'param:target': '대상',
  'param:attribute': '속성',
  'param:value': '값',
  // 비워 두면 무엇이 되는가 (Parameter.OmittedMeaning)
  'omitted:self': '내 몸',
  // ── 기반이 부르는 문구 (반전 ⑤) ────────────────────────────────
  //
  // 기반은 사람이 읽을 말을 짓지 않는다 — 코드로 부르고 팩이 말을 준다.
  // 목록의 단일 출처는 engine/view-kernel/presentation/text-codes.ts 의
  // ENGINE_TEXT_CODES 다. `{}` 자리는 기반이 값을 끼운다.
  //
  // 명령 표면
  'command.domain.entity': '존재의 이름',
  'command.domain.previous': '앞에서 고른 것이 정하는 값',
  'command.domain.value': '값',
  'command.state.on': '켜짐',
  'command.state.off': '꺼짐',
  'command.origin.world': '세계',
  'command.origin.observer': '내 화면',
  'command.unavailable': '지금은 걸 수 없다',
  'command.omitted': '비우면 {}',
  'command.omitted.nothing': '없음',
  'command.next': '다음: {}',
  'command.close': '닫기',
  'command.no-such': '그런 명령이 없다 — {}',
  'command.takes-nothing': '{} 은 아무것도 받지 않는다',
  'command.out-of-range': '허용된 범위를 벗어난 값이다 — {}',
  'command.not-here': '그 자리에 넣을 수 없다 — {}',
  'command.leftover': '받지 않는 것이 남았다 — {}',
  'command.incomplete': '아직 다 적지 않았다',
  // 겹침 표면 · 칸 띠 (기반 capability — 이 세계는 아직 쓰지 않는다)
  'surface.close': '닫기',
  'surface.empty-cell': '빈 자리',
  'surface.state.available': '가능',
  'surface.state.blocked': '불가',
  'surface.state.pending': '기다리는 중',
  'slot.key': '{} 키',
  'slot.no-key': '부를 수 없음',
  // 기반이 스스로 듣는 키의 이름
  'engine.key.command': '명령',
  'engine.key.move': '이동',
  'engine.key.turn': '시점',
  'engine.key.colliderObserve': '충돌체 관찰',
  'engine.key.attributeInspect': '속성 관찰',
  // 이어짐
  'link.state.connected': '세계와 이어짐',
  'link.state.connecting': '세계에 잇는 중…',
  'link.state.disconnected': '세계와 끊김 — 마지막으로 본 모습입니다',
  'link.round-trip': '왕복',
  'link.arrival-rate': '수신',
  'link.since-last': '마지막',
  'link.since-last.value': '{}ms 전',
  'link.sent': '보냄',
  'link.reconnects': '재연결',
  'binding.observer': '나',
  'binding.character': '내 몸',
  'binding.world': '세계',
  'binding.world.in-process': '(같은 프로세스)',
  // 자기 자원 막대를 부르는 말
  'self.health': 'HP',
  'self.energy': 'CP',
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
