import { Box3, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ViewerState } from '../data/anatomy';

interface Transition {
  fromPosition: Vector3;
  fromTarget: Vector3;
  position: Vector3;
  target: Vector3;
  start: number;
}

export class CameraController {
  readonly camera = new PerspectiveCamera(38, 1, 0.05, 300);
  readonly controls: OrbitControls;
  private transition?: Transition;
  private fullBounds = new Box3();
  private viewportHeight = 800;
  private viewportWidth = 1000;
  view: ViewerState['view'] = 'front';

  constructor(canvas: HTMLCanvasElement) {
    this.camera.position.set(0, 0, 28);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.68;
    this.controls.panSpeed = 0.7;
    this.controls.zoomSpeed = 0.9;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 65;
    this.controls.addEventListener('start', () => { this.transition = undefined; });
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  initialize(bounds: Box3): void {
    this.fullBounds.copy(bounds);
    this.reset(false);
  }

  fit(bounds: Box3, animate = true, direction?: Vector3): void {
    if (bounds.isEmpty()) return;
    const target = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    // Keep the entire head and feet inside the free space between the mobile
    // information card and fixed toolbar, including during search focus.
    const mobile = this.viewportWidth < 700;
    const topInset = mobile ? 205 : 135;
    const bottomInset = mobile ? 150 : 145;
    const available = Math.max(0.3, (this.viewportHeight - topInset - bottomInset) / this.viewportHeight);
    const verticalFov = MathUtils.degToRad(this.camera.fov);
    const fitHeight = size.y / (2 * Math.tan(verticalFov / 2) * available);
    const fitWidth = Math.max(size.x, size.z * 0.9) / (2 * Math.tan(verticalFov / 2) * this.camera.aspect * (this.viewportWidth < 700 ? 0.8 : 0.72));
    const distance = MathUtils.clamp(Math.max(fitHeight, fitWidth) * 1.04 + size.z * 0.3, 2, 60);
    const desiredCenter = topInset + (this.viewportHeight - topInset - bottomInset) / 2;
    const unitsPerPixel = 2 * distance * Math.tan(verticalFov / 2) / this.viewportHeight;
    target.addScaledVector(this.camera.up, (desiredCenter - this.viewportHeight / 2) * unitsPerPixel);
    const facing = direction ?? this.camera.position.clone().sub(this.controls.target).normalize();
    const position = target.clone().add(facing.multiplyScalar(distance));
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      this.transition = undefined;
    } else {
      this.transition = { fromPosition: this.camera.position.clone(), fromTarget: this.controls.target.clone(), position, target, start: performance.now() };
    }
  }

  setView(view: ViewerState['view'], bounds: Box3): void {
    this.view = view;
    const directions = { front: new Vector3(0, 0, 1), back: new Vector3(0, 0, -1), left: new Vector3(1, 0, 0), right: new Vector3(-1, 0, 0) };
    this.fit(bounds, true, directions[view]);
  }

  reset(animate = true): void {
    this.view = 'front';
    this.controls.autoRotate = false;
    this.fit(this.fullBounds, animate, new Vector3(0.08, 0.012, 1).normalize());
  }

  update(): boolean {
    const moving = !!this.transition;
    if (this.transition) {
      const t = MathUtils.clamp((performance.now() - this.transition.start) / 420, 0, 1);
      const eased = 1 - (1 - t) ** 3;
      this.camera.position.lerpVectors(this.transition.fromPosition, this.transition.position, eased);
      this.controls.target.lerpVectors(this.transition.fromTarget, this.transition.target, eased);
      if (t === 1) this.transition = undefined;
    }
    return this.controls.update() || moving;
  }

  dispose(): void { this.controls.dispose(); }
}
