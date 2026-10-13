import * as THREE from "three";
import type { CameraObj, GuideObj, LightObj } from "../types";

/* ------------------------------------------------------------- 3D Text Billboard */

export function createBillboardText(
  text: string,
  color = "#FFFFFF",
  bgColor = "rgba(15, 20, 30, 0.88)",
  borderColor = "#2F6BF0"
): { sprite: THREE.Sprite; dispose: () => void } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fontSize = 32;
  const font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  if (ctx) {
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const padX = 24;
    const padY = 14;
    const w = Math.ceil(textWidth + padX * 2);
    const h = Math.ceil(fontSize + padY * 2);

    canvas.width = Math.max(w, 64);
    canvas.height = Math.max(h, 40);

    // Re-set font after canvas resize
    ctx.font = font;
    ctx.textBaseline = "middle";

    // Rounded rectangle background
    const r = 8;
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(2, 2, canvas.width - 4, canvas.height - 4, r);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = color;
    ctx.fillText(text, padX, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true,
  });

  const sprite = new THREE.Sprite(mat);
  const aspect = canvas.width / (canvas.height || 1);
  const heightWorld = 0.22;
  sprite.scale.set(heightWorld * aspect, heightWorld, 1);
  sprite.renderOrder = 990;

  return {
    sprite,
    dispose: () => {
      texture.dispose();
      mat.dispose();
    },
  };
}

/* ------------------------------------------------------------------- Cameras */

export interface BuiltCamera {
  group: THREE.Group;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  helper: THREE.CameraHelper;
  mesh: THREE.Object3D;
  dispose: () => void;
}

export function buildCameraObject(obj: CameraObj, aspect = 16 / 9): BuiltCamera {
  const group = new THREE.Group();
  group.position.set(obj.pos[0], obj.pos[1], obj.pos[2]);
  group.rotation.set(obj.rot[0], obj.rot[1], obj.rot[2]);

  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  if (obj.ortho) {
    const size = 5;
    camera = new THREE.OrthographicCamera(
      (-size * aspect) / 2,
      (size * aspect) / 2,
      size / 2,
      -size / 2,
      obj.near || 0.1,
      obj.far || 1000
    );
  } else {
    camera = new THREE.PerspectiveCamera(obj.fov || 50, aspect, obj.near || 0.1, obj.far || 1000);
  }
  camera.name = obj.name;
  group.add(camera);

  // Visual proxy mesh for the camera in the viewport
  const bodyGeo = new THREE.BoxGeometry(0.24, 0.18, 0.32);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1c212d,
    roughness: 0.4,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0, 0.05);

  const lensGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.18, 16);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x0c0f16,
    roughness: 0.2,
    metalness: 0.8,
  });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, -0.16);

  const proxy = new THREE.Group();
  proxy.add(body, lens);
  proxy.userData.id = obj.id;
  group.add(proxy);

  const helper = new THREE.CameraHelper(camera);
  helper.renderOrder = 800;
  helper.visible = obj.visible ?? true;

  return {
    group,
    camera,
    helper,
    mesh: proxy,
    dispose: () => {
      bodyGeo.dispose();
      bodyMat.dispose();
      lensGeo.dispose();
      lensMat.dispose();
      helper.dispose();
    },
  };
}

/* -------------------------------------------------------------------- Lights */

export interface BuiltLight {
  group: THREE.Group;
  light: THREE.Light;
  helper?: THREE.Object3D;
  proxy: THREE.Object3D;
  dispose: () => void;
}

export function buildLightObject(obj: LightObj): BuiltLight {
  const group = new THREE.Group();
  group.position.set(obj.pos[0], obj.pos[1], obj.pos[2]);
  if (obj.rot) group.rotation.set(obj.rot[0], obj.rot[1], obj.rot[2]);

  const color = new THREE.Color(obj.color || "#FFFFFF");
  const intensity = obj.intensity ?? 1.5;

  let light: THREE.Light;
  let helper: THREE.Object3D | undefined;

  switch (obj.lightKind) {
    case "directional": {
      const dirLight = new THREE.DirectionalLight(color, intensity);
      dirLight.castShadow = obj.castShadow;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      if (obj.target) {
        dirLight.target.position.set(obj.target[0], obj.target[1], obj.target[2]);
        group.add(dirLight.target);
      }
      light = dirLight;
      helper = new THREE.DirectionalLightHelper(dirLight, 0.4, color.getHex());
      break;
    }
    case "spot": {
      const spotLight = new THREE.SpotLight(
        color,
        intensity,
        obj.distance || 20,
        obj.angle || Math.PI / 4,
        obj.penumbra || 0.2,
        obj.decay || 2
      );
      spotLight.castShadow = obj.castShadow;
      if (obj.target) {
        spotLight.target.position.set(obj.target[0], obj.target[1], obj.target[2]);
        group.add(spotLight.target);
      }
      light = spotLight;
      helper = new THREE.SpotLightHelper(spotLight, color.getHex());
      break;
    }
    case "point": {
      const pointLight = new THREE.PointLight(
        color,
        intensity,
        obj.distance || 15,
        obj.decay || 2
      );
      pointLight.castShadow = obj.castShadow;
      light = pointLight;
      helper = new THREE.PointLightHelper(pointLight, 0.25, color.getHex());
      break;
    }
    case "hemisphere": {
      const hemiLight = new THREE.HemisphereLight(color, new THREE.Color(0x222228), intensity);
      light = hemiLight;
      helper = new THREE.HemisphereLightHelper(hemiLight, 0.35, color.getHex());
      break;
    }
    case "ambient":
    default: {
      light = new THREE.AmbientLight(color, intensity);
      break;
    }
  }

  group.add(light);

  // Visual light proxy indicator
  const sphereGeo = new THREE.SphereGeometry(0.14, 16, 12);
  const sphereMat = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
  });
  const proxy = new THREE.Mesh(sphereGeo, sphereMat);
  proxy.userData.id = obj.id;
  group.add(proxy);

  return {
    group,
    light,
    helper,
    proxy,
    dispose: () => {
      sphereGeo.dispose();
      sphereMat.dispose();
      (helper as { dispose?: () => void })?.dispose?.();
    },
  };
}

