/**
 * Оверлей рейда в 3D: ломаемые элементы подсвечены, остальное полупрозрачно,
 * номера шагов над элементами, пунктирная линия пути, воспроизведение по шагам.
 */
import * as THREE from 'three';

export interface RaidView {
  /** Ломаемые элементы и двери в порядке прохода. */
  ids: string[];
  /** Точки линии пути. */
  line: [number, number, number][];
}

const HIGHLIGHT = new THREE.MeshStandardMaterial({ color: 0xd23c1e, emissive: 0x6b1407, emissiveIntensity: 0.5, roughness: 0.7, side: THREE.DoubleSide });
const DIM_OPACITY = 0.16;

interface Saved { material: THREE.Material | THREE.Material[] }

function topLevel(content: THREE.Object3D, id: string): THREE.Object3D | undefined {
  return content.children.find(c => c.userData.id === id);
}

function dimObject(o: THREE.Object3D) {
  o.traverse(n => {
    if (!(n instanceof THREE.Mesh) && !(n instanceof THREE.LineSegments)) return;
    const saved: Saved = { material: n.material };
    n.userData.raidSaved = saved;
    const src = n.material as THREE.Material;
    const m = src.clone();
    m.transparent = true;
    m.opacity = n instanceof THREE.LineSegments ? DIM_OPACITY * 0.6 : DIM_OPACITY;
    m.depthWrite = false;
    n.material = m;
  });
}

function highlightObject(o: THREE.Object3D) {
  o.traverse(n => {
    if (!(n instanceof THREE.Mesh)) return;
    n.userData.raidSaved = { material: n.material } satisfies Saved;
    n.material = HIGHLIGHT.clone();
  });
}

function restoreObject(o: THREE.Object3D) {
  o.traverse(n => {
    const saved = n.userData.raidSaved as Saved | undefined;
    if (saved && (n instanceof THREE.Mesh || n instanceof THREE.LineSegments)) {
      (n.material as THREE.Material).dispose?.();
      n.material = saved.material;
      delete n.userData.raidSaved;
    }
  });
  o.visible = true;
}

function numberSprite(n: number): THREE.Sprite {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#cf4820';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff1d6';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(0.6, 0.6, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export class RaidOverlay {
  private group = new THREE.Group();
  private ids: string[] = [];
  private play: { start: number } | null = null;
  private static STEP_MS = 900;

  constructor(private content: THREE.Group, scene: THREE.Scene) {
    scene.add(this.group);
  }

  /** Применить (или снять, если view = null) подсветку к текущему содержимому сцены. */
  apply(view: RaidView | null): void {
    this.clear();
    if (!view) return;
    this.ids = view.ids;
    const set = new Set(view.ids);
    for (const child of this.content.children) {
      if (set.has(child.userData.id)) highlightObject(child);
      else dimObject(child);
    }
    view.ids.forEach((id, i) => {
      const o = topLevel(this.content, id);
      if (!o) return;
      const box = new THREE.Box3().setFromObject(o);
      const c = box.getCenter(new THREE.Vector3());
      const s = numberSprite(i + 1);
      s.position.set(c.x, box.max.y + 0.6, c.z);
      this.group.add(s);
    });
    if (view.line.length >= 2) {
      const geo = new THREE.BufferGeometry().setFromPoints(view.line.map(p => new THREE.Vector3(...p)));
      const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0xff6a3a, dashSize: 0.45, gapSize: 0.22, depthTest: false }));
      line.computeLineDistances();
      line.renderOrder = 9;
      this.group.add(line);
      const end = view.line[view.line.length - 1];
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff6a3a, depthTest: false }));
      marker.position.set(...end);
      marker.renderOrder = 10;
      this.group.add(marker);
    }
  }

  clear(): void {
    this.stop();
    for (const child of this.content.children) restoreObject(child);
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); }
    }
    this.ids = [];
  }

  /** Начать воспроизведение: элементы пути исчезают по очереди. */
  start(now: number): void {
    this.stop();
    if (this.ids.length === 0) return;
    this.play = { start: now };
  }

  stop(): void {
    this.play = null;
    for (const id of this.ids) {
      const o = topLevel(this.content, id);
      if (o) { o.visible = true; o.traverse(n => { if (n instanceof THREE.Mesh) (n.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5; }); }
    }
  }

  /** Шаг анимации; вызывать каждый кадр. */
  tick(now: number): void {
    if (!this.play) return;
    const idx = Math.floor((now - this.play.start) / RaidOverlay.STEP_MS);
    this.ids.forEach((id, i) => {
      const o = topLevel(this.content, id);
      if (!o) return;
      if (i < idx) { o.visible = false; return; }
      if (i === idx) {
        const pulse = 0.5 + 0.5 * Math.sin((now / 90) % (Math.PI * 2));
        o.traverse(n => { if (n instanceof THREE.Mesh) (n.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + pulse * 1.2; });
      }
    });
    if (idx >= this.ids.length) this.play = null;
  }

  get playing(): boolean { return this.play !== null; }
}
