// P0-a 행동 원자 16종 확정 — 세계에서 일어나는 모든 행동을 열여섯 개로 좁힌다.
//
// 원문은 행동을 세 곳에서 다르게 적는다:
//
//   ModulePlan P0   찾다 획득 생산 교환 빼앗다 보호 제거 은폐 조사 설득 협박 동맹 배신
//                   적응 대체 탈피                                              (16)
//   ModulePlan P1   충족·대체·감소·생산·위임·경쟁 제거·의존 제거                 (7 — 방향)
//   ModulePlan P2   추적 사냥 해체 / 구매 운송 독점 / 징수 통제 법제화 /
//                   이동 섭식 영역 침범 / 의례 요구 금기 부여 영역 변형          (15 — 예시)
//
// 앞 계층(O2-a 영역·D0-a 대상)에서 그랬듯 여기서도 대조 자체를 값으로 남긴다. 다만 갈리는
// 방향이 반대다. 영역·대상은 **좁혀야** 했고(두 목록을 하나로), 행동은 **환원해야** 한다:
// P2 가 든 예시 열다섯은 새 행동이 아니라 원자의 조합이어야 하고, P1 의 일곱은 행동이 아니라
// 원자를 고르는 **방향**이어야 한다. 그것이 성립하지 않으면 16원자는 최소 집합이 아니다.
//
// 이 하위 작업의 한 문장: **징수와 약탈은 같은 원자다.** 갈리는 것은 행동이 아니라
// 그 행동 뒤에 institutional.law 자리가 서 있는가 하나뿐이다. 세계가 깊어지는 것은
// 행동을 늘려서가 아니라, 같은 행동이 놓인 자리가 달라서다.

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { violateAtom, type ActionAtomViolation } from './violation.ts';

/** 확정 16원자. 순서는 원문 P0 목록 그대로다 — 화면·해시가 흔들리지 않게. */
export const ACTION_ATOMS = [
  'seek',
  'acquire',
  'produce',
  'exchange',
  'seize',
  'protect',
  'destroy',
  'conceal',
  'investigate',
  'persuade',
  'coerce',
  'ally',
  'betray',
  'adapt',
  'substitute',
  'shed',
] as const;
export type ActionAtom = (typeof ACTION_ATOMS)[number];

/** 확정된 원자 하나 — 무엇을 하는 것이고 원문 어디서 왔는가. */
export interface ActionAtomSpec {
  readonly atom: ActionAtom;
  /** 한국어 이름 (화면 표기) */
  readonly label: string;
  /** ModulePlan P0 목록이 쓴 이름 */
  readonly originalName: string;
  /** 이 원자가 하는 일 한 줄 */
  readonly does: string;
  /** 붉은 장막 세계에서의 예 — 원자가 무엇인지는 예 하나로 갈린다 */
  readonly example: string;
  /** 원문 근거 위치 */
  readonly source: string;
}

