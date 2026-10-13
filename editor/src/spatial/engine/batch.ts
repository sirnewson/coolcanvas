import * as THREE from "three";
import type { GeoData } from "./geometry";

/**
 * Batched stroke storage.
 *
 * Strokes are appended into fixed-size pages rather than getting a mesh each.
 * One page is one draw call, appending is a buffer sub-upload, and deleting a
 * stroke collapses its triangles instead of rebuilding anything. That is what
 * keeps a few thousand strokes interactive on a tablet.
 */

const PAGE_STEPS = [8192, 16384, 32768, 65536];
const pageCapacity = (n: number) => PAGE_STEPS[Math.min(n, PAGE_STEPS.length - 1)];

interface Slot {
  page: Page;
  v0: number;
  vCount: number;
  i0: number;
  iCount: number;
}

function mark(attr: THREE.BufferAttribute, start: number, count: number) {
  attr.addUpdateRange(start, count);
  attr.needsUpdate = true;
}

class Page {
  geo = new THREE.BufferGeometry();
  mesh: THREE.Mesh;
  capV: number;
  capI: number;
  usedV = 0;
  usedI = 0;
  liveSlots = 0;

  private position: THREE.BufferAttribute;
  private normal: THREE.BufferAttribute;
  private uv: THREE.BufferAttribute;
  private color: THREE.BufferAttribute;
  private alpha: THREE.BufferAttribute;
  private index: THREE.BufferAttribute;

  constructor(capV: number, material: THREE.Material) {
    this.capV = capV;
    this.capI = capV * 3;
    this.position = new THREE.BufferAttribute(new Float32Array(capV * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.normal = new THREE.BufferAttribute(new Float32Array(capV * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.uv = new THREE.BufferAttribute(new Float32Array(capV * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.color = new THREE.BufferAttribute(new Float32Array(capV * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.BufferAttribute(new Float32Array(capV), 1).setUsage(THREE.DynamicDrawUsage);
    this.index = new THREE.BufferAttribute(new Uint32Array(this.capI), 1).setUsage(THREE.DynamicDrawUsage);

    this.geo.setAttribute("position", this.position);
    this.geo.setAttribute("normal", this.normal);
    this.geo.setAttribute("uv", this.uv);
    this.geo.setAttribute("aColor", this.color);
    this.geo.setAttribute("aAlpha", this.alpha);
    this.geo.setIndex(this.index);
    this.geo.setDrawRange(0, 0);
    // The bounding sphere is maintained by hand; strokes arrive one at a time.
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);

    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
  }

  fits(g: GeoData): boolean {
    return this.usedV + g.position.length / 3 <= this.capV && this.usedI + g.index.length <= this.capI;
  }

  append(g: GeoData): Omit<Slot, "page"> {
    const v0 = this.usedV;
    const i0 = this.usedI;
    const vCount = g.position.length / 3;
    const iCount = g.index.length;

    (this.position.array as Float32Array).set(g.position, v0 * 3);
    (this.normal.array as Float32Array).set(g.normal, v0 * 3);
    (this.uv.array as Float32Array).set(g.uv, v0 * 2);
    (this.color.array as Float32Array).set(g.color, v0 * 3);
    (this.alpha.array as Float32Array).set(g.alpha, v0);

    const idx = this.index.array as Uint32Array;
    for (let i = 0; i < iCount; i++) idx[i0 + i] = g.index[i] + v0;

    mark(this.position, v0 * 3, vCount * 3);
    mark(this.normal, v0 * 3, vCount * 3);
    mark(this.uv, v0 * 2, vCount * 2);
    mark(this.color, v0 * 3, vCount * 3);
    mark(this.alpha, v0, vCount);
    mark(this.index, i0, iCount);

    this.usedV += vCount;
    this.usedI += iCount;
    this.liveSlots++;
    this.geo.setDrawRange(0, this.usedI);
    return { v0, vCount, i0, iCount };
  }

  /** Collapse a stroke's triangles to nothing. Cheaper than rebuilding the page. */
  hide(slot: Slot) {
    const idx = this.index.array as Uint32Array;
    for (let i = 0; i < slot.iCount; i++) idx[slot.i0 + i] = slot.v0;
    mark(this.index, slot.i0, slot.iCount);
    this.liveSlots--;
  }

  /** Put a previously hidden stroke back. */
  show(slot: Slot, g: GeoData) {
    const idx = this.index.array as Uint32Array;
    for (let i = 0; i < slot.iCount; i++) idx[slot.i0 + i] = g.index[i] + slot.v0;
    mark(this.index, slot.i0, slot.iCount);
    this.liveSlots++;
  }

  setMaterial(m: THREE.Material) {
    this.mesh.material = m;
  }

  dispose() {
    this.geo.dispose();
  }
}

export class StrokeBatch {
  group = new THREE.Group();
  private pages: Page[] = [];
  private slots = new Map<string, Slot>();
  private material: THREE.Material;

  constructor(material: THREE.Material) {
    this.material = material;
    this.group.matrixAutoUpdate = false;
  }

  get drawCalls() {
    return this.pages.length;
  }

  get size() {
    return this.slots.size;
  }

  has(id: string) {
    return this.slots.has(id);
  }

  add(id: string, g: GeoData) {
    if (this.slots.has(id)) this.remove(id);
    if (g.index.length === 0) return;

    let page = this.pages[this.pages.length - 1];
    if (!page || !page.fits(g)) {
      // A single huge stroke still needs somewhere to live.
      const need = Math.max(pageCapacity(this.pages.length), Math.ceil(g.position.length / 3));
      page = new Page(need, this.material);
      this.pages.push(page);
      this.group.add(page.mesh);
    }
    const s = page.append(g);
    this.slots.set(id, { page, ...s });
  }

  remove(id: string) {
    const slot = this.slots.get(id);
    if (!slot) return;
    slot.page.hide(slot);
    this.slots.delete(id);
    const last = this.pages[this.pages.length - 1];
    // Reclaim fully emptied pages, but keep the one we are still filling.
    for (let i = this.pages.length - 1; i >= 0; i--) {
      const p = this.pages[i];
      if (p.liveSlots <= 0 && p !== last) {
        this.group.remove(p.mesh);
        p.dispose();
        this.pages.splice(i, 1);
      }
    }
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  setMaterial(m: THREE.Material) {
    this.material = m;
    this.pages.forEach((p) => p.setMaterial(m));
  }

  clear() {
    this.pages.forEach((p) => {
      this.group.remove(p.mesh);
      p.dispose();
    });
    this.pages = [];
    this.slots.clear();
  }

  dispose() {
    this.clear();
  }
}
