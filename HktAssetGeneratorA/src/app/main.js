// 앱 진입 — 파라미터 → 칼날 생성 → 검증 리포트 → 뷰어/UV 프리뷰 (03-phase1 §1.7).

import { buildBladeMesh, makeStraightBladeDesign } from "../mesh/blade.js";
import { analyzeManifold, countDegenerate3DTriangles } from "../mesh/topology.js";
import { validateUVs } from "../uv/validate.js";
import { hashMesh } from "../core/hash.js";
import { createViewer } from "./viewer.js";
import { createPanel, paramsToDesignInput, downloadBlob } from "./panels.js";
import { exportGLB } from "../export/glb.js";
import presets from "../../test/golden/blade-presets.json";

const TEXTURE_SIZE = 1024;

const viewer = createViewer(document.getElementById("viewport"));

let currentMesh = null;
let currentDesign = null;

function rebuild(params) {
  try {
    currentDesign = makeStraightBladeDesign(paramsToDesignInput(params));
    const t0 = performance.now();
    currentMesh = buildBladeMesh(currentDesign, TEXTURE_SIZE);
    const buildMs = performance.now() - t0;

    viewer.setMesh(currentMesh);
    panel.drawUV(currentMesh);

    const man = analyzeManifold(currentMesh);
    const uv = validateUVs(currentMesh, TEXTURE_SIZE);
    const deg3 = countDegenerate3DTriangles(currentMesh);
    panel.setStats(
      `triangles: ${currentMesh.indices.length / 3}  (${buildMs.toFixed(1)}ms)\n` +
      `non-manifold: ${man.nonManifoldEdges}  boundary: ${man.boundaryEdges}  deg3D: ${deg3}\n` +
      `UV overlap: ${uv.overlaps}  oob: ${uv.outOfBoundsVertices}  degUV: ${uv.degenerateTriangles}\n` +
      `padding: ${uv.minimumPaddingPixels.toFixed(1)}px  ` +
      `density(U/V): ${uv.texelDensityDeviation.u.toFixed(2)}/${uv.texelDensityDeviation.v.toFixed(2)}\n` +
      `hash: ${hashMesh(currentMesh)}`,
    );
  } catch (err) {
    panel.setStats(`오류: ${err.message}`);
    console.error(err);
  }
}

const panel = createPanel(document.getElementById("panel"), {
  presets,
  onChange: rebuild,
  onViewerOption: (name, value) => viewer.setOption(name, value),
  onExportGLB: async () => {
    if (!currentMesh) return;
    const glb = await exportGLB(currentMesh, "Blade");
    downloadBlob(glb, "blade.glb", "model/gltf-binary");
  },
  onDownloadDesign: () => {
    if (!currentDesign) return;
    downloadBlob(JSON.stringify(currentDesign, null, 2), "design.json", "application/json");
  },
});

rebuild(panel.params);