/** 확정 16원자의 정의. */
export const ACTION_ATOM_SPECS: readonly ActionAtomSpec[] = [
  {
    atom: 'seek',
    label: '찾다',
    originalName: '찾는다',
    does: '어디 있는지 모르는 것의 자리를 알아낸다 — 자국을 읽고 발로 훑는다',
    example: '몰이꾼은 붉은 빛이 걷힌 자리를 따라 장막벌레의 둥지를 찾는다',
    source: 'ModulePlan P0 찾는다',
  },
  {
    atom: 'acquire',
    label: '획득',
    originalName: '획득한다',
    does: '이미 있는 것을 내 곁으로 옮긴다 — 줍고 캐고 가고 차지하고 삼킨다',
    example: '몰이꾼은 협곡으로 걸어 들어가 장막벌레의 사체에서 고기를 떼어 온다',
    source: 'ModulePlan P0 획득한다 + P2 예시 이동·운송·섭식',
  },
  {
    atom: 'produce',
    label: '생산',
    originalName: '생산한다',
    does: '없던 것을 세운다 — 재료를 태워 물건을, 사람을 모아 법을, 나무를 태워 온기를',
    example: '상단은 고개 어귀에 불을 피워 얼어붙는 밤을 견딜 온기를 만든다',
    source: 'ModulePlan P0 생산한다 + P2 예시 해체·법제화·영역 변형',
  },
  {
    atom: 'exchange',
    label: '교환',
    originalName: '교환한다',
    does: '서로 동의한 채로 주고받는다 — 물건이든 앎이든 통행권이든',
    example: '상단은 마비독을 가려내는 법을 알려 주고 말린 고기 두 짝을 받는다',
    source: 'ModulePlan P0 교환한다 + P2 예시 구매',
  },
  {
    atom: 'seize',
    label: '빼앗다',
    originalName: '빼앗는다',
    does: '동의 없이 가져간다 — 그 자리에 원한이 남는다',
    example: '굶주린 몰이꾼이 상단의 짐에서 고기를 들어낸다. 나라가 같은 일을 하면 징수라 부른다',
    source: 'ModulePlan P0 빼앗는다 + P2 예시 징수·영역 침범',
  },
  {
    atom: 'protect',
    label: '보호',
    originalName: '보호한다',
    does: '이미 채워진 자리가 깎이지 않게 막는다 — 채우지 않고 지킨다',
    example: '나라는 고개에 초소를 세워 통행권 없는 자가 넘지 못하게 한다',
    source: 'ModulePlan P0 보호한다 + P2 예시 독점·통제',
  },
  {
    atom: 'destroy',
    label: '제거',
    originalName: '제거한다',
    does: '있던 것을 없앤다 — 없어진 자리는 비고, 빈 자리는 누군가 채운다',
    example: '몰이꾼은 둥지의 장막벌레를 죽인다. 협곡의 개체군이 그만큼 줄어든다',
    source: 'ModulePlan P0 제거한다 + P2 예시 사냥(찾다·제거·획득의 조합)',
  },
  {
    atom: 'conceal',
    label: '은폐',
    originalName: '은폐한다',
    does: '있는 것을 알려지지 않게 한다 — 덮고 지우고 다른 것이라 말한다',
    example: '몰이꾼은 자기가 찾은 둥지의 자리를 마을에 말하지 않는다',
    source: 'ModulePlan P0 은폐한다',
  },
  {
    atom: 'investigate',
    label: '조사',
    originalName: '조사한다',
    does: '손에 닿는 것에서 몰랐던 성질과 인과를 읽어 낸다 — 찾다가 어디라면 조사는 무엇이다',
    example: '사제는 죽은 벌레의 기관을 갈라 그 붉은 빛이 어미의 숨인지 자국인지를 가린다',
    source: 'ModulePlan P0 조사한다 + MasterPlan §20 정보 정확도',
  },
  {
    atom: 'persuade',
    label: '설득',
    originalName: '설득한다',
    does: '이유를 들어 상대가 믿는 것과 하려는 것을 바꾼다 — 신뢰를 청구한다',
    example: '몰이꾼은 마을에 겨울을 넘길 방법을 설명하고 창고를 열게 한다',
    source: 'ModulePlan P0 설득한다 + P2 예시 의례 요구(신이 이유를 들 때)',
  },
  {
    atom: 'coerce',
    label: '협박',
    originalName: '협박한다',
    does: '해를 예고해 상대의 선택지를 지운다 — 두려움이 남는다',
    example: '어미를 섬기는 자들은 제물을 끊으면 장막이 걷히지 않으리라 이른다',
    source: 'ModulePlan P0 협박한다 + P2 예시 통제·금기 부여',
  },
  {
    atom: 'ally',
    label: '동맹',
    originalName: '동맹한다',
    does: '아직 치르지 않은 것을 걸어 둘을 하나로 묶는다 — 약속은 미래의 빚이다',
    example: '몰이꾼 둘이 등을 맡기기로 하고 사냥한 것을 나누기로 한다',
    source: 'ModulePlan P0 동맹한다 + MasterPlan §13 계약',
  },
  {
    atom: 'betray',
    label: '배신',
    originalName: '배신한다',
    does: '서 있는 약속을 어긴다 — 안에 있는 자만 할 수 있고, 그래서 막을 수 없다',
    example: '짝이 몰이꾼을 협곡에 두고 혼자 고기를 지고 내려간다',
    source: 'ModulePlan P0 배신한다 + MasterPlan §13 약속 위반',
  },
  {
    atom: 'adapt',
    label: '적응',
    originalName: '적응한다',
    does: '같은 것을 덜 쓰도록 자기를 바꾼다 — 기대는 자리는 그대로고 무게만 준다',
    example: '오래 굶은 몰이꾼의 대사가 느려져 같은 고기로 더 오래 버틴다',
    source: 'ModulePlan P0 적응한다 + P1 소비량 감소',
  },
  {
    atom: 'substitute',
    label: '대체',
    originalName: '대체한다',
    does: '기대는 대상을 다른 것으로 갈아탄다 — 끊고 세운다, 무게는 사라지지 않는다',
    example: '사제는 식량에 기대던 무게의 절반을 의념의 샘으로 옮긴다 (D3 전환 장부)',
    source: 'ModulePlan P0 대체한다 + P1 의존 대상 대체',
  },
  {
    atom: 'shed',
    label: '탈피',
    originalName: '탈피한다',
    does: '그 자리를 아예 갖지 않는 존재가 된다 — 열여섯 중 가장 비싸고 되돌릴 수 없다',
    example: '장막벌레의 군집이 껍질을 벗고 물 없이 겨울을 나는 몸으로 바뀐다',
    source: 'ModulePlan P0 탈피한다 + P1 의존성 자체 제거',
  },
];

