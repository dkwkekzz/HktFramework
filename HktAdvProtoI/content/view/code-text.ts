// 의미 코드 → 플레이어 표시 문구 (결정 Layer 데이터).
// World 는 코드만 보낸다 — 불가 사유 코드, 행동 코드 등. 문구는 여기서 정한다.
// 미등록 코드는 코드 그대로 표시된다 — 표현 누락이 게임을 멈추지 않는다.

const CODE_TEXT: Record<string, string> = {
  // 불가 사유
  'no-mining-tool': '곡괭이가 없다',
  'out-of-range': '너무 멀다 — 가까이 이동하자',
  'deposit-depleted': '광맥이 고갈되었다',
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
  // 내 데이터와 세계의 방이 다르다 (region.hash 대조)
  'region.hash-mismatch': '세계와 다른 땅을 보고 있다',
  // 불가 사유 — 땅이 막는다 (C006 RULE-MOVE-001 의 traversable 전제).
  // 둘 다 세계의 대답이며 몸의 자리는 바뀌지 않는다. 왜 막혔는지를 **땅의 성질**로 말한다 —
  // "갈 수 없다" 가 아니라 "가파르다 · 깊다" 여야 다음에 어디로 걸을지가 화면에서 읽힌다.
  'too-steep': '너무 가파르다', // Play §4 막힘이 준 말 그대로
  'deep-water': '물이 너무 깊다', // 같은 어법 — 땅(물)의 성질 하나로 끝나는 한 줄
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
  // 명령이 무엇을 하는가 (Command.Effect)
  'set-attribute': '존재의 속성 값을 바꾼다',
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
