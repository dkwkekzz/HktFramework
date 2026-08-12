// GameView 렌더러 — RenderState(binding 산출물)만 소비해 three.js 장면과 HUD 를 갱신한다.
// World 를 알지 못한다 (Rule 7·8). 스프라이트 빌보드 + 3D 지형 + 추적 카메라.

import * as THREE from 'three';
import { drawLabel, sprites, type SpriteSource } from './assets/sprites';
import type { DepositRenderState, RenderState } from './binding';
import { buildTerrain, terrainHeight } from './terrain';

const CHARACTER_HEIGHT = 1.7;
const DEPOSIT_HEIGHT = 1.2;
const SWING_PERIOD_MS = 220; // 채굴 스윙 프레임 교체 주기

function makeSpriteMaterial(src: SpriteSource): THREE.SpriteMaterial {
  const tex = new THREE.CanvasTexture(src.canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
}

interface DepositVisual {
  root: THREE.Group;
  sprite: THREE.Sprite;
  fullMat: THREE.SpriteMaterial;
  depletedMat: THREE.SpriteMaterial;
  ring: THREE.Mesh;
  label: THREE.Sprite;
  labelText: string;
  depleted: boolean;
}

export class GameViewRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;

  private character: THREE.Sprite;
  private characterIdleMat: THREE.SpriteMaterial;
  private characterSwingMat: THREE.SpriteMaterial;
  private depositVisuals = new Map<string, DepositVisual>();

  private hudStone: HTMLElement;
  private hudHint: HTMLElement;
  private hudFeedback: HTMLElement;
  private feedbackShownAt = 0;
  private lastFeedback = '';

  constructor(container: HTMLElement, hud: { stone: HTMLElement; hint: HTMLElement; feedback: HTMLElement }) {
    this.hudStone = hud.stone;
    this.hudHint = hud.hint;
    this.hudFeedback = hud.feedback;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );

    // 무대: 하늘/안개/광원/지형
    this.scene.background = new THREE.Color('#9ec8e8');
    this.scene.fog = new THREE.Fog('#9ec8e8', 24, 60);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b7d57', 1.15));
    const sun = new THREE.DirectionalLight('#fff4dc', 1.1);
    sun.position.set(8, 14, 6);
    this.scene.add(sun);
    this.scene.add(buildTerrain());

    // 캐릭터 빌보드
    this.characterIdleMat = makeSpriteMaterial(sprites.characterIdle());
    this.characterSwingMat = makeSpriteMaterial(sprites.characterSwing());
    this.character = new THREE.Sprite(this.characterIdleMat);
    const charAspect = 16 / 20;
    this.character.scale.set(CHARACTER_HEIGHT * charAspect, CHARACTER_HEIGHT, 1);
    this.scene.add(this.character);

    window.addEventListener('resize', () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });
  }

  private ensureDepositVisual(id: string): DepositVisual {
    let v = this.depositVisuals.get(id);
    if (v) return v;

    const fullMat = makeSpriteMaterial(sprites.depositFull());
    const depletedMat = makeSpriteMaterial(sprites.depositDepleted());
    const sprite = new THREE.Sprite(fullMat);
    const aspect = 18 / 14;
    sprite.scale.set(DEPOSIT_HEIGHT * aspect, DEPOSIT_HEIGHT, 1);
    sprite.position.y = DEPOSIT_HEIGHT * 0.5;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.3, 40),
      new THREE.MeshBasicMaterial({ color: '#ffe45c', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.visible = false;

    const label = new THREE.Sprite(makeSpriteMaterial(drawLabel('')));
    label.scale.set(1.9, 0.48, 1);
    label.position.y = DEPOSIT_HEIGHT + 0.55;

    const root = new THREE.Group();
    root.add(sprite, ring, label);
    this.scene.add(root);

    v = { root, sprite, fullMat, depletedMat, ring, label, labelText: '', depleted: false };
    this.depositVisuals.set(id, v);
    return v;
  }

  private updateDeposit(v: DepositVisual, d: DepositRenderState): void {
    const y = terrainHeight(d.worldPosition.x, d.worldPosition.z);
    v.root.position.set(d.worldPosition.x, y, d.worldPosition.z);
    if (v.depleted !== d.depleted) {
      v.depleted = d.depleted;
      v.sprite.material = d.depleted ? v.depletedMat : v.fullMat;
    }
    v.ring.visible = d.interactionRing;
    if (v.labelText !== d.amountLabel) {
      v.labelText = d.amountLabel;
      v.label.material.map?.dispose();
      v.label.material.dispose();
      v.label.material = makeSpriteMaterial(drawLabel(d.amountLabel));
    }
  }

  // RenderState 하나로 장면 전체를 갱신 — 유일한 공개 갱신 경로
  render(state: RenderState, nowMs: number): void {
    // Character ← Actor.Position / CurrentAction
    const { x, z } = state.character.worldPosition;
    const groundY = terrainHeight(x, z);
    const swingPhase = Math.floor(nowMs / SWING_PERIOD_MS) % 2 === 0;
    this.character.material =
      state.character.mining && swingPhase ? this.characterSwingMat : this.characterIdleMat;
    const bob = state.character.mining ? Math.sin(nowMs / 55) * 0.05 : 0;
    this.character.position.set(x, groundY + CHARACTER_HEIGHT * 0.5 + bob, z);

    // Deposits ← VisibleDeposit / ResourceAmount / Availability
    const seen = new Set<string>();
    for (const d of state.deposits) {
      seen.add(d.id);
      this.updateDeposit(this.ensureDepositVisual(d.id), d);
    }
    for (const [id, v] of this.depositVisuals) {
      v.root.visible = seen.has(id);
    }

    // HUD ← Inventory.Stone / Availability / ActionResult
    this.hudStone.textContent = `⛏ Stone: ${state.hud.stoneCount}`;
    this.hudHint.textContent = state.hud.interactionHint;
    if (state.hud.feedbackLine && state.hud.feedbackLine !== this.lastFeedback) {
      this.lastFeedback = state.hud.feedbackLine;
      this.feedbackShownAt = nowMs;
    }
    const feedbackAge = nowMs - this.feedbackShownAt;
    this.hudFeedback.textContent = feedbackAge < 1800 ? this.lastFeedback : '';

    // 추적 카메라
    const camTarget = new THREE.Vector3(x, groundY + 1.0, z);
    this.camera.position.set(x, groundY + 5.2, z + 7.5);
    this.camera.lookAt(camTarget);

    this.renderer.render(this.scene, this.camera);
  }
}
