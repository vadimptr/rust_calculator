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
  /** Точки удара: где и сколько. */
  impacts?: { point: [number, number, number]; count: number }[];
  /** Этапы: элементы одного этапа исчезают вместе; номер на элементе — номер этапа. */
  stages?: { ids: string[] }[];
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
    const dim = (src: THREE.Material) => {
      const m = src.clone();
      m.transparent = true;
      m.opacity = n instanceof THREE.LineSegments ? DIM_OPACITY * 0.6 : DIM_OPACITY;
      m.depthWrite = false;
      return m;
    };
    n.material = Array.isArray(n.material) ? n.material.map(dim) : dim(n.material);
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
      for (const m of [n.material].flat()) m.dispose();
      n.material = saved.material;
      delete n.userData.raidSaved;
    }
  });
  o.visible = true;
}

function numberSprite(n: number | string, fill = '#cf4820'): THREE.Sprite {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff1d6';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${String(n).length > 2 ? 44 : 64}px system-ui, sans-serif`;
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
  private stages: string[][] = [];
  private play: { start: number } | null = null;
  private static STEP_MS = 1300;

  constructor(private content: THREE.Group, scene: THREE.Scene) {
    scene.add(this.group);
  }

  /** Применить (или снять, если view = null) подсветку к текущему содержимому сцены. */
  apply(view: RaidView | null): void {
    this.clear();
    if (!view) return;
    this.ids = view.ids;
    this.stages = view.stages?.length ? view.stages.map(st => st.ids) : view.ids.map(id => [id]);
    const set = new Set(view.ids);
    for (const child of this.content.children) {
      if (set.has(child.userData.id)) highlightObject(child);
      else dimObject(child);
    }
    this.stages.forEach((ids, i) => {
      for (const id of ids) {
        const o = topLevel(this.content, id);
        if (!o) continue;
        const box = new THREE.Box3().setFromObject(o);
        const c = box.getCenter(new THREE.Vector3());
        const s = numberSprite(i + 1);
        s.position.set(c.x, box.max.y + 0.6, c.z);
        this.group.add(s);
      }
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
    for (const imp of view.impacts ?? []) {
      const blast = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9, depthTest: false }),
      );
      blast.position.set(...imp.point);
      blast.renderOrder = 11;
      this.group.add(blast);
      const label = numberSprite(`×${imp.count}`, '#b8860b');
      label.scale.set(0.5, 0.5, 1);
      label.position.set(imp.point[0], imp.point[1] + 0.45, imp.point[2]);
      this.group.add(label);
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
    this.stages = [];
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

  /** Шаг анимации; вызывать каждый кадр. Элементы одного этапа мигают и исчезают вместе. */
  tick(now: number): void {
    if (!this.play) return;
    const idx = Math.floor((now - this.play.start) / RaidOverlay.STEP_MS);
    this.stages.forEach((ids, i) => {
      for (const id of ids) {
        const o = topLevel(this.content, id);
        if (!o) continue;
        if (i < idx) { o.visible = false; continue; }
        if (i === idx) {
          const pulse = 0.5 + 0.5 * Math.sin((now / 90) % (Math.PI * 2));
          o.traverse(n => { if (n instanceof THREE.Mesh) (n.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + pulse * 1.2; });
        }
      }
    });
    if (idx >= this.stages.length) this.play = null;
  }

  get playing(): boolean { return this.play !== null; }
}
