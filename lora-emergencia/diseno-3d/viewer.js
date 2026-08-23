let libraries;

const modal = document.querySelector("#viewer-modal");
const viewport = document.querySelector("#viewer-viewport");
const title = document.querySelector("#viewer-title");
const filename = document.querySelector("#viewer-file");
const status = document.querySelector("#viewer-status");
const closeButton = document.querySelector("#viewer-close");
const resetButton = document.querySelector("#viewer-reset");

let THREE;
let STLLoader;
let OrbitControls;
let renderer;
let scene;
let camera;
let controls;
let modelGroup;
let grid;
let animationFrame;
let lastFit;
let previousFocus;

function loadLibraries() {
  if (!libraries) {
    libraries = Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
      import("three/addons/loaders/STLLoader.js"),
    ]).then(([three, orbitModule, stlModule]) => {
      THREE = three;
      OrbitControls = orbitModule.OrbitControls;
      STLLoader = stlModule.STLLoader;
    });
  }
  return libraries;
}

function initViewer() {
  if (renderer) return;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x111518, 1);
  viewport.append(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
  camera.up.set(0, 0, 1);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = true;
  controls.screenSpacePanning = true;

  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x303820, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-1.5, -2, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc9ff, 1.6);
  fill.position.set(2, 1, 1.2);
  scene.add(fill);

  new ResizeObserver(resize).observe(viewport);
}

function resize() {
  if (!renderer || !viewport.clientWidth || !viewport.clientHeight) return;
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((item) => item.dispose());
    else child.material?.dispose();
  });
  scene.remove(object);
}

function clearModel() {
  if (modelGroup) disposeObject(modelGroup);
  if (grid) {
    grid.geometry.dispose();
    grid.material.dispose();
    scene.remove(grid);
  }
  modelGroup = null;
  grid = null;
}

function fitCamera() {
  if (!lastFit) return;
  const { maxDimension, height } = lastFit;
  const distance = maxDimension / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.35;
  camera.near = Math.max(distance / 200, 0.02);
  camera.far = distance * 50;
  camera.position.set(distance * 0.78, -distance * 0.95, distance * 0.72);
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, Math.max(height * 0.18, maxDimension * 0.015));
  controls.minDistance = distance * 0.25;
  controls.maxDistance = distance * 5;
  controls.update();
  controls.saveState();
}

function loadModel(url) {
  clearModel();
  status.hidden = false;
  status.textContent = "Cargando geometría…";

  new STLLoader().load(
    url,
    (geometry) => {
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      const initialBox = geometry.boundingBox;
      const center = initialBox.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -initialBox.min.z);
      geometry.computeBoundingBox();

      const size = geometry.boundingBox.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z * 4, 1);
      lastFit = { maxDimension, height: size.z };

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0xf1bd38,
          roughness: 0.62,
          metalness: 0.04,
          side: THREE.DoubleSide,
        }),
      );
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 28),
        new THREE.LineBasicMaterial({ color: 0x5f4a14, transparent: true, opacity: 0.58 }),
      );

      modelGroup = new THREE.Group();
      modelGroup.add(mesh, edges);
      scene.add(modelGroup);

      const gridSize = Math.ceil(maxDimension * 1.8 / 10) * 10;
      grid = new THREE.GridHelper(gridSize, 12, 0x465057, 0x293137);
      grid.rotation.x = Math.PI / 2;
      grid.position.z = -Math.max(maxDimension * 0.006, 0.4);
      scene.add(grid);

      fitCamera();
      status.hidden = true;
    },
    (event) => {
      if (event.total) {
        status.textContent = `Cargando geometría · ${Math.round(event.loaded / event.total * 100)}%`;
      }
    },
    () => {
      status.hidden = false;
      status.textContent = "No se pudo abrir este STL.";
    },
  );
}

function animate() {
  if (modal.hidden) return;
  controls?.update();
  renderer?.render(scene, camera);
  animationFrame = requestAnimationFrame(animate);
}

async function openViewer(piece) {
  const stlLink = piece.querySelector('a[href$=".stl"]');
  if (!stlLink) return;

  previousFocus = document.activeElement;
  title.textContent = piece.querySelector("h3")?.textContent || "Pieza 3D";
  filename.textContent = stlLink.getAttribute("href").split("/").pop();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  closeButton.focus();

  try {
    await loadLibraries();
    initViewer();
    resize();
    loadModel(stlLink.href);
    cancelAnimationFrame(animationFrame);
    animate();
  } catch {
    status.hidden = false;
    status.textContent = "WebGL no está disponible en este navegador.";
  }
}

function closeViewer() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  cancelAnimationFrame(animationFrame);
  previousFocus?.focus();
}

document.querySelectorAll(".piece").forEach((piece) => {
  const visual = piece.querySelector(".visual");
  const actions = piece.querySelector(".actions");
  const pieceTitle = piece.querySelector("h3")?.textContent || "pieza";

  visual.setAttribute("role", "button");
  visual.setAttribute("tabindex", "0");
  visual.setAttribute("aria-label", `Ver ${pieceTitle} en 3D`);

  const cue = document.createElement("span");
  cue.className = "view-cue";
  cue.textContent = "↻ Ver 3D";
  visual.append(cue);

  visual.addEventListener("click", () => openViewer(piece));
  visual.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openViewer(piece);
    }
  });

  const viewButton = document.createElement("button");
  viewButton.type = "button";
  viewButton.className = "btn view-button";
  viewButton.textContent = "Ver 3D";
  viewButton.addEventListener("click", () => openViewer(piece));
  actions.prepend(viewButton);
});

closeButton.addEventListener("click", closeViewer);
resetButton.addEventListener("click", fitCamera);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeViewer();
});
document.addEventListener("keydown", (event) => {
  if (!modal.hidden && event.key === "Escape") closeViewer();
});
