import THREE from "./three";
import "./utils/threejs-world-update";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SpriteSystem } from "./systems/sprites";

window.APP = {};
window.APP.RENDER_ORDER = { HUD_BACKGROUND: 1, HUD_ICONS: 2, CURSOR: 3 };

const renderer = new THREE.WebGLRenderer();
const scene = new THREE.Scene();
scene.renderer = renderer;
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.DirectionalLight();
light.position.set(1, 2, 3);
scene.add(light);

const spriteSystem = new SpriteSystem(scene);
const sprite = (window.sprite = new THREE.Object3D());
scene.add(sprite);
sprite.data = { name: "spawn.png" };
spriteSystem.ready.then(() => {
  console.log(spriteSystem.add(sprite));
});

document.addEventListener("DOMContentLoaded", () => {
  document.body.append(renderer.domElement);
});
const camera = new THREE.PerspectiveCamera();
camera.position.z = 3;
new OrbitControls(camera, renderer.domElement);

renderer.setAnimationLoop(t => {
  spriteSystem.tick(t);
  renderer.render(scene, camera);
});
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
resize();
window.addEventListener("resize", resize);

scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: "red" })));
window.scene = scene;

/*
import "./webxr-bypass-hacks";
import "aframe";
import "./utils/threejs-world-update";
import { SpriteSystem } from "./systems/sprites";

AFRAME.registerSystem("hubs-systems", {
  init() {
    this.spriteSystem = new SpriteSystem(this.el);
  },
  tick(t, dt) {
    this.spriteSystem.tick(t, dt);
  }
});

AFRAME.registerComponent("flip", {
  dependencies: ["sprite"],
  init() {
    this.timeToFlip = 1000;
    this.flip = true;
  },
  tick(t, dt) {
    this.timeToFlip -= dt;
    if (this.timeToFlip <= 0) {
      this.el.setAttribute("sprite", "name", this.flip ? "spawn.png" : "camera-action.png");
      this.timeToFlip = 1000;
      this.flip = !this.flip;
    }
  }
});

window.APP = {};
window.APP.RENDER_ORDER = {
  HUD_BACKGROUND: 1,
  HUD_ICONS: 2,
  CURSOR: 3
};
*/
