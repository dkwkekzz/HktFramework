// Being Reading — 지목한 **존재 하나**의 사실을 모은다 (C027 ADDED · spec R1 · R2).
//
// place-reading.ts 의 형제다. 세계에 아무것도 묻지 않는다 (SPEC-009 — 패킷도 왕복도 0):
// 이 파일이 모으는 것은 전부 **이미 매 tick 봉투에 실려 온** 것이다.
//   entities[]      이름 · 종류 · 역할 · 지금 하는 일과 그 진행 · 생명 · 쓰러짐 · 재료
//   interactions[]  그 존재를 targetEntityId 로 겨냥한 것들 — 걸 수 있는가 · 없으면 왜
//
// 이 파일은 **줄을 만들지 않는다** — 순서도 이름표도 문구도 target-frame-presentation 의
// 표가 정한다. 여기 있는 것은 "그 존재에 무엇이 참인가" 뿐이다.
//
// 그리고 **없는 것은 자리째 없다.** 생명을 갖지 않는 것(광맥 · 출구 표식)에 0 을 지어내지
// 않는다 (SPEC-002 경계 · place-reading 의 규칙 State 와 같은 규율).

import type { GameViewSnapshot, SourceMemoryView } from '../protocol/gameview';

/** 그 존재의 생명 — **가진 것에만 있다.** 비율은 표현이 잰다 (place-reading 의 압력과 같다) */
export interface BeingVitality {
  health: number;
  healthMaximum: number;
  /** 쓰러졌는가 — 쓰러진 몸도 계속 읽힌다 (SPEC-004: 쓰러진 것은 사라진 것이 아니다) */
  downed: boolean;
}

/** 그 존재가 나에게 주는 것 하나 — 봉투의 interaction 그대로다 */
export interface BeingOffer {
  /** 그 행동의 id (ActionRequest.interactionId) */
  id: string;
  /** 그 행동의 Semantic Role — 사람이 읽을 이름은 표현의 표가 준다 */
  role: string;
  available: boolean;
  /** 걸 수 없다면 그 사유 코드 — 문구는 표현이 옮긴다 */
  reason?: string;
}

export interface BeingReading {
  /** 누구인가 — 봉투의 entity.id (이름도 종류도 모를 때 마지막으로 남는 코드) */
  entityId: string;
  /** 사람이 읽을 이름 — character 에만 실린다. 없으면 없다 (지어내지 않는다) */
  name?: string;
  /** 무엇의 종류인가 (의미 코드) — 이름 없는 것의 이름은 여기서 온다 */
  kind?: string;
  /** 무엇의 역할인가 (의미 코드) — 종류도 모를 때의 마지막 표 */
  role: string;
  /**
   * 그것이 **무엇으로 되어 있는가** — Material Seed 의 코드 (C029 ADDED · 봉투의
   * entity.material 그대로. 세계는 C011 부터 이미 이것을 실어 보내고 있었고, 판이
   * 그 줄을 두지 않았을 뿐이다).
   *
   * 재료가 아닌 것(몸 · 출구 표식)에는 **자리 자체가 없다** — 빈 문자열로 지어내지
   * 않는다 (생명 없는 것에 0 을 만들지 않는 것과 같은 규율). 성질도 쓰임도 여기 없다:
   * 실려 오는 것은 코드 하나이고, 그 재료가 무엇이며 어떤 성질인지는 표현이 자기
   * content/regions 로 얻는다 (C011 이 형태의 이름을 얻던 그 규율 그대로).
   */
  material?: string;
  /** 지금 하는 일 (의미 코드) */
  state: string;
  /** 그 일의 진행 0..1 — 진행 개념이 없는 상태에는 없다 */
  progress?: number;
  /** 생명 — **가진 것에만 있다** (SPEC-002 경계) */
  vitality?: BeingVitality;
  /**
   * 그 존재에 **지금 걸린 조건 코드들** (C012 ADDED — 봉투의 entity.conditions 그대로).
   *
   * 걸린 것이 하나도 없으면 **자리 자체가 없다** — 빈 배열로 지어내지 않는다 (생명 없는
   * 것에 0 을 만들지 않는 것과 같은 규율). 무엇이 무엇에 매달렸는지도, 언제 풀리는지도
   * 실려 오지 않으므로 화면도 말하지 않는다: 세계가 말한 것은 "지금 멎었다" 하나다.
   */
  conditions?: string[];
  /**
   * 그 원천에 **일어난 일의 셈** (C034 ADDED — 봉투의 entity.memory 그대로).
   *
   * 한 번도 캔 적 없는 원천에는 **자리 자체가 없다** — 빈 값으로 지어내지 않는다
   * (`conditions?` 와 같은 규율). 몸에도 출구 표식에도 이 자리는 없다.
   *
   * 위의 `state` 와 갈리는 자리다: 저것은 **지금** 그 원천이 어떤가이고 이것은 **거기
   * 무슨 일이 있었나**다. 되돌아온 원천은 다시 `available` 이 되지만 셈은 되돌아오지
   * 않는다 (지워지지 않는 것 · Foundation G7).
   *
   * **나이는 실려 오지 않는다** — 세계가 싣는 것은 마지막 고갈의 시각이고 "N초 전" 은
   * 표현이 잰다 (판의 규칙 줄이 rearrangedAt 을 재는 그 규율 그대로). **누가 캤는지도
   * 없다** — 세계가 세지 않는다.
   */
  memory?: SourceMemoryView;
  /** 그 존재를 겨냥한 행동들 — 하나도 없으면 빈 배열이다 (SPEC-003 경계) */
  offers: BeingOffer[];
}

