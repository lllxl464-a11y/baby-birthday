import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import GUI from "lil-gui";

const canvas = document.querySelector("#stage");
const loading = document.querySelector("#loading");
const viewer = document.querySelector("#viewer");
const viewerImage = document.querySelector("#viewerImage");
const viewerClose = document.querySelector("#viewerClose");

const STAGES = ["gift", "count3", "count2", "count1", "fireworks", "cake", "age", "wish", "album", "finale"];
const COUPLE_IMAGE = "./合照素材.jpg";
const DEBUG = new URLSearchParams(location.search).has("debug");
const FIREWORK_ASCEND = 1.55;
const FIREWORK_TOTAL = 4.0;

const isPortrait = () => window.innerHeight > window.innerWidth;
const lowPower = () => window.innerWidth < 900 || window.devicePixelRatio > 2;

const params = {
  particles: lowPower() ? 32000 : 52000,
  pointSize: lowPower() ? 0.04 : 0.034,
  bloom: 0.38,
  exposure: 0.48,
  morphSpeed: 0.055,
  scatter: 4.8,
  sphereSpeed: 0.16,
  dragSpeed: 1.45,
};

const clock = new THREE.Clock();
let elapsedTime = 0;
const pointer = new THREE.Vector2();
const drag = {
  active: false,
  startX: 0,
  startY: 0,
  startRotX: 0,
  startRotY: 0,
  moved: 0,
  velX: 0,
  velY: 0,
};

let renderer;
let scene;
let camera;
let composer;
let bloomPass;
let mainPoints;
let mainGeo;
let mainPositions;
let mainColors;
let mainSizes;
let mainSizeSeeds;
let targets;
let targetColors;
let fromPositions;
let toPositions;
let fromColors;
let toColors;
let transition = 1;
let currentStage = "gift";
let stageTime = 0;
let photos = [];
let photoSphere;
let photoCards = [];
let centerCard = null;
let giftGroup;
let giftLidRig;
let firework;
let fireworkState;
let portraitPoints;
let portraitReady = false;
let raycaster;
let audioCtx;
let masterGain;
let musicGain;
let sfxGain;
let audioStarted = false;
let musicLoopTimer;

init();

async function init() {
  photos = await fetch("./assets/user-photos/photos.json").then((res) => res.json());
  setupRenderer();
  createMainParticles();
  createGift();
  createPhotoSphere();
  createFireworkSystem();
  setupEvents();
  if (DEBUG) setupGui();
  setStage("gift", true);
  buildPortraitLayer().then((layer) => {
    portraitPoints = layer;
    portraitPoints.visible = currentStage === "finale";
    scene.add(portraitPoints);
    portraitReady = true;
    document.body.dataset.portraitReady = "true";
  });
  loading.classList.add("hidden");
  renderer.setAnimationLoop(render);
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower() ? 1.12 : 1.35));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.exposure;

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#01020a");
  scene.fog = new THREE.FogExp2("#01020a", 0.035);

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(0, 1.1, isPortrait() ? 10.2 : 8.3);

  scene.add(new THREE.AmbientLight("#5d75b8", 0.12));
  const cyan = new THREE.PointLight("#70f1ff", 12, 22);
  cyan.position.set(-2.5, 2.4, 5.2);
  scene.add(cyan);
  const violet = new THREE.PointLight("#5146ff", 14, 26);
  violet.position.set(3.1, -1.8, 5.4);
  scene.add(violet);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), params.bloom, 0.52, 0.32);
  composer.addPass(bloomPass);
  raycaster = new THREE.Raycaster();
}

