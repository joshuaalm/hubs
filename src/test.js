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