/**
 * RULE-BEING-READING-001 — 존재 하나의 사실 (spec R1 · R2).
 *
 * 세계에 없는 존재를 지목하고 있으면 **아무것도 만들지 않는다** (undefined) — 사라진 몸을
 * 판에 세우지 않는다. 그 자리를 무엇으로 메울지는 판의 결정이다 (SPEC-004 경계).
 */
export function readBeing(
  snapshot: GameViewSnapshot,
  entityId: string,
): BeingReading | undefined {
  const entity = snapshot.entities.find((e) => e.id === entityId);
  if (!entity) return undefined;

  const vitality = entity.vitality;
  const memory = entity.memory;
  return {
    entityId: entity.id,
    ...(entity.name === undefined ? {} : { name: entity.name }),
    ...(entity.kind === undefined ? {} : { kind: entity.kind }),
    role: entity.role,
    // 재료를 밝히지 않은 것에는 자리가 없다 — 봉투에 없으면 없는 채로 둔다 (C029)
    ...(entity.material === undefined ? {} : { material: entity.material }),
    state: entity.state,
    ...(entity.progress === undefined ? {} : { progress: entity.progress }),
    // 걸린 것이 없으면 봉투에 자리가 없고, 없는 채로 둔다 (C012)
    ...(entity.conditions === undefined || entity.conditions.length === 0
      ? {}
      : { conditions: [...entity.conditions] }),
    // 캔 적 없는 원천에는 봉투에 자리가 없고, 없는 채로 둔다 (C034 — 걸린 것과 같은 규율).
    // 한 번도 고갈된 적 없으면 그 시각도 없다 — 0 으로 지어내지 않는다
    ...(memory === undefined
      ? {}
      : {
          memory: {
            takenTotal: memory.takenTotal,
            depletedTimes: memory.depletedTimes,
            ...(memory.lastDepletedAt === undefined
              ? {}
              : { lastDepletedAt: memory.lastDepletedAt }),
          },
        }),
    ...(vitality
      ? {
          vitality: {
            health: vitality.health,
            healthMaximum: vitality.healthMaximum,
            downed: vitality.downed,
          },
        }
      : {}),
    offers: readOffers(snapshot, entity.id),
  };
}

/**
 * RULE-TARGET-OFFERS-001 — 그 대상이 주는 것들 (spec R2 · SPEC-003).
 *
 * **그 존재를 겨냥한 것만** 담는다. 대상이 없는 행동(빈 땅으로 이동)도, 다른 대상의 것도
 * 담기지 않는다 — 지목한 것의 것만 읽힌다.
 */
function readOffers(snapshot: GameViewSnapshot, entityId: string): BeingOffer[] {
  return snapshot.interactions
    .filter((i) => i.targetEntityId === entityId)
    .map((i) => ({
      id: i.id,
      role: i.role,
      available: i.available,
      ...(i.reason === undefined ? {} : { reason: i.reason }),
    }));
}
