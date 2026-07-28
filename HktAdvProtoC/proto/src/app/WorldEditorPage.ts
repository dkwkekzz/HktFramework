// 세계 구조 검토·편집 화면 (기획서 §36.1 "생성된 세계 구조 검토" 승격 / Phase-8 §8.1)
//
// 단계 아티팩트 트리 + 개별 항목 재생성 버튼. 재생성은 Phase-6 §6.3 증분 재실행을 호출한다 —
// 그 단계 앞의 아티팩트는 재사용되고 그 뒤만 다시 돈다(=/✓ 표식이 그 증거다).
import type { GenerationViewModel } from "../viewmodel/GenerationViewModel";
import { badgeLine, el, escapeHtml, type PageContext } from "./shell";

export class WorldEditorPage {
  private readonly view = el<HTMLElement>("editor");

  constructor(private readonly ctx: PageContext) {}

  render(generation: GenerationViewModel): void {
    if (generation.idle) {
      this.view.innerHTML = "먼저 <b>세계 생성</b> 화면에서 세계를 생성한다.";
      return;
    }
    const rows = generation.steps
      .map(
        (step) =>
          `<div class="step">` +
          `<button data-step="${escapeHtml(step.id)}">↻ 재생성</button> ` +
          `<b>${String(step.index).padStart(2)} ${escapeHtml(step.title)}</b> ` +
          `[${step.status}] ${escapeHtml(step.summary)}` +
          (step.artifactJson.length === 0
            ? ""
            : `<details><summary>산출물 (${step.artifactJson.length}자)</summary><pre>${escapeHtml(step.artifactJson)}</pre></details>`) +
          `</div>`,
      )
      .join("");

    this.view.innerHTML =
      `<div><b>${escapeHtml(generation.title)}</b> — ${escapeHtml(badgeLine(generation.badges))}</div>` +
      `<div class="hint">항목을 재생성하면 그 단계부터 아래 단계가 다시 돈다 (앞 단계는 <code>=</code> 로 재사용된다).</div>` +
      `<hr />${rows}`;

    for (const button of this.view.querySelectorAll<HTMLButtonElement>("button[data-step]")) {
      button.addEventListener("click", () => {
        const stepId = button.dataset["step"];
        if (stepId === undefined) return;
        this.ctx.notify(`${stepId} 부터 증분 재생성 중…`);
        this.ctx.send({ type: "regenerate_step", stepId });
      });
    }
  }
}