function createMainParticles() {
  const count = params.particles;
  mainPositions = new Float32Array(count * 3);
  mainColors = new Float32Array(count * 3);
  mainSizes = new Float32Array(count);
  mainSizeSeeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    writeVec(mainPositions, i, randomSphere(7.5));
    const c = colorFromPalette(["#dffaff", "#8be8ff", "#857dff", "#ffd6ed", "#ffd9a0"], i);
    const dim = 0.48 + Math.random() * 0.42;
    mainColors.set([c.r * dim, c.g * dim, c.b * dim], i * 3);
    mainSizeSeeds[i] = 0.72 + Math.random() * 1.18;
    mainSizes[i] = params.pointSize * mainSizeSeeds[i];
  }

  targets = {
    gift: giftTargets(count),
    count3: offsetTargets(textTargets(count, ["3"], [2.28]), 0, 1.08, 0),
    count2: offsetTargets(textTargets(count, ["2"], [2.28]), 0, 1.08, 0),
    count1: offsetTargets(textTargets(count, ["1"], [2.28]), 0, 1.08, 0),
    fireworks: burstMistTargets(count),
    cake: cakeTargets(count),
    age: ageTargets(count),
    wish: textTargets(count, ["王付钰", "生日快乐"], [0.72, 0.48]),
    album: shellTargets(count, 2.42),
    finale: sideNebulaTargets(count),
  };
  targetColors = {
    gift: paletteColors(count, ["#bdf7ff", "#6eb4ff", "#ffd1eb"], 0.8),
    count3: paletteColors(count, ["#f2fdff", "#85dcff", "#d2c2ff"], 0.92),
    count2: paletteColors(count, ["#f2fdff", "#85dcff", "#d2c2ff"], 0.92),
    count1: paletteColors(count, ["#f2fdff", "#85dcff", "#d2c2ff"], 0.92),
    fireworks: paletteColors(count, ["#7ceaff", "#8b79ff", "#ffd1ec", "#ffdaa0"], 0.78),
    cake: paletteColors(count, ["#f4fdff", "#72dcff", "#8276ff", "#ff9fda", "#ffd18b", "#b9ffed", "#fff1bc"], 1.02),
    age: paletteColors(count, ["#eafdff", "#78dcff", "#ffd0ea", "#ffe0a6"], 0.88),
    wish: paletteColors(count, ["#e8fbff", "#8ccaff", "#ffc5e7"], 0.86),
    album: paletteColors(count, ["#dffaff", "#2f4aff", "#ffdca8"], 0.76),
    finale: paletteColors(count, ["#4deaff", "#7673ff", "#ffd7ed"], 0.28),
  };

  mainGeo = new THREE.BufferGeometry();
  mainGeo.setAttribute("position", new THREE.BufferAttribute(mainPositions, 3));
  mainGeo.setAttribute("color", new THREE.BufferAttribute(mainColors, 3));
  mainGeo.setAttribute("size", new THREE.BufferAttribute(mainSizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * 176.0 / max(0.25, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float alpha = smoothstep(0.5, 0.06, d);
        float core = smoothstep(0.11, 0.0, d);
        gl_FragColor = vec4(vColor + core * 0.16, alpha * 0.82);
      }
    `,
  });

  mainPoints = new THREE.Points(mainGeo, material);
  scene.add(mainPoints);
}

function createGift() {
  giftGroup = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({
    color: "#90d5f4",
    emissive: "#12395f",
    emissiveIntensity: 0.3,
    roughness: 0.25,
    metalness: 0.32,
  });
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: "#ffd0e9",
    emissive: "#7a2458",
    emissiveIntensity: 0.36,
    roughness: 0.22,
    metalness: 0.22,
  });
  const lineMat = new THREE.LineBasicMaterial({ color: "#d9fcff", transparent: true, opacity: 0.28 });
  const glowMat = new THREE.MeshBasicMaterial({ color: "#bff8ff", transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending });

  const base = new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.28, 1.7, 5, 0.09), boxMat);
  base.position.y = -0.72;
  const baseEdges = new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry), lineMat);
  baseEdges.position.copy(base.position);

  const vertical = new THREE.Mesh(new RoundedBoxGeometry(0.24, 1.43, 1.78, 4, 0.035), ribbonMat);
  vertical.position.y = -0.72;
  const horizontal = new THREE.Mesh(new RoundedBoxGeometry(2.08, 1.43, 0.22, 4, 0.035), ribbonMat);
  horizontal.position.y = -0.72;

  giftLidRig = new THREE.Group();
  giftLidRig.position.y = 0.08;
  const lid = new THREE.Mesh(new RoundedBoxGeometry(2.24, 0.34, 1.93, 5, 0.08), boxMat);
  const lidRibbonA = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.38, 1.98, 4, 0.035), ribbonMat);
  const lidRibbonB = new THREE.Mesh(new RoundedBoxGeometry(2.34, 0.39, 0.24, 4, 0.035), ribbonMat);
  const lidEdges = new THREE.LineSegments(new THREE.EdgesGeometry(lid.geometry), lineMat);
  const bow = new THREE.Group();
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 16, 48), ribbonMat);
    loop.scale.set(1.32, 0.58, 0.9);
    loop.rotation.set(Math.PI / 2, side * 0.42, 0);
    loop.position.set(side * 0.3, 0.31, 0.03);
    bow.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 14), ribbonMat);
  knot.position.y = 0.31;
  bow.add(knot);
  giftLidRig.add(lid, lidRibbonA, lidRibbonB, lidEdges, bow);

  const insideGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), glowMat);
  insideGlow.rotation.x = -Math.PI / 2;
  insideGlow.position.y = -0.02;
  giftGroup.add(insideGlow, base, baseEdges, vertical, horizontal, giftLidRig);
  giftGroup.position.set(0, -0.28, 0);
  scene.add(giftGroup);
}

function createPhotoSphere() {
  photoSphere = new THREE.Group();
  photoSphere.visible = false;
  const loader = new THREE.TextureLoader();
  const radius = 2.22;

  photos.forEach((photo, index) => {
    const tex = loader.load(photo.optimized);
    tex.colorSpace = THREE.SRGBColorSpace;
    const card = createPhotoCard(tex, photo);
    const phi = Math.acos(1 - 2 * ((index + 0.5) / photos.length));
    const theta = index * Math.PI * (3 - Math.sqrt(5));
    const pos = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi) * 0.82,
      radius * Math.sin(phi) * Math.sin(theta)
    );
    card.position.copy(pos);
    card.lookAt(0, 0, 0);
    card.rotateY(Math.PI);
    photoSphere.add(card);
    photoCards.push(card);
  });

  photoSphere.add(createShellSpecks(4200, radius));
  scene.add(photoSphere);
}

function createPhotoCard(texture, photo) {
  const group = new THREE.Group();
  const h = 0.86;
  const w = 0.58;
  const hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.34, h + 0.34),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitArea.position.z = 0.03;
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.08, h + 0.08),
    new THREE.MeshBasicMaterial({ color: "#52e4f7", transparent: true, opacity: 0.18 })
  );
  const image = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture, color: "#7c9198", transparent: true, opacity: 0.56, toneMapped: true })
  );
  image.position.z = 0.012;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.2, h + 0.2),
    new THREE.MeshBasicMaterial({ color: "#45e7ff", transparent: true, opacity: 0.014, blending: THREE.AdditiveBlending })
  );
  glow.position.z = -0.014;
  group.add(glow, frame, image, hitArea);
  group.userData = { photo, image, frame, glow, hitArea };
  return group;
}

function createShellSpecks(count, radius) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    writeVec(pos, i, randomSphereShell(radius + (Math.random() - 0.5) * 0.45));
    const c = colorFromPalette(["#dffaff", "#2b48ff", "#ffe0b6"], i);
    const dim = i % 3 === 0 ? 0.28 : 0.72;
    col.set([c.r * dim, c.g * dim, c.b * dim], i * 3);
    size[i] = 0.014 + Math.random() * 0.022;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  return new THREE.Points(geo, mainPoints.material);
}

function createFireworkSystem() {
  const count = lowPower() ? 3400 : 5200;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const alpha = new Float32Array(count);
  const vel = new Float32Array(count * 3);
  const origin = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    pos.set([0, -8, 0], i * 3);
    const c = colorFromPalette(["#85f1ff", "#8979ff", "#ffd0ed", "#ffd49b", "#f4fdff"], i);
    const dim = i % 5 === 4 ? 0.95 : 1.18;
    col.set([c.r * dim, c.g * dim, c.b * dim], i * 3);
    size[i] = params.pointSize * (2.1 + Math.random() * 2.7);
    alpha[i] = 0;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      attribute float size;
      attribute float alpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * 360.0 / max(0.25, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float a = smoothstep(0.5, 0.04, d);
        float core = smoothstep(0.14, 0.0, d);
        gl_FragColor = vec4(vColor + core * 0.54, a * vAlpha);
      }
    `,
  });
  firework = new THREE.Points(geo, material);
  firework.visible = false;
  fireworkState = { count, vel, origin, exploded: false, age: 0 };
  scene.add(firework);
}

