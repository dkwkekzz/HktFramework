// 텍스트 덤프 렌더러 (Phase-8 §8.0 "표현 방식 변경의 격리 증명")
//
// **Canvas 렌더러와 완전히 같은 SceneViewModel 을 소비한다.**
// 그래서 표현 방식을 바꾸는 일이 `rendering/` 밖으로 새지 않는다는 것을 이 파일의 존재가 증명한다 —
// 두 렌더러 사이에 공유되는 것은 ViewModel 속성뿐이고, 빌더·코어는 어느 쪽도 알지 못한다.
import type {
  SceneAgentPanel,
  SceneEventDetail,
  SceneMap,
  SceneViewModel,
} from "../viewmodel/SceneViewModel";

function line(indent: number, text: string): string {
  return `${" ".repeat(indent)}${text}`;
}

function mapDump(map: SceneMap): string[] {
  const out: string[] = ["[지도]"];
  for (const region of map.regions) {
    out.push(
      line(
        2,
        `${region.label} (${region.id}) ${region.climateKey}/${region.dangerKey} 고도 ${region.elevation} ` +
          `@${region.rect.x.toFixed(2)},${region.rect.y.toFixed(2)} ${region.rect.w.toFixed(2)}x${region.rect.h.toFixed(2)}`,
      ),
    );
    for (const badge of region.badges) out.push(line(4, `${badge.key}=${badge.value}`));
    // §13 지역 생태 — 여기서 무엇이 나고 어느 종이 살 만한가
    for (const resource of region.ecology.resources) {
      out.push(line(4, `자원 ${resource.label} ×${resource.nodeCount} 희귀도 ${resource.rarity}`));
    }
    for (const species of region.ecology.species) {
      out.push(line(4, `종 적합도 ${species.label} ${species.suitability}`));
    }
  }
  for (const connection of map.connections) {
    out.push(
      line(
        2,
        `${connection.from} ↔ ${connection.to} ${connection.dangerKey} ${connection.label}` +
          (connection.gated ? (connection.openToViewer ? " [조건 충족]" : " [통행 불가]") : ""),
      ),
    );
  }
  for (const group of [
    { title: "주체", markers: map.markers },
    { title: "자원", markers: map.resources },
    { title: "장소", markers: map.places },
  ]) {
    for (const marker of group.markers) {
      out.push(
        line(
          2,
          `${group.title} ${marker.symbolKey} ${marker.label} (${marker.id}) ` +
            `@${marker.point.x.toFixed(3)},${marker.point.y.toFixed(3)} 고도 ${marker.elevation}` +
            `${marker.moving ? " 이동중" : ""} ${marker.badges.map((b) => `${b.key}=${b.value}`).join(" ")}`,
        ),
      );
    }
  }
  for (const overlay of map.overlays) {
    out.push(
      line(
        2,
        `사건 ${overlay.symbolKey} ${overlay.label} (${overlay.eventId}) 반경 ${overlay.radius.toFixed(3)} ` +
          `강도 ${overlay.intensity.toFixed(2)} 시급 ${overlay.urgency.toFixed(2)} 참여 ${overlay.participantCount}`,
      ),
    );
  }
  for (const signal of map.signals) {
    out.push(
      line(
        2,
        `신호 ${signal.channelKey} ${signal.label} 세기 ${signal.intensity.toFixed(2)} ttl ${signal.ttl} @${signal.regionId}`,
      ),
    );
  }
  return out;
}

function agentDump(panel: SceneAgentPanel): string[] {
  const out: string[] = [`[주체 관찰 · ${panel.modeKey}] ${panel.label} (${panel.agentId}) ${panel.symbolKey}`];
  out.push(line(2, panel.badges.map((badge) => `${badge.key} ${badge.value}`).join(" · ")));
  out.push(line(2, "상태 (실제 | 믿음)"));
  for (const row of panel.states) {
    out.push(
      line(
        4,
        `${row.key}: ${row.actual ?? "-"} | ${row.believed ?? "-"}` +
          `${row.confidence === undefined ? "" : `(확신 ${row.confidence})`}` +
          `${row.divergent ? " ≠" : ""} ${row.observable ? "" : "[관찰불가]"} <${row.sourceKey}>`,
      ),
    );
  }
  if (panel.beliefsAboutOthers.length > 0) {
    out.push(line(2, "남에 대한 믿음"));
    for (const row of panel.beliefsAboutOthers) {
      out.push(
        line(
          4,
          `${row.subjectId}.${row.key}: ${row.actual ?? "-"} | ${row.believed ?? "-"}` +
            `${row.confidence === undefined ? "" : `(확신 ${row.confidence})`}${row.divergent ? " ≠" : ""}`,
        ),
      );
    }
  }
  if (panel.activeGoal !== undefined) {
    out.push(line(2, `활성 목적 ${panel.activeGoal.id} (${panel.activeGoal.activation}) ${panel.activeGoal.description}`));
  }
  out.push(line(2, "목적 그래프"));
  for (const node of panel.goalGraph) {
    out.push(
      line(
        4,
        `${node.active ? "*" : " "}${node.id} 활성도 ${node.activation} 긴급 ${node.urgency} <${node.sourceKey}> ` +
          `${node.breakdown.map((b) => `${b.key}=${b.value}`).join(" ")}`,
      ),
    );
    for (const edge of node.edges) out.push(line(6, `→ ${edge.relation} ${edge.to} (${edge.weight})`));
  }
  if (panel.currentAction !== undefined) {
    const action = panel.currentAction;
    out.push(
      line(2, `현재 행동 ${action.label}(${action.actionId}) → ${action.targets} ${action.startedAt}~${action.completesAt} ${(action.progress * 100).toFixed(0)}%`),
    );
  } else {
    out.push(line(2, "현재 행동 없음"));
  }
  out.push(line(2, `기억 ${panel.memories.length}건`));
  for (const memory of panel.memories.slice(0, 8)) {
    out.push(line(4, `${memory.at} [${memory.type}] ${memory.summary} 중요 ${memory.relevance} 강도 ${memory.intensity}`));
  }
  out.push(line(2, `관계 ${panel.relationships.length}건`));
  for (const relation of panel.relationships) {
    out.push(
      line(
        4,
        `→ ${relation.label}(${relation.toId}) ${relation.axes.map((a) => `${a.key}=${a.value}`).join(" ")} ` +
          `비밀 ${relation.secretCount} 약속 ${relation.promises.length}`,
      ),
    );
  }
  out.push(line(2, `능력 ${panel.abilities.length}건`));
  for (const ability of panel.abilities) {
    out.push(line(4, `${ability.id} ${ability.purpose} 출력 ${ability.outputRange} 숙련 ${ability.mastery}`));
    for (const restriction of ability.restrictions) {
      out.push(line(6, `제약 ${restriction.description} (부담 ${restriction.severity})`));
    }
    out.push(line(6, `약점 ${ability.weakness} · 근거 ${ability.derivedFrom}`));
  }
  for (const sentence of panel.narration) out.push(line(2, `묘사 ${sentence}`));
  out.push(line(2, `감춰진 상태 ${panel.hiddenCount}종`));
  return out;
}

