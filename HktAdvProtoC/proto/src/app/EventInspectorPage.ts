// 사건 화면 (기획서 §36.4 / Phase-8 §8.1)
//
// 목록에서 사건을 고르면 §36.4 의 8항목이 펼쳐진다.
// 이 화면의 핵심은 **"알려진 정보"와 "실제 원인"이 따로 있다**는 것이다 — 두 칸이 나란히 놓이고,
// 플레이어 시점에서는 오른쪽 칸이 비어 있다(§30 "플레이어가 아직 모르는 것").
import type { SceneEventDetail, SceneViewModel } from "../viewmodel/SceneViewModel";
import { badgeLine, el, escapeHtml, type PageContext } from "./shell";

export class EventInspectorPage {
  private readonly listView = el<HTMLElement>("events");
  private readonly detailView = el<HTMLElement>("event-detail");

  constructor(private readonly ctx: PageContext) {}

  render(scene: SceneViewModel): void {
    if (!scene.initialized) {
      this.listView.innerHTML = "세계를 먼저 시작하세요.";
      this.detailView.innerHTML = "";
      return;
    }
    const selected = scene.eventDetail?.eventId;
    this.listView.innerHTML =
      `<div class="hint">시점 ${scene.modeKey === "developer" ? "개발자" : "플레이어"} · 사건 ${scene.events.length}건</div>` +
      (scene.events.length === 0
        ? "<div>아직 탐지된 사건이 없다 — 시간을 진행하세요.</div>"
        : scene.events
            .map(
              (item) =>
                `<div class="${item.eventId === selected ? "selected" : ""}">` +
                `<button data-event="${escapeHtml(item.eventId)}">열기</button> ` +
                `<b>${escapeHtml(item.title)}</b> <small>${escapeHtml(item.type)} · ${escapeHtml(item.status)} · ` +
                `중요도 ${item.significance} · 참여 ${item.participantCount} · 시급 ${item.urgency.toFixed(2)} · ${escapeHtml(item.startedAt)}</small></div>`,
            )
            .join(""));

    for (const button of this.listView.querySelectorAll<HTMLButtonElement>("button[data-event]")) {
      button.addEventListener("click", () => {
        const eventId = button.dataset["event"];
        if (eventId === undefined) return;
        this.ctx.send({ type: "set_view", eventId });
      });
    }

    this.detailView.innerHTML = scene.eventDetail === undefined ? "" : detailHtml(scene.eventDetail);
  }
}

function detailHtml(detail: SceneEventDetail): string {
  const participants = detail.participants
    .map(
      (participant) =>
        `<div>${escapeHtml(participant.symbolKey)} <b>${escapeHtml(participant.label)}</b>` +
        `${participant.known ? "" : " <small>[정체를 모른다]</small>"}` +
        `\n    목적 ${escapeHtml(participant.goals.map((goal) => `${goal.id}(${goal.activation})`).join(" ")) || "—"}</div>`,
    )
    .join("");
  const timeline = detail.timeline
    .map(
      (row) =>
        `<div>${escapeHtml(row.at)} ${escapeHtml(row.label)}${row.byPlayer ? ' <span class="mine">[내 개입]</span>' : ""}` +
        `\n    ${escapeHtml(row.states.join(" | "))}</div>`,
    )
    .join("");
  const results = detail.results
    .map(
      (result) =>
        `<tr><td>${escapeHtml(result.entityId)}</td><td>${escapeHtml(result.stateKey)}</td>` +
        `<td>${escapeHtml(result.before)}</td><td>${escapeHtml(result.after)}</td><td>${escapeHtml(result.delta)}</td></tr>`,
    )
    .join("");

  return (
    `<h3>${escapeHtml(detail.title)}</h3>` +
    `<div><small>${escapeHtml(detail.eventId)} · ${escapeHtml(detail.type)} · ${escapeHtml(detail.status)} · ` +
    `${escapeHtml(detail.startedAt)} ~ ${escapeHtml(detail.concludedAt ?? "진행중")} · 중요도 ${detail.significance}</small></div>` +
    `<div class="narration">${escapeHtml(detail.summarySentence)}</div>` +
    `<div><small>§29 ${escapeHtml(badgeLine(detail.significanceRows, " "))}</small></div>` +
    `<hr /><b>① 참여자 · ② 참여자별 목적</b>${participants}` +
    `<hr /><div class="split">` +
    `<div><b>③ 알려진 정보</b> <small>(아는 참여자 ${detail.knownParticipantCount} / 모르는 참여자 ${detail.unknownParticipantCount})</small>` +
    (detail.knownFacts.length === 0
      ? "<div>아는 사실이 없다</div>"
      : detail.knownFacts.map((fact) => `<div>· ${escapeHtml(fact)}</div>`).join("")) +
    `</div>` +
    `<div><b>④ 실제 원인</b>` +
    (detail.causeVisible
      ? detail.actualCauses.map((cause) => `<div>· ${escapeHtml(cause)}</div>`).join("") || "<div>기록 없음</div>"
      : `<div class="hidden-cause">플레이어 시점에서는 감춰진다 (§30)</div>`) +
    `</div></div>` +
    `<hr /><b>⑤ 시간순 상태 변화 ${detail.timeline.length}건</b>${timeline || "<div>없음</div>"}` +
    `<hr /><b>⑥ 플레이어 개입 기록 ${detail.interventions.length}건</b>` +
    (detail.interventions.length === 0
      ? "<div>없음</div>"
      : detail.interventions
          .map((entry) => `<div>${escapeHtml(entry.at)} [${escapeHtml(entry.kind)}] ${escapeHtml(entry.detail)}</div>`)
          .join("")) +
    `<hr /><b>⑦ 발생한 결과 ${detail.results.length}건</b>` +
    (results.length === 0
      ? "<div>순변화 없음</div>"
      : `<table><tr><th>개체</th><th>상태</th><th>이전</th><th>이후</th><th>순변화</th></tr>${results}</table>`) +
    `<hr /><b>⑧ 후속 사건 가능성 ${detail.followUps.length}건</b>` +
    (detail.followUps.length === 0
      ? "<div>없음</div>"
      : detail.followUps.map((follow) => `<div>· ${escapeHtml(follow.label)}</div>`).join("")) +
    (detail.goalConflicts.length === 0
      ? ""
      : `<div><b>목적 충돌</b>${detail.goalConflicts.map((conflict) => `<div>· ${escapeHtml(conflict)}</div>`).join("")}</div>`) +
    `<hr /><b>표현 (§33.3 · ${escapeHtml(detail.narrationSourceKey)})</b>` +
    `<div class="narration">소문 — ${escapeHtml(detail.rumor)}</div>` +
    `<div class="narration">문서 — ${escapeHtml(detail.document)}</div>` +
    detail.dialogue
      .map((say) => `<div class="narration">${escapeHtml(say.label)}: ${escapeHtml(say.line)}</div>`)
      .join("")
  );
}