/** 원문이 P0 목록 밖에서 행동처럼 적은 이름. */
export interface OriginalAction {
  /** 원문이 쓴 이름 */
  readonly name: string;
  readonly source: string;
}

/** ModulePlan P1 이 나열한 대응 방향 7개 — 행동이 아니라 원자를 고르는 방향이어야 한다. */
export const P1_DIRECTIONS: readonly OriginalAction[] = [
  { name: '의존성을 충족한다', source: 'ModulePlan P1' },
  { name: '의존 대상을 대체한다', source: 'ModulePlan P1' },
  { name: '소비량을 감소시킨다', source: 'ModulePlan P1' },
  { name: '의존 대상을 생산한다', source: 'ModulePlan P1' },
  { name: '다른 주체에게 맡긴다', source: 'ModulePlan P1' },
  { name: '경쟁자를 제거한다', source: 'ModulePlan P1' },
  { name: '의존성 자체를 제거한다', source: 'ModulePlan P1' },
];

/** ModulePlan P2 가 주체 유형별로 든 예시 15개 — 새 행동이 아니라 원자의 조합이어야 한다. */
export const P2_EXAMPLES: readonly OriginalAction[] = [
  { name: '추적', source: 'ModulePlan P2 사냥꾼' },
  { name: '사냥', source: 'ModulePlan P2 사냥꾼' },
  { name: '해체', source: 'ModulePlan P2 사냥꾼' },
  { name: '구매', source: 'ModulePlan P2 상인' },
  { name: '운송', source: 'ModulePlan P2 상인' },
  { name: '독점', source: 'ModulePlan P2 상인' },
  { name: '징수', source: 'ModulePlan P2 국가' },
  { name: '통제', source: 'ModulePlan P2 국가' },
  { name: '법제화', source: 'ModulePlan P2 국가' },
  { name: '이동', source: 'ModulePlan P2 마물' },
  { name: '섭식', source: 'ModulePlan P2 마물' },
  { name: '영역 침범', source: 'ModulePlan P2 마물' },
  { name: '의례 요구', source: 'ModulePlan P2 신' },
  { name: '금기 부여', source: 'ModulePlan P2 신' },
  { name: '영역 변형', source: 'ModulePlan P2 신' },
];

