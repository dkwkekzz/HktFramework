// 세계 생성 화면 (기획서 §36.1 / Phase-8 §8.1)
//
// §36.1 목록 그대로: 주제 입력 · 원하는 경험 · 제외 요소 · 생성 버튼 · 단계 진행 상태 · 생성된 구조 검토.
// 화면은 GenerationViewModel 속성만 읽는다 — 15단계 컴파일은 Worker 뒤에서 돈다(§38).
import type { GenerationViewModel } from "../viewmodel/GenerationViewModel";
import type { WorldPackageStageBadge, WorldSeedInputMessage } from "../shared/protocol";
import { badgeLine, el, escapeHtml, type PageContext } from "./shell";

export class WorldSeedPage {
  private readonly themes = el<HTMLTextAreaElement>("themes");
  private readonly experiences = el<HTMLTextAreaElement>("experiences");
  private readonly prohibited = el<HTMLTextAreaElement>("prohibited");
  private readonly seed = el<HTMLInputElement>("gen-seed");
  private readonly generateButton = el<HTMLButtonElement>("generate");
  private readonly useButton = el<HTMLButtonElement>("use-generated");
  private readonly saveButton = el<HTMLButtonElement>("save-generated");
  private readonly packageView = el<HTMLElement>("package-report");
  private readonly view = el<HTMLElement>("generation");
  private title = "제약의 대륙";

  constructor(private readonly ctx: PageContext) {
    // 입력 칸의 기본값은 §41 첫 세계의 다섯 문장이다 — 화면은 content/ 를 모르므로 시뮬레이션 쪽에 묻는다
    this.ctx.send({ type: "request_seed_input" });

    this.generateButton.addEventListener("click", () => {
      this.generateButton.disabled = true;
      this.view.textContent = "생성 중… (15단계)";
      this.ctx.send({
        type: "generate_world",
        worldSeed: Number(this.seed.value) || 0,
        seedInput: {
          title: this.title,
          themes: lines(this.themes.value),
          desiredExperiences: lines(this.experiences.value),
          prohibitedElements: lines(this.prohibited.value),
        },
      });
    });

    this.useButton.addEventListener("click", () => {
      this.ctx.send({ type: "initialize_world", worldSeed: Number(this.seed.value) || 0, world: "generated" });
      this.ctx.notify("생성된 세계로 시뮬레이션을 시작했다");
    });

    // Phase-9 §9.1 — §3 모듈 1~6 을 정적으로 돌려 패키지로 굽는다. 저장은 world_package 응답을 받은 쪽이 한다
    this.saveButton.addEventListener("click", () => {
      this.packageView.textContent = "§3 모듈 1~6 을 돌려 패키지를 굽는 중…";
      this.ctx.send({ type: "export_world", world: "generated", worldSeed: Number(this.seed.value) || 0 });
    });
  }

  /** 패키지 빌드 보고 (§3 모듈 1~6) — ✓/✗ 와 수치 근거를 그대로 보여 준다 */
  showPackageReport(stages: WorldPackageStageBadge[], savedLabel: string | undefined): void {
    const rows = stages
      .map(
        (stage) =>
          `<div class="${stage.ok ? "" : "fail"}">${stage.ok ? "✓" : "✗"} ${escapeHtml(stage.id)} ` +
          `${escapeHtml(stage.title)} — ${escapeHtml(stage.evidence)}</div>`,
      )
      .join("");
    this.packageView.innerHTML =
      rows +
      (savedLabel === undefined
        ? `<div class="fail">보관 실패 — 브라우저 저장소에 쓸 수 없다</div>`
        : `<div>보관 완료: <b>${escapeHtml(savedLabel)}</b> — 플레이 모드의 세계 목록에 나타난다</div>`);
  }

  /** 생성이 끝났거나 실패했을 때 버튼 상태를 되돌린다 */
  settle(): void {
    this.generateButton.disabled = false;
  }

  /** §4 입력 기본값 채우기 */
  fill(input: WorldSeedInputMessage): void {
    this.title = input.title;
    this.themes.value = input.themes.join("\n");
    this.experiences.value = input.desiredExperiences.join("\n");
    this.prohibited.value = input.prohibitedElements.join("\n");
  }

  render(view: GenerationViewModel): void {
    this.generateButton.disabled = false;
    if (view.idle) {
      this.view.innerHTML = "";
      return;
    }
    const mark = (status: string): string => (status === "failed" ? "✗" : status === "reused" ? "=" : "✓");
    const steps = view.steps
      .map(
        (step) =>
          `<div class="${step.status === "failed" ? "fail" : ""}">${mark(step.status)} ${String(step.index).padStart(2)} ` +
          `${escapeHtml(step.title)} — ${escapeHtml(step.summary)}` +
          `${step.callCount > 0 ? ` (생성 호출 ${step.callCount})` : ""}` +
          `${step.error === undefined ? "" : `\n    ${escapeHtml(step.error)}`}</div>`,
      )
      .join("");
    const scale = view.scale
      .map((row) => `${row.ok ? "✓" : "✗"} ${row.item} ${row.actual}/${row.target}`)
      .join(" · ");
    const expectations = view.expectations
      .map((item) => `${item.ok ? "✓" : "✗"} ${escapeHtml(item.item)}: ${escapeHtml(item.evidence)}`)
      .join("\n");
    const issues =
      view.issues.length === 0
        ? "정합성 검증 통과"
        : `<span class="fail">${view.issues
            .map((issue) => escapeHtml(`[${issue.level}] ${issue.message}`))
            .join("\n")}</span>`;

    this.useButton.disabled = view.issues.length > 0;
    this.saveButton.disabled = view.issues.length > 0;
    this.view.innerHTML =
      `<h3>${escapeHtml(view.title)}</h3><div>${escapeHtml(badgeLine(view.badges))}</div><hr />${steps}<hr />` +
      `<div><b>§40 규모</b>\n${escapeHtml(scale)}</div><hr />` +
      `<div><b>§41 자동 생성 결과</b>\n${expectations}</div><hr /><div>${issues}</div>`;
  }
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
