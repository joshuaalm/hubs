/* global THREE */

// See doc/spritesheet-generation.md for information about this spritesheet
import spritesheetAction from "../assets/images/spritesheets/sprite-system-action-spritesheet.json";
import spritesheetNotice from "../assets/images/spritesheets/sprite-system-notice-spritesheet.json";
import { createImageTexture } from "../utils/media-utils";
import spritesheetActionPng from "../assets/images/spritesheets/sprite-system-action-spritesheet.png";
import spritesheetNoticePng from "../assets/images/spritesheets/sprite-system-notice-spritesheet.png";
import { waitForDOMContentLoaded } from "../utils/async-utils";
import vert from "./sprites/sprite.vert";
import frag from "./sprites/sprite.frag";
import { getThemeColorShifter } from "../utils/theme-sprites";
const nonmultiviewVertPrefix = ["uniform mat4 modelViewMatrix;", "uniform mat4 projectionMatrix;", ""].join("\n");

const nonmultiviewFragPrefix = "";

function isVisible(o) {
  if (!o.visible) return false;
  if (!o.parent) return true;
  return isVisible(o.parent);
}

const normalizedFrame = (function() {
  const memo = new Map();
  return function normalizedFrame(name, spritesheet, missingSprites) {
    let ret = memo.get(name);
    if (ret) {
      return ret;
    } else {
      if (!spritesheet.frames[name]) {
        if (missingSprites.indexOf(name) === -1) {
          missingSprites.push(name);
        }
        ret = { x: 0, y: 0, w: 0, h: 0 };
        memo.set(name, ret);
        return ret;
      }
      const size = spritesheet.meta.size;
      const frame = spritesheet.frames[name].frame;
      ret = {
        x: frame.x / size.w,
        y: frame.y / size.h,
        w: frame.w / size.w,
        h: frame.h / size.h
      };
      memo.set(name, ret);
      return ret;
    }
  };
})();

const getSheetType = sprite => (spritesheetAction.frames[sprite.data.name] ? "action" : "notice");
const SHEET_TYPES = ["action", "notice"];

const raycastOnSprite = (function() {
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const vD = new THREE.Vector3();
  const point = new THREE.Vector3();
  const intersectionInfo = { distance: 0, point, object: null };

  return function raycast(raycaster, intersects) {
    this.updateMatrices();
    vA.set(-0.5, 0.5, 0).applyMatrix4(this.matrixWorld);
    vB.set(0.5, 0.5, 0).applyMatrix4(this.matrixWorld);
    vC.set(-0.5, -0.5, 0).applyMatrix4(this.matrixWorld);
    let intersect = raycaster.ray.intersectTriangle(vA, vC, vB, false, point);
    if (intersect === null) {
      vD.set(0.5, -0.5, 0).applyMatrix4(this.matrixWorld);
      intersect = raycaster.ray.intersectTriangle(vB, vC, vD, false, point);
      if (intersect === null) {
        return;
      }
    }

    const distance = raycaster.ray.origin.distanceTo(point);
    if (distance < raycaster.near || distance > raycaster.far) return;

    intersectionInfo.distance = distance;
    intersectionInfo.point = point;
    intersectionInfo.object = this;
    intersects.push(intersectionInfo);
  };
})();

function createGeometry(maxSprites) {
  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute("a_vertices", new THREE.BufferAttribute(new Float32Array(maxSprites * 3 * 4), 3, false));
  geometry.addAttribute("a_uvs", new THREE.BufferAttribute(new Float32Array(maxSprites * 2 * 4), 2, false));
  const mvCols = new THREE.InterleavedBuffer(new Float32Array(maxSprites * 16 * 4), 16);
  geometry.addAttribute("mvCol0", new THREE.InterleavedBufferAttribute(mvCols, 4, 0, false));
  geometry.addAttribute("mvCol1", new THREE.InterleavedBufferAttribute(mvCols, 4, 4, false));
  geometry.addAttribute("mvCol2", new THREE.InterleavedBufferAttribute(mvCols, 4, 8, false));
  geometry.addAttribute("mvCol3", new THREE.InterleavedBufferAttribute(mvCols, 4, 12, false));
  const indices = new Array(3 * 2 * maxSprites);
  for (let i = 0; i < maxSprites; i++) {
    indices[i * 3 * 2 + 0] = i * 4 + 0;
    indices[i * 3 * 2 + 1] = i * 4 + 2;
    indices[i * 3 * 2 + 2] = i * 4 + 1;
    indices[i * 3 * 2 + 3] = i * 4 + 1;
    indices[i * 3 * 2 + 4] = i * 4 + 2;
    indices[i * 3 * 2 + 5] = i * 4 + 3;
  }
  geometry.setIndex(indices);
  return geometry;
}