/** 원문의 이름이 16원자로 환원되는 방식. */
export type AtomResolutionKind =
  | 'same' // 그 원자 하나다
  | 'compound' // 원자 둘 이상의 조합이다 — 새 행동이 아니다
  | 'direction'; // 행동이 아니라 원자를 고르는 방향이다 (P1 이 조립한다)

/** 원문 이름 하나의 환원 기록. */
export interface AtomResolution {
  readonly original: string;
  readonly resolution: AtomResolutionKind;
  /** 어느 원자(들)로 갔는가 */
  readonly atoms: readonly ActionAtom[];
  /** 왜 그렇게 환원되는가 — 갈리는 자리를 든다 */
  readonly reason: string;
}

/** P1 일곱 방향이 어느 원자들을 고르는가 — P1 이 그대로 쓸 재료다. */
export const DIRECTION_RECONCILIATION: readonly AtomResolution[] = [
  {
    original: '의존성을 충족한다',
    resolution: 'direction',
    atoms: ['seek', 'acquire', 'exchange', 'seize'],
    reason:
      '채우는 길은 넷이다 — 어디 있는지 알아내고(찾다), 가져오고(획득), 값을 치러 받고(교환), 동의 없이 가져온다(빼앗다). 무엇을 고르는지가 그 주체를 말한다.',
  },
  {
    original: '의존 대상을 대체한다',
    resolution: 'direction',
    atoms: ['substitute'],
    reason: '갈아타는 것은 대체 하나뿐이다. D3 전환 장부가 덜어 낸 무게만큼 세우게 한다.',
  },
  {
    original: '소비량을 감소시킨다',
    resolution: 'direction',
    atoms: ['adapt'],
    reason: '덜 쓰는 것은 적응 하나뿐이다 — 기대는 자리는 그대로고 강도만 준다.',
  },
  {
    original: '의존 대상을 생산한다',
    resolution: 'direction',
    atoms: ['produce'],
    reason: '없던 것을 세우는 것은 생산 하나뿐이다. 물건이든 법이든 온기든 같은 원자다.',
  },
  {
    original: '다른 주체에게 맡긴다',
    resolution: 'direction',
    atoms: ['ally', 'exchange', 'persuade'],
    reason:
      '맡기는 것은 새 행동이 아니라 상대를 움직이는 셋이다 — 묶거나(동맹), 값을 치르거나(교환), 이유를 들거나(설득). 협박으로도 맡길 수 있지만 그것은 아래 방향(경쟁자 제거)과 같은 원자다.',
  },
  {
    original: '경쟁자를 제거한다',
    resolution: 'direction',
    atoms: ['destroy', 'coerce', 'conceal'],
    reason:
      '경쟁을 지우는 길은 셋이다 — 없애거나(제거), 물러나게 하거나(협박), 애초에 알려지지 않게 한다(은폐). 은폐가 가장 싸다.',
  },
  {
    original: '의존성 자체를 제거한다',
    resolution: 'direction',
    atoms: ['shed'],
    reason: '의존을 버리는 것은 탈피 하나뿐이다. 되돌릴 수 없고 가장 비싸다.',
  },
];

