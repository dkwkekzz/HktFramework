// Operation 로그 패널 — 순수 DOM UI (06-phase4 §4.1·§4.5).
// 목록·삭제·재정렬·프리셋·operations.json 입출력. 로그가 바뀌면 재베이크는 사용자가 누른다
// (베이크는 명시적 버튼 — 02-architecture §8 성능 예산).

import {
  OPERATION_TYPES, SELECTOR_TYPES, normalizeOperation,
  serializeOperations, parseOperations,
} from "../material/operations.js";
import { SCRATCH_DIRECTIONS, DEFAULT_SCRATCH_SPEC } from "../material/scratch.js";
import { MASK_IDS } from "../material/masks.js";
import { AGED_PRESETS } from "../material/presets.js";

const PART_LABELS = ["칼날", "가드", "손잡이", "폼멜"];
const TYPE_LABELS = {
  assign_material: "물질 배정", polish: "연마", oxidize: "산화",
  dirt: "오염", scratch: "긁힘", engrave: "조각",
};
const PRIMS = ["carbon_steel", "bronze", "leather"];

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

function summarize(op) {
  const head = `${TYPE_LABELS[op.type]} · ${PART_LABELS[op.targetPartId]}`;
  switch (op.type) {
    case "assign_material": return `${head} · ${op.primitiveId}`;
    case "scratch": return `${head} · ${op.count}개 ${op.direction} seed=${op.seed}`;
    case "engrave": return `${head} · ${op.maskId} 깊이 ${op.depth}`;
    default: {
      const s = op.selector.type === "local_uv"
        ? `uv[${op.selector.bounds.u0},${op.selector.bounds.v0}]~[${op.selector.bounds.u1},${op.selector.bounds.v1}]`
        : op.selector.type;
      return `${head} · ${s} ${op.strength}`;
    }
  }
}

/**
 * @param container 패널 DOM
 * @param onChange (operations) => void — 로그가 바뀔 때마다
 * @returns {{ operations, setOperations }}
 */