/* -------------------------------------------------------------------- Guides */

export interface BuiltGuide {
  group: THREE.Group;
  dispose: () => void;
}

export function buildGuideObject(obj: GuideObj, formatUnits?: (m: number) => string): BuiltGuide {
  const group = new THREE.Group();
  group.position.set(obj.pos[0], obj.pos[1], obj.pos[2]);

  const disposables: (() => void)[] = [];
  const col = new THREE.Color(obj.color || "#38BDF8");

  switch (obj.guideKind) {
    case "measure": {
      const toPos = obj.to ? new THREE.Vector3(...obj.to).sub(new THREE.Vector3(...obj.pos)) : new THREE.Vector3(0, 0, 2);
      const dist = toPos.length();
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        toPos,
      ]);
      const mat = new THREE.LineDashedMaterial({
        color: col,
        dashSize: 0.1,
        gapSize: 0.05,
        depthTest: false,
      });
      const line = new THREE.Line(geom, mat);
      line.computeLineDistances();
      line.renderOrder = 950;
      line.userData.id = obj.id;
      group.add(line);
      disposables.push(() => {
        geom.dispose();
        mat.dispose();
      });

      // Midpoint measurement label
      const mid = toPos.clone().multiplyScalar(0.5);
      const labelText = obj.label || (formatUnits ? formatUnits(dist) : `${dist.toFixed(2)} m`);
      const { sprite, dispose: disposeSprite } = createBillboardText(labelText, "#FFFFFF", "rgba(14,24,42,0.9)", obj.color);
      sprite.position.copy(mid).add(new THREE.Vector3(0, 0.15, 0));
      sprite.userData.id = obj.id;
      group.add(sprite);
      disposables.push(disposeSprite);
      break;
    }
    case "label": {
      const { sprite, dispose: disposeSprite } = createBillboardText(obj.label || obj.name, "#FFFFFF", "rgba(18,22,34,0.9)", obj.color);
      sprite.userData.id = obj.id;
      group.add(sprite);
      disposables.push(disposeSprite);

      // Pin stem
      const stemGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.4, 0),
      ]);
      const stemMat = new THREE.LineBasicMaterial({ color: col, depthTest: false });
      const stem = new THREE.Line(stemGeo, stemMat);
      stem.renderOrder = 940;
      group.add(stem);
      disposables.push(() => {
        stemGeo.dispose();
        stemMat.dispose();
      });
      break;
    }
    case "arrow": {
      const dir = obj.to
        ? new THREE.Vector3(...obj.to).sub(new THREE.Vector3(...obj.pos)).normalize()
        : new THREE.Vector3(0, 1, 0);
      const len = obj.to ? new THREE.Vector3(...obj.to).distanceTo(new THREE.Vector3(...obj.pos)) : (obj.size || 1.5);
      const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), Math.max(0.2, len), col.getHex(), 0.3, 0.15);
      arrow.renderOrder = 950;
      arrow.userData.id = obj.id;
      group.add(arrow);
      disposables.push(() => {
        arrow.dispose();
      });
      break;
    }
    case "box": {
      const s = obj.size || 1;
      const boxGeo = new THREE.BoxGeometry(s, s, s);
      const edges = new THREE.EdgesGeometry(boxGeo);
      const mat = new THREE.LineBasicMaterial({ color: col, depthTest: false });
      const boxLine = new THREE.LineSegments(edges, mat);
      boxLine.renderOrder = 950;
      boxLine.userData.id = obj.id;
      group.add(boxLine);
      disposables.push(() => {
        boxGeo.dispose();
        edges.dispose();
        mat.dispose();
      });
      break;
    }
  }

  return {
    group,
    dispose: () => {
      disposables.forEach((fn) => fn());
    },
  };
}