/** P2 예시 열다섯이 원자로 환원되는 방식. */
export const EXAMPLE_RECONCILIATION: readonly AtomResolution[] = [
  {
    original: '추적',
    resolution: 'same',
    atoms: ['seek'],
    reason: '자국을 따라 자리를 알아내는 일이다 — 찾다 그 자체.',
  },
  {
    original: '사냥',
    resolution: 'compound',
    atoms: ['seek', 'destroy', 'acquire'],
    reason:
      '찾고 죽이고 가져온다. 세 원자가 이어 붙은 것이지 새 행동이 아니다 — 이 조합을 이름으로 부르는 것이 P5 의 계획이다.',
  },
  {
    original: '해체',
    resolution: 'same',
    atoms: ['produce'],
    reason: '사체라는 재료를 태워 가죽·기관이라는 없던 것을 세운다 — 생산의 모양 그대로다.',
  },
  {
    original: '구매',
    resolution: 'same',
    atoms: ['exchange'],
    reason: '값을 치르고 받는다. 화폐인지 물물인지는 economic.price 자리가 가른다.',
  },
  {
    original: '운송',
    resolution: 'same',
    atoms: ['acquire'],
    reason:
      '물건의 자리(physical.region)를 바꾸는 일이다. 내 곁으로 가져오든 저쪽으로 옮기든 같은 원자다.',
  },
  {
    original: '독점',
    resolution: 'compound',
    atoms: ['acquire', 'protect'],
    reason: '물량을 차지하고(획득) 남이 끼어들지 못하게 막는다(보호). 새 행동이 아니다.',
  },
  {
    original: '징수',
    resolution: 'same',
    atoms: ['seize'],
    reason:
      '동의 없이 가져간다 — 약탈과 같은 원자다. 갈리는 것은 행동이 아니라 그 뒤에 institutional.law 자리가 서 있는가 하나뿐이다.',
  },
  {
    original: '통제',
    resolution: 'compound',
    atoms: ['coerce', 'protect'],
    reason: '어기면 벌한다고 이르고(협박) 그 자리가 흔들리지 않게 막는다(보호).',
  },
  {
    original: '법제화',
    resolution: 'same',
    atoms: ['produce'],
    reason:
      '없던 institutional.law 자리를 세운다. 생산은 물건에만 있는 것이 아니다 — 만들어지는 것은 다 생산이다.',
  },
  {
    original: '이동',
    resolution: 'same',
    atoms: ['acquire'],
    reason: '자기 몸의 physical.region 을 바꿔 그 자리를 차지한다 — 공간 의존을 채우는 획득이다.',
  },
  {
    original: '섭식',
    resolution: 'same',
    atoms: ['acquire'],
    reason: '획득의 끝은 몸에 넣는 것이다 — economic.stock 이 줄고 biological.hunger 가 준다.',
  },
  {
    original: '영역 침범',
    resolution: 'same',
    atoms: ['seize'],
    reason: '남의 자리를 동의 없이 차지한다 — 가져가는 것이 물건이 아니라 자리일 뿐이다.',
  },
  {
    original: '의례 요구',
    resolution: 'compound',
    atoms: ['persuade', 'coerce'],
    reason:
      '신이 이유를 들면 설득이고 벌을 예고하면 협박이다. 같은 요구가 둘로 갈리는 자리가 곧 그 신의 성격이다.',
  },
  {
    original: '금기 부여',
    resolution: 'compound',
    atoms: ['produce', 'coerce'],
    reason: '금지하는 법(institutional.contraband)을 세우고(생산) 어기면 벌한다고 이른다(협박).',
  },
  {
    original: '영역 변형',
    resolution: 'compound',
    atoms: ['destroy', 'produce'],
    reason: '있던 자리를 무너뜨리고 새 자리를 세운다. 신의 행동도 원자를 벗어나지 않는다.',
  },
];

/** 원문 환원 전체 — 방향 7 + 예시 15. */
export const ATOM_RECONCILIATION: readonly AtomResolution[] = [
  ...DIRECTION_RECONCILIATION,
  ...EXAMPLE_RECONCILIATION,
];