export function createOperationLog(container, onChange) {
  let operations = [];

  const list = el("div", { className: "op-list" });
  const emit = () => { onChange(operations.slice()); render(); };

  function render() {
    list.textContent = "";
    if (operations.length === 0) {
      list.appendChild(el("div", { className: "op-empty", textContent: "로그 없음 (기본 표면)" }));
      return;
    }
    operations.forEach((op, index) => {
      const row = el("div", { className: "op-row" });
      row.appendChild(el("span", { className: "op-text", textContent: `${index + 1}. ${summarize(op)}` }));
      const button = (text, title, action) => {
        const b = el("button", { textContent: text, title, className: "op-btn" });
        b.addEventListener("click", action);
        row.appendChild(b);
      };
      button("↑", "위로", () => {
        if (index === 0) return;
        [operations[index - 1], operations[index]] = [operations[index], operations[index - 1]];
        emit();
      });
      button("↓", "아래로", () => {
        if (index === operations.length - 1) return;
        [operations[index + 1], operations[index]] = [operations[index], operations[index + 1]];
        emit();
      });
      button("✕", "삭제", () => { operations.splice(index, 1); emit(); });
      list.appendChild(row);
    });
  }

  // ── 추가 폼 ──────────────────────────────────────────────────────────────
  const form = el("div", { className: "op-form" });
  const fields = {};
  const rows = {};

  const addField = (key, label, control, group) => {
    const row = el("div", { className: "row" });
    row.appendChild(el("label", { textContent: label }));
    row.appendChild(control);
    form.appendChild(row);
    fields[key] = control;
    rows[key] = { row, group };
  };
  const select = (values, labels) => {
    const s = el("select");
    values.forEach((v, i) => s.appendChild(el("option", { value: v, textContent: labels ? labels[i] : v })));
    return s;
  };
  const number = (value, step = 0.05) => el("input", { type: "number", value: String(value), step: String(step) });

  const typeSelect = select(OPERATION_TYPES, OPERATION_TYPES.map((t) => TYPE_LABELS[t]));
  typeSelect.value = "polish";
  addField("type", "종류", typeSelect, "*");
  addField("part", "부품", select(["0", "1", "2", "3"], PART_LABELS), "*");
  addField("primitiveId", "물질", select(PRIMS), "assign_material");
  addField("selector", "선택자", select(SELECTOR_TYPES), "field");
  addField("strength", "강도", number(0.5), "field");
  const bounds = el("div", { className: "op-bounds" });
  const boundInputs = {};
  for (const [key, value] of [["u0", 0], ["v0", 0], ["u1", 1], ["v1", 1]]) {
    const input = number(value, 0.05);
    input.style.width = "44px";
    boundInputs[key] = input;
    bounds.appendChild(input);
  }
  addField("bounds", "uv 범위", bounds, "bounds");
  addField("count", "긁힘 수", number(DEFAULT_SCRATCH_SPEC.count, 1), "scratch");
  addField("direction", "방향", select(SCRATCH_DIRECTIONS), "scratch");
  addField("seed", "seed", number(DEFAULT_SCRATCH_SPEC.seed, 1), "scratch");
  addField("maskId", "마스크", select(MASK_IDS), "engrave");
  addField("depth", "깊이", number(0.35), "engrave");
  addField("offsetU", "배치 u", number(0.5), "engrave");
  addField("offsetV", "배치 v", number(0.5), "engrave");
  addField("scaleU", "크기 u", number(0.3), "engrave");
  addField("scaleV", "크기 v", number(0.3), "engrave");
  addField("rotation", "회전(rad)", number(0, 0.1), "engrave");

  const isFieldOp = (t) => t === "polish" || t === "oxidize" || t === "dirt";
  function syncForm() {
    const type = typeSelect.value;
    for (const [key, { row, group }] of Object.entries(rows)) {
      const visible = group === "*"
        || (group === "field" && isFieldOp(type))
        || (group === "bounds" && isFieldOp(type) && fields.selector.value === "local_uv")
        || group === type;
      row.style.display = visible ? "" : "none";
      if (key === "type" || key === "part") row.style.display = "";
    }
  }
  typeSelect.addEventListener("change", syncForm);
  fields.selector.addEventListener("change", syncForm);

  const addButton = el("button", { textContent: "Operation 추가" });
  addButton.addEventListener("click", () => {
    const type = typeSelect.value;
    const targetPartId = Number(fields.part.value);
    const raw = { type, targetPartId };
    if (type === "assign_material") raw.primitiveId = fields.primitiveId.value;
    else if (isFieldOp(type)) {
      const selectorType = fields.selector.value;
      raw.selector = selectorType === "local_uv"
        ? {
          type: "local_uv",
          bounds: Object.fromEntries(
            Object.entries(boundInputs).map(([k, input]) => [k, Number(input.value)])),
        }
        : { type: selectorType };
      raw.strength = Number(fields.strength.value);
    } else if (type === "scratch") {
      raw.count = Number(fields.count.value) | 0;
      raw.direction = fields.direction.value;
      raw.seed = Number(fields.seed.value) | 0;
    } else if (type === "engrave") {
      raw.maskId = fields.maskId.value;
      raw.depth = Number(fields.depth.value);
      raw.transform = {
        offset: [Number(fields.offsetU.value), Number(fields.offsetV.value)],
        scale: [Number(fields.scaleU.value), Number(fields.scaleV.value)],
        rotation: Number(fields.rotation.value),
      };
    }
    try {
      operations.push(normalizeOperation(raw));
      emit();
    } catch (err) {
      window.alert(`Operation 추가 실패: ${err.message}`);
    }
  });

  // ── 프리셋·입출력 ────────────────────────────────────────────────────────
  const presetRow = el("div", { className: "op-presets" });
  for (const preset of AGED_PRESETS) {
    const b = el("button", { textContent: preset.label, className: "op-btn" });
    b.addEventListener("click", () => {
      operations = preset.operations.map(normalizeOperation);
      emit();
    });
    presetRow.appendChild(b);
  }
  const clear = el("button", { textContent: "비우기", className: "op-btn" });
  clear.addEventListener("click", () => { operations = []; emit(); });
  presetRow.appendChild(clear);

  const fileInput = el("input", { type: "file", accept: "application/json" });
  fileInput.style.display = "none";
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      operations = parseOperations(await file.text());
      emit();
    } catch (err) {
      window.alert(`operations.json 읽기 실패: ${err.message}`);
    }
    fileInput.value = "";
  });
  const loadButton = el("button", { textContent: "operations.json 불러오기", className: "op-btn" });
  loadButton.addEventListener("click", () => fileInput.click());
  presetRow.appendChild(loadButton);

  container.appendChild(list);
  container.appendChild(form);
  container.appendChild(addButton);
  container.appendChild(presetRow);
  container.appendChild(fileInput);
  syncForm();
  render();

  return {
    get operations() { return operations.slice(); },
    toJSON: () => serializeOperations(operations),
    setOperations(next) { operations = next.map(normalizeOperation); emit(); },
  };
}