async function buildPortraitLayer() {
  const image = await loadImage(COUPLE_IMAGE);
  const sampleW = lowPower() ? 540 : 760;
  const sampleH = Math.round(sampleW * image.naturalHeight / image.naturalWidth);
  const c = document.createElement("canvas");
  c.width = sampleW;
  c.height = sampleH;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, sampleW, sampleH);
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  const samples = [];

  for (let y = 0; y < sampleH; y += 1) {
    for (let x = 0; x < sampleW; x += 1) {
      const ix = (y * sampleW + x) * 4;
      const r = data[ix] / 255;
      const g = data[ix + 1] / 255;
      const b = data[ix + 2] / 255;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const edge = pixelEdge(data, sampleW, sampleH, x, y);
      const nx = x / sampleW;
      const ny = y / sampleH;
      const faceBoost =
        gaussian2(nx, ny, 0.3, 0.63, 0.2, 0.16) +
        gaussian2(nx, ny, 0.64, 0.32, 0.22, 0.2);
      const hairBoost = lum < 0.26 ? 0.14 : 0;
      const warmSkin = r > g * 0.9 && g > b * 0.72 && lum > 0.22 && lum < 0.78 ? 0.1 : 0;
      const flatBackground = lum > 0.86 && chroma < 0.07 && edge < 0.055 && faceBoost < 0.05;
      const specular = lum > 0.92 && chroma < 0.05 && edge < 0.08;
      const chance = faceBoost * 0.92 + edge * 0.32 + hairBoost + warmSkin + (1 - lum) * 0.035 + 0.006;
      if (!flatBackground && !specular && lum > 0.028 && Math.random() < chance) {
        const repeats = 1 + Math.floor(Math.min(5, faceBoost * 5.5 + edge * 2.2 + hairBoost * 3));
        for (let j = 0; j < repeats; j += 1) samples.push({ x, y, r, g, b, lum, edge, face: faceBoost });
      }
    }
  }

  const count = lowPower() ? 165000 : 280000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const aspect = sampleH / sampleW;
  const maxW = isPortrait() ? 3.35 : 4.2;
  const maxH = isPortrait() ? 4.55 : 3.72;
  let width = maxW;
  let height = width * aspect;
  if (height > maxH) {
    height = maxH;
    width = height / aspect;
  }

  for (let i = 0; i < count; i += 1) {
    const p = samples[Math.floor(Math.random() * samples.length)] || { x: sampleW / 2, y: sampleH / 2, r: 0.5, g: 0.42, b: 0.38, lum: 0.45, edge: 0, face: 0 };
    const face = Math.min(1, p.face);
    const pixelJitter = face > 0.24 ? 1.45 : 2.65;
    const subX = p.x + (Math.random() - 0.5) * pixelJitter;
    const subY = p.y + (Math.random() - 0.5) * pixelJitter;
    const x = (subX / sampleW - 0.5) * width;
    const y = (0.5 - subY / sampleH) * height + 0.05;
    const z = 0.06 + (p.lum - 0.5) * 0.055 + (Math.random() - 0.5) * (face > 0.24 ? 0.018 : 0.035);
    pos.set([x, y, z], i * 3);
    const edgeLift = Math.min(0.05, p.edge * 0.055);
    const skinWarm = face > 0.16 ? 0.025 : 0;
    col.set([
      Math.min(0.96, Math.pow(p.r, 0.94) * 0.96 + edgeLift + skinWarm),
      Math.min(0.94, Math.pow(p.g, 0.94) * 0.94 + edgeLift + skinWarm * 0.45),
      Math.min(0.96, Math.pow(p.b, 0.92) * 0.96 + edgeLift + 0.01),
    ], i * 3);
    size[i] = (face > 0.18 ? 0.0044 : 0.0058) + Math.random() * (face > 0.18 ? 0.0018 : 0.0026);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexColors: true,
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * 218.0 / max(0.25, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float alpha = smoothstep(0.48, 0.13, d);
        gl_FragColor = vec4(vColor, alpha * 0.68);
      }
    `,
  });

  return new THREE.Points(geo, material);
}

function setStage(stage, immediate = false) {
  if (stage === "finale" && !portraitReady) return;
  const previousStage = currentStage;
  currentStage = stage;
  stageTime = 0;
  document.body.dataset.stage = stage;
  transition = immediate ? 1 : 0;
  fromPositions = new Float32Array(mainPositions);
  fromColors = new Float32Array(mainColors);
  toPositions = targets[stage] || targets.cake;
  toColors = targetColors[stage] || targetColors.cake;

  mainPoints.visible = stage !== "finale" && stage !== "fireworks";
  photoSphere.visible = stage === "album";
  giftGroup.visible = ["gift", "count3", "count2", "count1"].includes(stage);
  if (portraitPoints) portraitPoints.visible = stage === "finale";
  if (stage === "fireworks") triggerFirework();
  if (stage !== previousStage) playStageCue(stage);
  resizeMainParticles(stage);
}

function advanceStage() {
  if (viewer.classList.contains("open")) return;
  if (currentStage === "fireworks") {
    setStage("cake");
    return;
  }
  const idx = STAGES.indexOf(currentStage);
  const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
  if (next !== currentStage) setStage(next);
}

function resizeMainParticles(stage) {
  const mul = stage === "cake" ? 1.46 : stage === "album" ? 0.96 : 1.08;
  for (let i = 0; i < mainSizes.length; i += 1) {
    mainSizes[i] = params.pointSize * mainSizeSeeds[i] * mul;
  }
  mainGeo.attributes.size.needsUpdate = true;
}

function triggerFirework() {
  firework.visible = true;
  fireworkState.exploded = false;
  fireworkState.age = 0;
  playFireworkLaunch();
  window.setTimeout(playFireworkBurst, FIREWORK_ASCEND * 1000);
  const pos = firework.geometry.attributes.position.array;
  const alpha = firework.geometry.attributes.alpha.array;
  for (let i = 0; i < fireworkState.count; i += 1) {
    pos.set([0, -3.0, 0], i * 3);
    alpha[i] = 0;
  }
  firework.geometry.attributes.position.needsUpdate = true;
  firework.geometry.attributes.alpha.needsUpdate = true;
}

function render() {
  const dt = Math.min(clock.getDelta(), 0.033);
  elapsedTime += dt;
  const t = elapsedTime;
  stageTime += dt;
  if (currentStage === "fireworks" && stageTime > FIREWORK_TOTAL) setStage("cake");

  updateMainParticles(t);
  updateStageMotion(dt);
  updateGift(t);
  updatePhotoSphere(dt);
  updateFirework(dt);
  updateCamera(t);

  bloomPass.strength = currentStage === "finale" ? 0.045 : currentStage === "fireworks" ? 0.82 : currentStage === "cake" ? 0.46 : params.bloom;
  renderer.toneMappingExposure = currentStage === "finale" ? 0.52 : currentStage === "fireworks" ? 0.72 : currentStage === "cake" ? 0.54 : params.exposure;
  composer.render();
}

function updateMainParticles(t) {
  if (!mainPoints.visible) return;
  if (transition < 1) transition = Math.min(1, transition + params.morphSpeed);
  const e = transition * transition * (3 - 2 * transition);
  const count = mainPositions.length / 3;
  const mouse = new THREE.Vector3(pointer.x * 3.7, pointer.y * 2.7, 0.6);

  for (let i = 0; i < count; i += 1) {
    const ix = i * 3;
    const sx = fromPositions ? fromPositions[ix] : mainPositions[ix];
    const sy = fromPositions ? fromPositions[ix + 1] : mainPositions[ix + 1];
    const sz = fromPositions ? fromPositions[ix + 2] : mainPositions[ix + 2];
    const tx = toPositions[ix];
    const ty = toPositions[ix + 1];
    const tz = toPositions[ix + 2];
    const burst = Math.sin(i * 13.17) * params.scatter * (1 - e) * Math.sin(e * Math.PI);
    let x = sx + (tx - sx) * e + burst * 0.052 + Math.sin(t * 1.1 + i * 0.025) * 0.01;
    let y = sy + (ty - sy) * e + Math.abs(burst) * 0.032 + Math.cos(t * 0.9 + i * 0.033) * 0.01;
    let z = sz + (tz - sz) * e + Math.sin(t * 1.2 + i * 0.027) * 0.01;
    const dx = x - mouse.x;
    const dy = y - mouse.y;
    const dz = z - mouse.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.9) {
      const push = (0.9 - d) * 0.018;
      x += (dx / Math.max(d, 0.001)) * push;
      y += (dy / Math.max(d, 0.001)) * push;
    }
    mainPositions[ix] = x;
    mainPositions[ix + 1] = y;
    mainPositions[ix + 2] = z;
    mainColors[ix] = (fromColors ? fromColors[ix] : mainColors[ix]) + (toColors[ix] - (fromColors ? fromColors[ix] : mainColors[ix])) * e;
    mainColors[ix + 1] = (fromColors ? fromColors[ix + 1] : mainColors[ix + 1]) + (toColors[ix + 1] - (fromColors ? fromColors[ix + 1] : mainColors[ix + 1])) * e;
    mainColors[ix + 2] = (fromColors ? fromColors[ix + 2] : mainColors[ix + 2]) + (toColors[ix + 2] - (fromColors ? fromColors[ix + 2] : mainColors[ix + 2])) * e;
  }
  mainGeo.attributes.position.needsUpdate = true;
  mainGeo.attributes.color.needsUpdate = true;
}

function updateStageMotion(dt) {
  if (currentStage === "cake") {
    mainPoints.rotation.y += dt * 0.34;
    mainPoints.rotation.x += (0.025 - mainPoints.rotation.x) * 0.04;
    return;
  }
  mainPoints.rotation.x += (0 - mainPoints.rotation.x) * 0.08;
  mainPoints.rotation.y += (0 - mainPoints.rotation.y) * 0.08;
  mainPoints.rotation.z += (0 - mainPoints.rotation.z) * 0.08;
}

function updateGift(t) {
  if (!giftGroup.visible) return;
  const open = currentStage !== "gift";
  const k = open ? Math.min(1, stageTime * 1.65) : 0;
  const e = k * k * (3 - 2 * k);
  giftGroup.rotation.y = Math.sin(t * 0.34) * 0.08;
  giftGroup.position.y = -0.28 + Math.sin(t * 1.2) * 0.025;
  giftLidRig.position.y = 0.08 + e * 0.9;
  giftLidRig.position.x = e * 0.32;
  giftLidRig.rotation.z = e * -0.32;
  giftLidRig.rotation.x = e * 0.22;
}

function updatePhotoSphere(dt) {
  if (!photoSphere.visible) return;
  if (!drag.active) {
    photoSphere.rotation.y += params.sphereSpeed * dt + drag.velX * dt;
    photoSphere.rotation.x += drag.velY * dt;
    photoSphere.rotation.x = THREE.MathUtils.clamp(photoSphere.rotation.x, -1.05, 1.05);
    drag.velX *= 0.94;
    drag.velY *= 0.94;
  }

  let best = null;
  let bestZ = -Infinity;
  const tmp = new THREE.Vector3();
  photoCards.forEach((card) => {
    card.getWorldPosition(tmp);
    card.lookAt(camera.position);
    if (tmp.z > bestZ) {
      bestZ = tmp.z;
      best = card;
    }
  });
  centerCard = best;
  photoCards.forEach((card) => {
    const world = new THREE.Vector3();
    card.getWorldPosition(world);
    const depth = THREE.MathUtils.clamp((world.z + 2.2) / 4.6, 0, 1);
    const isCenter = card === centerCard;
    const scale = isCenter ? 1.55 : 0.52 + depth * 0.3;
    card.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    card.userData.image.material.opacity += ((isCenter ? 0.78 : 0.24 + depth * 0.22) - card.userData.image.material.opacity) * 0.1;
    card.userData.frame.material.opacity += ((isCenter ? 0.5 : 0.08 + depth * 0.13) - card.userData.frame.material.opacity) * 0.1;
    card.userData.glow.material.opacity += ((isCenter ? 0.052 : 0.008 + depth * 0.012) - card.userData.glow.material.opacity) * 0.1;
  });
}

function updateFirework(dt) {
  if (!firework.visible) return;
  fireworkState.age += dt;
  const age = fireworkState.age;
  const pos = firework.geometry.attributes.position.array;
  const alpha = firework.geometry.attributes.alpha.array;
  const vel = fireworkState.vel;
  const origin = fireworkState.origin;
  const count = fireworkState.count;

  if (age < FIREWORK_ASCEND) {
    for (let i = 0; i < count; i += 1) {
      const group = i % 5;
      const groupIndex = Math.floor(i / 5);
      const groupCount = Math.ceil(count / 5);
      const delay = group * 0.085;
      const local = THREE.MathUtils.clamp((age - delay) / (FIREWORK_ASCEND - 0.28), 0, 1);
      const rocketY = -3.2 + easeOutCubic(local) * (3.95 + group * 0.13);
      const tail = groupIndex / groupCount;
      const spread = Math.min(1, tail * 18);
      const baseX = [-1.08, -0.46, 0.08, 0.58, 1.15][group];
      const y = rocketY - tail * 1.55 + (Math.random() - 0.5) * 0.018;
      const x = baseX + Math.sin(i * 12.989) * 0.025 * spread;
      const z = (Math.random() - 0.5) * 0.05;
      pos.set([x, y, z], i * 3);
      alpha[i] = local > 0 && tail < 0.34 ? (1 - tail * 2.45) * 0.96 : 0;
    }
  } else {
    if (!fireworkState.exploded) {
      fireworkState.exploded = true;
      for (let i = 0; i < count; i += 1) {
        const group = i % 5;
        const ring = Math.floor(i / 5) % 3;
        const dir = randomSphereShell(1).normalize();
        const speed = 1.25 + Math.random() * 3.9 + ring * 0.32;
        const ox = [-1.08, -0.46, 0.08, 0.58, 1.15][group];
        const oy = 0.92 + group * 0.17;
        const ix = i * 3;
        origin.set([ox, oy, 0], ix);
        pos.set([ox, oy, 0], ix);
        vel.set([dir.x * speed, dir.y * speed + 0.18, dir.z * speed], ix);
        alpha[i] = 0.95;
      }
    }
    const expAge = age - FIREWORK_ASCEND;
    const fade = Math.max(0, 1 - expAge / (FIREWORK_TOTAL - FIREWORK_ASCEND));
    for (let i = 0; i < count; i += 1) {
      const ix = i * 3;
      vel[ix + 1] -= 0.72 * dt;
      pos[ix] += vel[ix] * dt;
      pos[ix + 1] += vel[ix + 1] * dt;
      pos[ix + 2] += vel[ix + 2] * dt;
      alpha[i] = fade * (0.42 + (i % 5) / 8);
    }
  }
  firework.geometry.attributes.position.needsUpdate = true;
  firework.geometry.attributes.alpha.needsUpdate = true;
  if (age > FIREWORK_TOTAL) firework.visible = false;
}

function updateCamera(t) {
  const album = currentStage === "album";
  const finale = currentStage === "finale";
  const targetZ = album ? (isPortrait() ? 8.2 : 6.9) : finale ? (isPortrait() ? 9.5 : 8.1) : (isPortrait() ? 10.1 : 8.25);
  const targetY = album ? 0.68 : finale ? 0.08 : 1.08;
  camera.position.x += (pointer.x * 0.14 - camera.position.x) * 0.04;
  camera.position.y += (targetY + pointer.y * 0.06 + Math.sin(t * 0.42) * 0.028 - camera.position.y) * 0.04;
  camera.position.z += (targetZ + Math.sin(t * 0.3) * 0.06 - camera.position.z) * 0.04;
  camera.lookAt(0, finale ? 0.05 : album ? 0.04 : 0, 0);
}

function cakeTargets(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const zone = Math.random();
    let p;
    if (zone < 0.68) {
      const layer = Math.floor(Math.random() * 3);
      const radius = [2.36, 1.62, 0.9][layer] * (0.68 + Math.random() * 0.32);
      const a = Math.random() * Math.PI * 2;
      p = new THREE.Vector3(
        Math.cos(a) * radius,
        [-1.12, -0.28, 0.48][layer] + (Math.random() - 0.5) * [0.82, 0.68, 0.55][layer],
        Math.sin(a) * radius * 0.58
      );
    } else if (zone < 0.86) {
      const layer = Math.floor(Math.random() * 3);
      const a = Math.random() * Math.PI * 2;
      const radius = [2.4, 1.66, 0.94][layer] + (Math.random() - 0.5) * 0.055;
      const y = [-0.72, 0.08, 0.74][layer] + (Math.random() - 0.5) * 0.09;
      p = new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius * 0.58);
    } else if (zone < 0.94) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.22 + Math.random() * 0.62;
      p = new THREE.Vector3(Math.cos(a) * r, 1.22 + Math.random() * 0.46, Math.sin(a) * r * 0.55);
    } else if (zone < 0.985) {
      p = sampleStar(0, 2.08, 0, 0.44);
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = 0.08 + Math.random() * 0.22;
      const flameY = 1.66 + Math.random() * 0.62;
      p = new THREE.Vector3(Math.cos(a) * r, flameY, Math.sin(a) * r * 0.36);
    }
    writeVec(out, i, p);
  }
  return out;
}

function ageTargets(count) {
  const base = textTargets(count, ["23", "6.28"], [1.55, 0.42]);
  for (let i = 0; i < count; i += 19) {
    const a = (i / count) * Math.PI * 2;
    const r = 2.05 + Math.sin(i) * 0.12;
    base[i * 3] = Math.cos(a) * r;
    base[i * 3 + 1] = Math.sin(a) * 0.74 - 0.05;
    base[i * 3 + 2] = Math.sin(a * 2.0) * 0.16;
  }
  return base;
}

function giftTargets(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const face = Math.floor(Math.random() * 6);
    const p = new THREE.Vector3((Math.random() - 0.5) * 2.15, -0.78 + Math.random() * 1.48, (Math.random() - 0.5) * 1.82);
    if (face === 0) p.x = Math.sign(Math.random() - 0.5) * 1.08;
    if (face === 1) p.z = Math.sign(Math.random() - 0.5) * 0.9;
    if (face === 2) p.y = -1.48 + Math.random() * 0.04;
    if (face === 3) p.y = 0.02 + Math.random() * 0.16;
    if (Math.random() < 0.16) p.x = (Math.random() - 0.5) * 0.24;
    if (Math.random() < 0.16) p.z = (Math.random() - 0.5) * 0.22;
    writeVec(out, i, p);
  }
  return out;
}

function shellTargets(count, radius) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) writeVec(out, i, randomSphereShell(radius + (Math.random() - 0.5) * 0.45));
  return out;
}

function burstMistTargets(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const p = randomSphereShell(1.4 + Math.random() * 4.2);
    p.y += 0.75 + Math.random() * 1.2;
    writeVec(out, i, p);
  }
  return out;
}

function sideNebulaTargets(count) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const p = new THREE.Vector3(side * (2.6 + Math.random() * 2.2), (Math.random() - 0.5) * 4.3, -0.35 + (Math.random() - 0.5) * 0.8);
    writeVec(out, i, p);
  }
  return out;
}

function textTargets(count, lines, scales) {
  const pts = [];
  lines.forEach((line, i) => pts.push(...sampleText(line, scales[i] || 1, i === 0 && lines.length > 1 ? 0.55 : lines.length > 1 ? -0.52 : 0)));
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const p = pts[i % pts.length].clone();
    p.x += (Math.random() - 0.5) * 0.035;
    p.y += (Math.random() - 0.5) * 0.035;
    p.z += (Math.random() - 0.5) * 0.16;
    writeVec(out, i, p);
  }
  return out;
}

function sampleText(text, scale, yOffset) {
  const c = document.createElement("canvas");
  c.width = 1000;
  c.height = 280;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${text.length <= 4 ? 170 : 128}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c.width / 2, c.height / 2);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let y = 0; y < c.height; y += 8) {
    for (let x = 0; x < c.width; x += 8) {
      if (data[(y * c.width + x) * 4 + 3] > 90 && Math.random() > 0.1) {
        pts.push(new THREE.Vector3((x / c.width - 0.5) * 5.65 * scale, (0.5 - y / c.height) * 1.72 * scale + yOffset, (Math.random() - 0.5) * 0.22));
      }
    }
  }
  return pts.length ? pts : [new THREE.Vector3()];
}

function setupEvents() {
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
    if (drag.active && currentStage === "album") {
      const dx = (event.clientX - drag.startX) / window.innerWidth;
      const dy = (event.clientY - drag.startY) / window.innerHeight;
      drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
      photoSphere.rotation.y = drag.startRotY + dx * Math.PI * params.dragSpeed;
      photoSphere.rotation.x = THREE.MathUtils.clamp(drag.startRotX + dy * Math.PI * params.dragSpeed, -1.05, 1.05);
      drag.velX = dx * 4.5;
      drag.velY = dy * 4.5;
    }
  }, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    ensureAudio();
    drag.active = true;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.startRotX = photoSphere.rotation.x;
    drag.startRotY = photoSphere.rotation.y;
    drag.moved = 0;
  }, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", () => { drag.active = false; }, { passive: true });
  viewer.addEventListener("click", closeViewer);
  viewerClose.addEventListener("click", closeViewer);
}

function onPointerUp(event) {
  const moved = drag.moved;
  drag.active = false;
  if (viewer.classList.contains("open")) return;
  if (currentStage === "album" && moved < 18) {
    playClickSound();
    const centerZone = Math.hypot(event.clientX - window.innerWidth / 2, event.clientY - window.innerHeight / 2) < Math.min(window.innerWidth, window.innerHeight) * 0.34;
    const hit = pickPhotoCard(event);
    if (hit?.userData.photo) {
      openViewer(hit.userData.photo.optimized);
      return;
    }
    if (centerZone && centerCard?.userData.photo) {
      openViewer(centerCard.userData.photo.optimized);
      return;
    }
    advanceStage();
    return;
  }
  if (moved < 14) {
    playClickSound();
    advanceStage();
  }
}

function pickPhotoCard(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  const hitTargets = photoCards.map((card) => card.userData.hitArea || card.userData.image);
  const hits = raycaster.intersectObjects(hitTargets, false);
  if (!hits.length) return null;
  return photoCards.find((card) => card.userData.hitArea === hits[0].object || card.userData.image === hits[0].object) || null;
}

function openViewer(src) {
  playOpenSound();
  viewerImage.src = src;
  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden", "false");
}

function closeViewer(event) {
  event?.stopPropagation();
  playCloseSound();
  viewer.classList.remove("open");
  viewer.setAttribute("aria-hidden", "true");
}

function onResize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower() ? 1.12 : 1.35));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function setupGui() {
  const gui = new GUI({ title: "v3 controls" });
  gui.close();
  gui.add(params, "pointSize", 0.018, 0.06, 0.001).name("粒子大小").onChange(() => resizeMainParticles(currentStage));
  gui.add(params, "bloom", 0, 1.2, 0.02).name("Bloom");
  gui.add(params, "exposure", 0.32, 0.9, 0.01).name("曝光");
  gui.add({ stage: currentStage }, "stage", STAGES).name("阶段").onChange((stage) => setStage(stage));
}

function paletteColors(count, palette, intensity) {
  const out = new Float32Array(count * 3);
  const colors = palette.map((hex) => new THREE.Color(hex));
  for (let i = 0; i < count; i += 1) {
    const c = colors[i % colors.length];
    const dim = intensity * (0.72 + Math.random() * 0.32);
    out.set([c.r * dim, c.g * dim, c.b * dim], i * 3);
  }
  return out;
}

function colorFromPalette(palette, index) {
  return new THREE.Color(palette[index % palette.length]);
}

function offsetTargets(array, dx, dy, dz) {
  const out = new Float32Array(array);
  for (let i = 0; i < out.length; i += 3) {
    out[i] += dx;
    out[i + 1] += dy;
    out[i + 2] += dz;
  }
  return out;
}

function randomSphere(radius) {
  return randomSphereShell(radius * Math.cbrt(Math.random()));
}

function randomSphereShell(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = u * Math.PI * 2;
  const phi = Math.acos(2 * v - 1);
  return new THREE.Vector3(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi) * 0.82, radius * Math.sin(phi) * Math.sin(theta));
}

function sampleStar(cx, cy, cz, scale) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? scale : scale * 0.43;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz));
  }
  const edge = Math.floor(Math.random() * pts.length);
  return pts[edge].clone().lerp(pts[(edge + 1) % pts.length], Math.random());
}

function pixelEdge(data, w, h, x, y) {
  const at = (xx, yy) => {
    const ix = ((Math.max(0, Math.min(h - 1, yy)) * w) + Math.max(0, Math.min(w - 1, xx))) * 4;
    return (data[ix] * 0.299 + data[ix + 1] * 0.587 + data[ix + 2] * 0.114) / 255;
  };
  return Math.abs(at(x - 2, y) - at(x + 2, y)) + Math.abs(at(x, y - 2) - at(x, y + 2));
}

function gaussian2(x, y, cx, cy, sx, sy) {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy) * 0.5);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
}

function ensureAudio() {
  if (audioStarted) {
    if (audioCtx?.state === "suspended") audioCtx.resume();
    return;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audioCtx = new AudioCtor();
  masterGain = audioCtx.createGain();
  musicGain = audioCtx.createGain();
  sfxGain = audioCtx.createGain();
  masterGain.gain.value = 0.72;
  musicGain.gain.value = 0.11;
  sfxGain.gain.value = 0.34;
  musicGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);
  audioStarted = true;
  document.body.dataset.audio = "on";
  startBackgroundMusic();
}

function startBackgroundMusic() {
  if (!audioCtx || musicLoopTimer) return;
  const melody = [
    ["G4", 0.32], ["G4", 0.32], ["A4", 0.62], ["G4", 0.62], ["C5", 0.62], ["B4", 1.0],
    ["G4", 0.32], ["G4", 0.32], ["A4", 0.62], ["G4", 0.62], ["D5", 0.62], ["C5", 1.0],
    ["G4", 0.32], ["G4", 0.32], ["G5", 0.62], ["E5", 0.62], ["C5", 0.62], ["B4", 0.62], ["A4", 1.0],
    ["F5", 0.32], ["F5", 0.32], ["E5", 0.62], ["C5", 0.62], ["D5", 0.62], ["C5", 1.28],
  ];
  const schedule = () => {
    if (!audioCtx || !audioStarted) return;
    let t = audioCtx.currentTime + 0.06;
    melody.forEach(([note, duration], i) => {
      const freq = noteFreq(note);
      playTone(freq, t, duration * 0.92, {
        type: i % 4 === 0 ? "triangle" : "sine",
        gain: 0.06,
        destination: musicGain,
        attack: 0.035,
        release: 0.34,
      });
      if (i % 2 === 0) {
        playTone(freq / 2, t + 0.01, duration * 1.2, {
          type: "sine",
          gain: 0.024,
          destination: musicGain,
          attack: 0.05,
          release: 0.48,
        });
      }
      t += duration * 0.62;
    });
    const loopMs = Math.max(1000, (t - audioCtx.currentTime - 0.36) * 1000);
    musicLoopTimer = window.setTimeout(() => {
      musicLoopTimer = undefined;
      schedule();
    }, loopMs);
  };
  schedule();
}

function playStageCue(stage) {
  if (!audioStarted) return;
  if (stage === "count3" || stage === "count2" || stage === "count1") {
    const freq = stage === "count3" ? 392 : stage === "count2" ? 523.25 : 659.25;
    playTone(freq, audioCtx.currentTime, 0.22, { type: "sine", gain: 0.18, destination: sfxGain, attack: 0.006, release: 0.16 });
    playTone(freq * 2.01, audioCtx.currentTime + 0.015, 0.18, { type: "triangle", gain: 0.065, destination: sfxGain, attack: 0.008, release: 0.14 });
  } else if (stage === "cake" || stage === "album" || stage === "finale") {
    playSparkle(stage === "finale" ? 1.2 : 0.78);
  }
}

function playClickSound() {
  if (!audioStarted) return;
  const now = audioCtx.currentTime;
  playTone(880, now, 0.07, { type: "sine", gain: 0.055, destination: sfxGain, attack: 0.003, release: 0.055 });
  playTone(1320, now + 0.035, 0.08, { type: "triangle", gain: 0.035, destination: sfxGain, attack: 0.003, release: 0.06 });
}

function playOpenSound() {
  if (!audioStarted) return;
  const now = audioCtx.currentTime;
  playTone(523.25, now, 0.16, { type: "sine", gain: 0.075, destination: sfxGain, attack: 0.006, release: 0.13 });
  playTone(1046.5, now + 0.075, 0.24, { type: "triangle", gain: 0.055, destination: sfxGain, attack: 0.01, release: 0.18 });
  playNoise(now, 0.22, { gain: 0.035, low: 1100, high: 3600 });
}

function playCloseSound() {
  if (!audioStarted) return;
  const now = audioCtx.currentTime;
  playTone(660, now, 0.08, { type: "sine", gain: 0.04, destination: sfxGain, attack: 0.004, release: 0.08 });
  playTone(392, now + 0.035, 0.11, { type: "sine", gain: 0.035, destination: sfxGain, attack: 0.004, release: 0.1 });
}

function playFireworkLaunch() {
  if (!audioStarted) return;
  const now = audioCtx.currentTime;
  playNoise(now, FIREWORK_ASCEND, { gain: 0.12, low: 180, high: 2200, sweep: true });
  for (let i = 0; i < 5; i += 1) {
    playTone(220 + i * 34, now + i * 0.08, 0.34, { type: "sawtooth", gain: 0.018, destination: sfxGain, attack: 0.04, release: 0.22 });
  }
}

function playFireworkBurst() {
  if (!audioStarted) return;
  const now = audioCtx.currentTime;
  playNoise(now, 1.2, { gain: 0.2, low: 70, high: 4200 });
  [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    playTone(freq, now + i * 0.018, 0.55 + i * 0.08, {
      type: i % 2 ? "triangle" : "sine",
      gain: 0.075 / (i + 1) ** 0.22,
      destination: sfxGain,
      attack: 0.004,
      release: 0.52,
    });
  });
}

function playSparkle(scale = 1) {
  if (!audioStarted) return;
  const now = audioCtx.currentTime;
  for (let i = 0; i < 8; i += 1) {
    const t = now + i * 0.045;
    const freq = 1046.5 * (1 + (i % 5) * 0.19);
    playTone(freq, t, 0.16, { type: "sine", gain: 0.025 * scale, destination: sfxGain, attack: 0.002, release: 0.13 });
  }
}

function playTone(freq, start, duration, options) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const destination = options.destination || sfxGain || audioCtx.destination;
  const attack = options.attack ?? 0.01;
  const release = options.release ?? 0.12;
  osc.type = options.type || "sine";
  osc.frequency.setValueAtTime(freq, start);
  if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(options.slideTo, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain || 0.05), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.01, duration + release));
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + release + 0.05);
}

function playNoise(start, duration, options = {}) {
  if (!audioCtx) return;
  const length = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(options.low || 160, start);
  filter.Q.setValueAtTime(0.72, start);
  if (options.sweep) filter.frequency.exponentialRampToValueAtTime(options.high || 2400, start + duration);
  else filter.frequency.setValueAtTime(options.high || 1800, start + duration * 0.35);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain || 0.08), start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain || audioCtx.destination);
  source.start(start);
  source.stop(start + duration + 0.03);
}

function noteFreq(note) {
  const match = /^([A-G])(#?)(\d)$/.exec(note);
  if (!match) return 440;
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const octave = Number(match[3]);
  const offset = semis[match[1]] + (match[2] ? 1 : 0) + (octave - 4) * 12;
  return 440 * 2 ** (offset / 12);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function writeVec(array, index, vec) {
  array[index * 3] = vec.x;
  array[index * 3 + 1] = vec.y;
  array[index * 3 + 2] = vec.z;
}

window.__birthdayV3 = {
  setStage,
  advanceStage,
  status: () => ({
    stage: currentStage,
    portraitReady,
    photos: photos.length,
    cards: photoCards.length,
    mainVisible: mainPoints.visible,
    fireworkVisible: firework.visible,
    fireworkAge: fireworkState.age,
    stageTime,
    viewerOpen: viewer.classList.contains("open"),
  }),
};
