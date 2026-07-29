// 앱 진입 — 검 생성 → 검증 리포트 → 뷰어/UV 프리뷰 + Worker 베이크 (05-phase3 §3.6).

import { makeSwordDesign, buildSword, hashSword } from "../mesh/sword.js";
import { analyzeManifold, countDegenerate3DTriangles } from "../mesh/topology.js";
import { validateUVs } from "../uv/validate.js";
import { makeMaterialGraph } from "../material/primitives.js";
import { createViewer } from "./viewer.js";
import {
  createPanel, paramsToSwordInput, paramsToMaterialInput, downloadBlob,
} from "./panels.js";
import { exportSwordGLB } from "../export/glb.js";
import swordPresets from "../../test/golden/sword-presets.json";
import bladePresets from "../../test/golden/blade-presets.json";

const TEXTURE_SIZE = 1024;

const viewer = createViewer(document.getElementById("viewport"));
const bakeWorker = new Worker(new URL("../bake/worker.js", import.meta.url), { type: "module" });

let currentSword = null;
let currentDesign = null;
let currentTextures = null;
let baking = false;
let lastStats = "";

function setStatsWithBake(text) {
  lastStats = text;
  panel.setStats(text + (currentTextures ? `\nbake: ${currentTextures.hash} (${currentTextures.elapsed | 0}ms)` : ""));
}

function rebuild(params) {
  try {
    currentDesign = makeSwordDesign(paramsToSwordInput(params));
    const t0 = performance.now();
    currentSword = buildSword(currentDesign, TEXTURE_SIZE);
    const buildMs = performance.now() - t0;

    viewer.setParts(currentSword.parts);
    panel.drawUV(currentSword.merged);

    const uv = validateUVs(currentSword.merged, TEXTURE_SIZE);
    const partLines = currentSword.parts.map((p) => {
      const man = analyzeManifold(p.mesh);
      const deg3 = countDegenerate3DTriangles(p.mesh);
      return `${p.name}: tri=${p.mesh.indices.length / 3} nm=${man.nonManifoldEdges} bd=${man.boundaryEdges} deg=${deg3}`;
    });
    setStatsWithBake(
      `triangles: ${currentSword.triangleCount}  (${buildMs.toFixed(1)}ms)\n` +
      partLines.join("\n") + "\n" +
      `UV overlap: ${uv.overlaps}  oob: ${uv.outOfBoundsVertices}  degUV: ${uv.degenerateTriangles}\n` +
      `padding: ${uv.minimumPaddingPixels.toFixed(1)}px  ` +
      `density(U/V): ${uv.texelDensityDeviation.u.toFixed(2)}/${uv.texelDensityDeviation.v.toFixed(2)}\n` +
      `hash: ${hashSword(currentSword)}`,
    );
  } catch (err) {
    panel.setStats(`오류: ${err.message}`);
    console.error(err);
  }
}

bakeWorker.onmessage = (event) => {
  baking = false;
  const msg = event.data;
  if (!msg.ok) {
    panel.setStats(lastStats + `\n베이크 오류: ${msg.message}`);
    return;
  }
  currentTextures = {
    baseColor: new Uint8Array(msg.baseColor),
    normal: new Uint8Array(msg.normal),
    orm: new Uint8Array(msg.orm),
    size: msg.size,
    hash: msg.hash,
    elapsed: msg.elapsed,
  };
  viewer.applyTextures(currentTextures);
  setStatsWithBake(lastStats);
};

/** 표시 전용 PNG 인코딩 (Canvas 2D — 결정 경로 아님) */
function textureToPNG(data, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = new ImageData(new Uint8ClampedArray(data), size, size);
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

const panel = createPanel(document.getElementById("panel"), {
  swordPresets,
  bladePresets,
  onChange: rebuild,
  onViewerOption: (name, value) => viewer.setOption(name, value),
  onBake: (params) => {
    if (baking || !currentDesign) return;
    baking = true;
    panel.setStats(lastStats + "\n베이크 중…");
    bakeWorker.postMessage({
      design: currentDesign,
      materialGraph: makeMaterialGraph(paramsToMaterialInput(params)),
      seed: params.seed,
      size: TEXTURE_SIZE,
    });
  },
  onExportGLB: async () => {
    if (!currentSword) return;
    const glb = await exportSwordGLB(currentSword.parts);
    downloadBlob(glb, "sword.glb", "model/gltf-binary");
  },
  onDownloadDesign: () => {
    if (!currentDesign) return;
    downloadBlob(JSON.stringify(currentDesign, null, 2), "design.json", "application/json");
  },
  onDownloadTextures: async () => {
    if (!currentTextures) return;
    const { size } = currentTextures;
    downloadBlob(await textureToPNG(currentTextures.baseColor, size), "sword_basecolor.png");
    downloadBlob(await textureToPNG(currentTextures.normal, size), "sword_normal.png");
    downloadBlob(await textureToPNG(currentTextures.orm, size), "sword_orm.png");
  },
});

rebuild(panel.params);
