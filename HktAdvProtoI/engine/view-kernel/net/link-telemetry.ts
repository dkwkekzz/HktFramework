// Link Telemetry — 이어짐이 얼마나 잘 통하는지 관찰자 쪽에서 재는 것.
//
// 04-gameview.spec.yaml 의 telemetry 절(owner: observer)을 구현한다.
// 세계에서 오는 값은 observer.acknowledgedMark 하나뿐이고, 나머지는 전부 여기서
// 관찰자 자신의 시계로 만들어진다 — 세계는 사이가 얼마나 잘 통하는지 모른다.
//
// 시계를 주입받는 순수 누산기다. 소켓도 브라우저도 없이 검증할 수 있다.

export interface LinkTelemetry {
  /** 내 표식이 세계에 닿아 관찰 결과로 돌아오기까지 걸린 시간 (아직 없으면 null) */
  roundTripMs: number | null;
  /** 최근 한동안 관찰 결과가 초당 몇 개 도착했는가 */
  arrivalRatePerSecond: number;
  /** 마지막 관찰 결과가 도착한 뒤 흐른 시간 (하나도 못 받았으면 null) */
  sinceLastObservationMs: number | null;
  /** 세계로 보낸 것의 수 (요청 + 표식) */
  sentCount: number;
  /** 이어짐이 끊겼다 다시 붙은 횟수 */
  reconnectCount: number;
}

export interface LinkTelemetryRecorder {
  /** 세계로 무언가를 보냈다 (요청이든 표식이든) */
  recordSent(): void;
  /** 표식을 붙여 보냈다 — 돌아오는 시각을 재기 위해 보낸 시각을 남긴다 */
  recordMarkSent(mark: number, atMs: number): void;
  /** 관찰 결과가 도착했다. 받아들여진 표식으로 왕복을 닫는다 */
  recordObservation(acknowledgedMark: number, atMs: number): void;
  /** 다시 이어졌다 */
  recordReconnect(): void;
  read(nowMs: number): LinkTelemetry;
}

// 도착률을 재는 창 — 이보다 오래된 도착은 세지 않는다.
export const ARRIVAL_WINDOW_MS = 2000;
// 왕복을 기다리는 표식을 이만큼만 들고 있는다 (돌아오지 않는 것이 쌓이지 않게).
export const PENDING_MARK_LIMIT = 64;

interface SentMark {
  mark: number;
  atMs: number;
}

export function createLinkTelemetry(): LinkTelemetryRecorder {
  const pendingMarks: SentMark[] = [];
  const arrivals: number[] = [];
  let roundTripMs: number | null = null;
  let lastObservationAtMs: number | null = null;
  let sentCount = 0;
  let reconnectCount = 0;

  return {
    recordSent() {
      sentCount += 1;
    },

    recordMarkSent(mark, atMs) {
      pendingMarks.push({ mark, atMs });
      if (pendingMarks.length > PENDING_MARK_LIMIT) pendingMarks.shift();
    },

    recordObservation(acknowledgedMark, atMs) {
      lastObservationAtMs = atMs;
      arrivals.push(atMs);
      while (arrivals.length > 0 && atMs - arrivals[0]! > ARRIVAL_WINDOW_MS) arrivals.shift();

      // 받아들여진 표식 중 가장 나중의 것으로 왕복을 닫는다.
      // 그보다 앞선 것들은 이 관찰 결과가 함께 답한 것이므로 버린다.
      let closed: SentMark | null = null;
      while (pendingMarks.length > 0 && pendingMarks[0]!.mark <= acknowledgedMark) {
        closed = pendingMarks.shift()!;
      }
      if (closed) roundTripMs = Math.max(0, atMs - closed.atMs);
    },

    recordReconnect() {
      reconnectCount += 1;
    },

    read(nowMs) {
      // 창 밖으로 나간 도착은 지금 시각 기준으로도 세지 않는다 —
      // 끊겨서 아무것도 오지 않으면 도착률이 0 으로 내려간다.
      const fresh = arrivals.filter((at) => nowMs - at <= ARRIVAL_WINDOW_MS);
      return {
        roundTripMs,
        arrivalRatePerSecond: fresh.length / (ARRIVAL_WINDOW_MS / 1000),
        sinceLastObservationMs:
          lastObservationAtMs === null ? null : Math.max(0, nowMs - lastObservationAtMs),
        sentCount,
        reconnectCount,
      };
    },
  };
}
