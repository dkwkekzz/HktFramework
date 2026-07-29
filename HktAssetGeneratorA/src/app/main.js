// 앱 진입 — 파라미터 → 검 전체 생성 → 검증 리포트 → 뷰어/UV 프리뷰 (04-phase2 §2.6).

import { makeSwordDesign, buildSword, hashSword } from "../mesh/sword.js";
import { analyzeManifold, countDegenerate3DTriangles } from "../mesh/topology.js";
import { validateUVs } from "../uv/validate.js";
import { createViewer } from "./viewer.js";
import { createPanel, paramsToSwordInput, downloadBlob } from "./panels.js";
import { exportSwordGLB } from "../export/glb.js";
import swordPresets from "../../test/golden/sword-presets.json";
import bladePresets from "../../test/golden/blade-presets.json";

const TEXTURE_SIZE = 1024;

const viewer = createViewer(document.getElementById("viewport"));

let currentSword = null;
let currentDesign = null;

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
    panel.setStats(
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

const panel = createPanel(document.getElementById("panel"), {
  swordPresets,
  bladePresets,
  onChange: rebuild,
  onViewerOption: (name, value) => viewer.setOption(name, value),
  onExportGLB: async () => {
    if (!currentSword) return;
    const glb = await exportSwordGLB(currentSword.parts);
    downloadBlob(glb, "sword.glb", "model/gltf-binary");
  },
  onDownloadDesign: () => {
    if (!currentDesign) return;
    downloadBlob(JSON.stringify(currentDesign, null, 2), "design.json", "application/json");
  },
});

rebuild(panel.params);