const ZEROS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export class SpriteSystem {
  raycast(raycaster, intersects) {
    for (let i = 0; i < SHEET_TYPES.length; i++) {
      const sheetType = SHEET_TYPES[i];
      const slots = this.slots[sheetType];

      for (let i = 0, l = slots.length; i < l; i++) {
        if (!slots[i]) continue;

        const o = this.indexWithSprite[sheetType].get(i).el.object3D;
        if (isVisible(o)) {
          raycastOnSprite.call(o, raycaster, intersects);
        }
      }
    }

    return intersects;
  }
  constructor(scene) {
    this.missingSprites = [];
    this.maxSprites = 1;
    this.slots = { action: new Array(this.maxSprites), notice: new Array(this.maxSprites) };
    this.spriteWithIndex = { action: new Map(), notice: new Map() };
    this.indexWithSprite = { action: new Map(), notice: new Map() };
    this.stack = { action: new Array(this.maxSprites), notice: new Array(this.maxSprites) };
    this.meshes = {};

    for (const stack of Object.values(this.stack)) {
      for (let i = 0; i < this.maxSprites; i++) {
        stack[i] = this.maxSprites - 1 - i;
      }
    }

    const vertexShader = String.prototype.concat(nonmultiviewVertPrefix, vert);
    const fragmentShader = String.prototype.concat(nonmultiviewFragPrefix, frag);

    const domReady = waitForDOMContentLoaded();

    let resolveReady;
    this.ready = new Promise(resolve => {
      resolveReady = resolve;
    });

    Promise.all([domReady]).then(async () => {
      for (const [spritesheetPng, type] of [[spritesheetActionPng, "action"], [spritesheetNoticePng, "notice"]]) {
        await Promise.all([
          createImageTexture(spritesheetPng, getThemeColorShifter(type)),
          waitForDOMContentLoaded()
        ]).then(([spritesheetTexture]) => {
          const material = new THREE.RawShaderMaterial({
            uniforms: {
              u_spritesheet: { value: spritesheetTexture }
            },
            vertexShader,
            fragmentShader,
            side: THREE.DoubleSide,
            transparent: true
          });
          const mesh = (this.meshes[type] = new THREE.Mesh(
            createGeometry(this.maxSprites),
            material
          ));
          scene.add(mesh);
          mesh.frustumCulled = false;
          mesh.renderOrder = window.APP.RENDER_ORDER.HUD_ICONS;
          mesh.raycast = this.raycast.bind(this);
          mesh.name = type;
        });
      }
      resolveReady();
    });
  }

  tick() {
    if (!this.meshes.action || !this.meshes.notice) return;

    for (let i = 0; i < SHEET_TYPES.length; i++) {
      const sheetType = SHEET_TYPES[i];
      const mesh = this.meshes[sheetType];

      const mvCols = mesh.geometry.attributes && mesh.geometry.attributes["mvCol0"].data; // interleaved
      if (mvCols) {
        for (let i = 0, l = this.slots[sheetType].length; i < l; i++) {
          const slots = this.slots[sheetType];
          if (!slots[i]) continue;

          const indexWithSprite = this.indexWithSprite[sheetType];

          const sprite = indexWithSprite.get(i);
          const spriteObj = sprite;

          if (isVisible(spriteObj)) {
            spriteObj.updateMatrices();
            const mat4 = spriteObj.matrixWorld;
            mvCols.array.set(mat4.elements, i * 4 * 16 + 0);
            mvCols.array.set(mat4.elements, i * 4 * 16 + 1 * 16);
            mvCols.array.set(mat4.elements, i * 4 * 16 + 2 * 16);
            mvCols.array.set(mat4.elements, i * 4 * 16 + 3 * 16);
            mvCols.needsUpdate = true;
          } else {
            mvCols.array.set(ZEROS, i * 4 * 16 + 0);
            mvCols.array.set(ZEROS, i * 4 * 16 + 1 * 16);
            mvCols.array.set(ZEROS, i * 4 * 16 + 2 * 16);
            mvCols.array.set(ZEROS, i * 4 * 16 + 3 * 16);
            mvCols.needsUpdate = true;
          }
        }
      }
    }
  }

  updateUVs(sprite) {
    const sheetType = getSheetType(sprite);
    const mesh = this.meshes[sheetType];
    const spriteWithIndex = this.spriteWithIndex[sheetType];

    const flipY = true; //mesh.material.uniforms.u_spritesheet.value.flipY;
    const i = spriteWithIndex.get(sprite);
    const frame = normalizedFrame(
      sprite.data.name,
      sheetType === "action" ? spritesheetAction : spritesheetNotice,
      this.missingSprites
    );
    const aUvs = mesh.geometry.attributes && mesh.geometry.attributes["a_uvs"];
    if (aUvs) {
      aUvs.setXY(i * 4 + 0, frame.x, flipY ? 1 - frame.y : frame.y);
      aUvs.setXY(i * 4 + 1, frame.x + frame.w, flipY ? 1 - frame.y : frame.y);
      aUvs.setXY(i * 4 + 2, frame.x, flipY ? 1 - frame.y - frame.h : frame.y + frame.h);
      aUvs.setXY(i * 4 + 3, frame.x + frame.w, flipY ? 1 - frame.y - frame.h : frame.y + frame.h);
      aUvs.needsUpdate = true;
    }
  }

  add(sprite) {
    if (!this.meshes.action || !this.meshes.notice) {
      return 0;
    }
    const sheetType = getSheetType(sprite);
    const stack = this.stack[sheetType];
    const i = stack.pop();
    if (i === undefined) {
      console.error("Too many sprites");
      return -1;
    }
    const slots = this.slots[sheetType];
    const spriteWithIndex = this.spriteWithIndex[sheetType];
    const indexWithSprite = this.indexWithSprite[sheetType];
    const mesh = this.meshes[sheetType];
    slots[i] = true;
    spriteWithIndex.set(sprite, i);
    indexWithSprite.set(i, sprite);

    this.updateUVs(sprite);

    const aVertices = mesh.geometry.attributes && mesh.geometry.attributes["a_vertices"];
    if (aVertices) {
      aVertices.setXYZ(i * 4 + 0, -0.5, 0.5, 0);
      aVertices.setXYZ(i * 4 + 1, 0.5, 0.5, 0);
      aVertices.setXYZ(i * 4 + 2, -0.5, -0.5, 0);
      aVertices.setXYZ(i * 4 + 3, 0.5, -0.5, 0);
      aVertices.needsUpdate = true;
    }
    return 1;
  }

  remove(sprite) {
    const sheetType = getSheetType(sprite);
    const slots = this.slots[sheetType];
    const spriteWithIndex = this.spriteWithIndex[sheetType];
    const indexWithSprite = this.indexWithSprite[sheetType];
    const stack = this.stack[sheetType];
    const mesh = this.meshes[sheetType];

    const i = spriteWithIndex.get(sprite);
    spriteWithIndex.delete(sprite);
    indexWithSprite.delete(i);
    slots[i] = false;
    stack.push(i);

    const mvCols = mesh.geometry.attributes["mvCol0"].data; // interleaved
    mvCols.array.set(ZEROS, i * 4 * 16 + 0);
    mvCols.array.set(ZEROS, i * 4 * 16 + 1 * 16);
    mvCols.array.set(ZEROS, i * 4 * 16 + 2 * 16);
    mvCols.array.set(ZEROS, i * 4 * 16 + 3 * 16);
    mvCols.needsUpdate = true;
  }
}