function eventDump(detail: SceneEventDetail): string[] {
  const out: string[] = [`[사건 · ${detail.modeKey}] ${detail.title} (${detail.eventId}/${detail.type})`];
  out.push(line(2, `${detail.status} ${detail.startedAt}~${detail.concludedAt ?? "진행중"} 중요도 ${detail.significance}`));
  out.push(line(2, `요약 ${detail.summarySentence}`));
  out.push(line(2, `참여자 ${detail.participants.length} (아는 ${detail.knownParticipantCount} / 모르는 ${detail.unknownParticipantCount})`));
  for (const participant of detail.participants) {
    out.push(
      line(
        4,
        `${participant.symbolKey} ${participant.label} ${participant.known ? "" : "[정체 모름]"} ` +
          `목적 ${participant.goals.map((goal) => `${goal.id}(${goal.activation})`).join(" ") || "-"}`,
      ),
    );
  }
  out.push(line(2, "알려진 정보"));
  for (const fact of detail.knownFacts) out.push(line(4, fact));
  out.push(line(2, `실제 원인 ${detail.causeVisible ? "" : "(플레이어 시점에서는 감춰진다)"}`));
  for (const cause of detail.actualCauses) out.push(line(4, cause));
  out.push(line(2, `시간순 변화 ${detail.timeline.length}건`));
  for (const row of detail.timeline.slice(-10)) {
    out.push(line(4, `${row.at} ${row.label}${row.byPlayer ? " [플레이어]" : ""} ${row.states.join(" | ")}`));
  }
  out.push(line(2, `플레이어 개입 ${detail.interventions.length}건`));
  for (const entry of detail.interventions) out.push(line(4, `${entry.at} [${entry.kind}] ${entry.detail}`));
  out.push(line(2, `결과 ${detail.results.length}건`));
  for (const result of detail.results) {
    out.push(line(4, `${result.entityId}.${result.stateKey} ${result.before}→${result.after} (${result.delta})`));
  }
  out.push(line(2, `후속 가능성 ${detail.followUps.length}건`));
  for (const follow of detail.followUps) out.push(line(4, follow.label));
  for (const conflict of detail.goalConflicts) out.push(line(2, `목적 충돌 ${conflict}`));
  out.push(line(2, `소문 ${detail.rumor}`));
  out.push(line(2, `문서 ${detail.document}`));
  for (const say of detail.dialogue) out.push(line(2, `대화 ${say.label}: ${say.line}`));
  return out;
}

export class TextSceneRenderer {
  /** 같은 SceneViewModel → 텍스트. Canvas 렌더러와 나란히 두고 비교하기 위한 것이다 */
  render(scene: SceneViewModel): string {
    const out: string[] = [
      `[시각] ${scene.clock} (tick ${scene.time}) ×${scene.speed} 시점 ${scene.modeKey}`,
      `[세계] ${scene.globalBadges.map((badge) => `${badge.key}=${badge.value}`).join(" ") || "-"}`,
      ...mapDump(scene.map),
      `[사건 목록] ${scene.events.length}건${scene.suppressedEventCount > 0 ? ` (사소한 사건 ${scene.suppressedEventCount}건 접힘)` : ""}`,
      ...scene.events.map((item) =>
        line(
          2,
          `${item.title} (${item.eventId}/${item.type}) ${item.status} 중요도 ${item.significance} ` +
            `참여 ${item.participantCount} 시급 ${item.urgency.toFixed(2)} ${item.known ? "" : "[모름]"}`,
        ),
      ),
    ];
    if (scene.agentPanel !== undefined) out.push(...agentDump(scene.agentPanel));
    if (scene.eventDetail !== undefined) out.push(...eventDump(scene.eventDetail));
    if (scene.player !== undefined) {
      out.push(`[플레이어] ${scene.player.label} (${scene.player.playerId})`);
      out.push(line(2, `할 수 있는 것 ${scene.player.actionPanel.length} · 아는 사건 ${scene.player.eventPanel.length} · 저널 ${scene.player.journal.length}`));
    }
    return out.join("\n");
  }
}
