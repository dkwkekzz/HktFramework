// GLB 내보내기 — 의미 속성은 스트립하고 position/normal/tangent/uv(=uvAtlas)만 (D-9).
// three.js 의존은 export/·app/ 에만 허용 (02-architecture §2).

import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

/** GeneratedMesh → three BufferGeometry (렌더·내보내기 공용). */
export function createThreeGeometry(mesh) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions.slice(), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals.slice(), 3));
  geometry.setAttribute("tangent", new THREE.BufferAttribute(mesh.tangents.slice(), 4));
  geometry.setAttribute("uv", new THREE.BufferAttribute(mesh.uvAtlas.slice(), 2));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices.slice(), 1));
  return geometry;
}

/** @returns {Promise<ArrayBuffer>} binary GLB */
export function exportGLB(generatedMesh, name = "Blade") {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.35 });
  const mesh = new THREE.Mesh(createThreeGeometry(generatedMesh), material);
  mesh.name = name;
  scene.add(mesh);
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error("Expected binary GLB output."));
      },
      reject,
      { binary: true, onlyVisible: true },
    );
  });
}