/** 환원 결과 — 확정 16원자가 원문 세 곳으로부터 온전히 서는가. */
export interface AtomReconciliationReport {
  readonly atoms: readonly ActionAtom[];
  /** 환원되지 않은 원문 이름 */
  readonly unresolved: readonly string[];
  /** 16종에 없는 원자로 보낸 이름 (`이름→원자`) */
  readonly danglingTargets: readonly string[];
  /** 근거·하는 일·예가 빈 원자 */
  readonly unsourced: readonly ActionAtom[];
  /** 두 번 적힌 원자 */
  readonly duplicateAtoms: readonly ActionAtom[];
  /** 원문 P1·P2 어디에도 쓰이지 않은 원자 — 없어도 되는 원자인가를 묻게 한다 */
  readonly unusedAtoms: readonly ActionAtom[];
  /** 조합으로만 서는 원문 이름 (새 행동이 아니라는 증거) */
  readonly compounds: readonly string[];
  readonly violations: readonly ActionAtomViolation[];
  readonly complete: boolean;
}

/** 원문 세 목록을 확정 원자에 대조한다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function reconcileAtoms(
  specs: readonly ActionAtomSpec[] = ACTION_ATOM_SPECS,
  originals: readonly OriginalAction[] = [...P1_DIRECTIONS, ...P2_EXAMPLES],
  resolutions: readonly AtomResolution[] = ATOM_RECONCILIATION,
): AtomReconciliationReport {
  const violations: ActionAtomViolation[] = [];
  const defined = specs.map((spec) => spec.atom);
  const resolvedNames = new Set(resolutions.map((entry) => entry.original));

  const unresolved = originals
    .map((entry) => entry.name)
    .filter((name) => !resolvedNames.has(name));
  for (const name of unresolved) {
    violateAtom(
      violations,
      '',
      'unresolved-original',
      '$.reconciliation',
      `원문이 적은 행동 ${JSON.stringify(name)} 가 16원자 어디로도 환원되지 않았다 — 환원되지 않는 행동이 있다면 16 은 최소 집합이 아니다`,
    );
  }

  const danglingTargets: string[] = [];
  for (const entry of resolutions) {
    for (const atom of entry.atoms) {
      if (!defined.includes(atom)) {
        danglingTargets.push(`${entry.original}→${atom}`);
        violateAtom(
          violations,
          atom,
          'dangling-resolution',
          '$.reconciliation',
          `${entry.original} 를 16원자에 없는 ${JSON.stringify(atom)} 로 보냈다`,
        );
      }
    }
    if (entry.atoms.length === 0) {
      danglingTargets.push(`${entry.original}→(없음)`);
      violateAtom(
        violations,
        '',
        'dangling-resolution',
        '$.reconciliation',
        `${entry.original} 를 아무 원자로도 보내지 않았다 — 환원이 아니라 삭제다`,
      );
    }
    if (entry.resolution === 'same' && entry.atoms.length !== 1) {
      violateAtom(
        violations,
        entry.atoms[0] ?? '',
        'dangling-resolution',
        '$.reconciliation',
        `${entry.original} 를 "그 원자 하나" 라 적고 ${String(entry.atoms.length)}개로 보냈다`,
      );
    }
    if (entry.resolution === 'compound' && entry.atoms.length < 2) {
      violateAtom(
        violations,
        entry.atoms[0] ?? '',
        'dangling-resolution',
        '$.reconciliation',
        `${entry.original} 를 조합이라 적고 원자 하나만 들었다 — 조합이 아니라 같음이다`,
      );
    }
  }

  const duplicateAtoms = stableSort(
    defined.filter((atom, index) => defined.indexOf(atom) !== index),
    compareStrings,
  );
  for (const atom of duplicateAtoms) {
    violateAtom(violations, atom, 'duplicate-atom', '$.specs', `${atom} 이 두 번 적혔다`);
  }

  const missing = ACTION_ATOMS.filter((atom) => !defined.includes(atom));
  for (const atom of missing) {
    violateAtom(
      violations,
      atom,
      'unsourced-atom',
      '$.specs',
      `원문 P0 이 적은 ${atom} 에 정의가 없다 — 이름만 있는 칸은 P1 이 고르지 못한다`,
    );
  }

  const unsourced: ActionAtom[] = [];
  for (const [index, spec] of specs.entries()) {
    const blanks = [
      spec.source === '' ? 'source' : '',
      spec.does === '' ? 'does' : '',
      spec.example === '' ? 'example' : '',
      spec.originalName === '' ? 'originalName' : '',
    ].filter((field) => field !== '');
    if (blanks.length > 0) {
      unsourced.push(spec.atom);
      violateAtom(
        violations,
        spec.atom,
        'unsourced-atom',
        `$.specs[${String(index)}].${blanks[0] ?? ''}`,
        `${spec.atom} 이 ${blanks.join('·')} 를 대지 못한다 — 근거 없는 원자는 지어낸 것이다`,
      );
    }
  }

  const used = new Set(resolutions.flatMap((entry) => entry.atoms));
  const unusedAtoms = defined.filter((atom) => !used.has(atom));
  const compounds = resolutions
    .filter((entry) => entry.resolution === 'compound')
    .map((entry) => entry.original);

  return {
    atoms: defined,
    unresolved,
    danglingTargets,
    unsourced,
    duplicateAtoms,
    unusedAtoms,
    compounds,
    violations,
    complete: specs.length > 0 && violations.length === 0,
  };
}

/**
 * 원문 P1·P2 가 한 번도 쓰지 않는 원자와, 그 원자를 쓸 모듈.
 * 안 쓰인다고 지우지 않는다 — 원문 P0 이 든 이름이고, 쓸 자리가 뒤에 있다.
 */
export const UNUSED_ATOM_DEBT: Readonly<Record<string, string>> = {
  investigate: 'R4 믿음 형성 — 조사는 목적을 채우는 길이 아니라 세계를 다르게 읽게 하는 길이다',
  betray: 'E2 계약 — 배신은 목적을 채우는 길이 아니라 이미 선 약속을 무너뜨리는 길이다',
};

/** 환원을 한 줄 판정으로 접는다 — 터미널·배지용. */
export function atomReconciliationVerdict(report: AtomReconciliationReport): string {
  if (report.complete) {
    return `원문 세 목록이 ${String(report.atoms.length)}원자로 환원됐다 (조합으로만 서는 이름 ${String(report.compounds.length)} · 방향 7 · 아직 안 쓰인 원자 ${String(report.unusedAtoms.length)})`;
  }
  const reasons: string[] = [];
  if (report.atoms.length === 0) reasons.push('확정 원자가 없다');
  if (report.unresolved.length > 0) {
    reasons.push(`환원되지 않은 원문 이름 ${report.unresolved.join(', ')}`);
  }
  if (report.danglingTargets.length > 0) {
    reasons.push(`없는 원자로 보낸 이름 ${report.danglingTargets.join(', ')}`);
  }
  if (report.unsourced.length > 0) reasons.push(`근거 없는 원자 ${report.unsourced.join(', ')}`);
  if (report.duplicateAtoms.length > 0) {
    reasons.push(`두 번 적힌 원자 ${report.duplicateAtoms.join(', ')}`);
  }
  return reasons.join(' · ');
}

/** 원자 정의 하나를 찾는다. */
export function atomSpec(atom: ActionAtom): ActionAtomSpec | null {
  return ACTION_ATOM_SPECS.find((spec) => spec.atom === atom) ?? null;
}

/** 문자열이 확정 16원자 중 하나인가. */
export function isActionAtom(value: unknown): value is ActionAtom {
  return typeof value === 'string' && (ACTION_ATOMS as readonly string[]).includes(value);
}

/** 원자의 한국어 이름 — 화면·사유 문장용. */
export function atomLabel(atom: ActionAtom): string {
  return atomSpec(atom)?.label ?? atom;
}

/** 원문 이름 하나가 어느 원자로 환원되는가. */
export function atomResolutionOf(
  original: string,
  resolutions: readonly AtomResolution[] = ATOM_RECONCILIATION,
): AtomResolution | null {
  return resolutions.find((entry) => entry.original === original) ?? null;
}
