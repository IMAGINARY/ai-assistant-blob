let mic;
let level = 0;
let samples = new Array(32).fill(0);
let envelope = 0;

const loudnessFactor = 50;

function setup() {
  createCanvas(windowWidth, 200);
  userStartAudio();

  //create & start an audio input
  mic = new p5.AudioIn();
  mic.start();
}

function draw() {
  //get the level of amplitude of the mic
  level = mic.getLevel(1);
  const firstSample = samples.shift();
  samples.push(level);
  envelope -= firstSample / samples.length;
  envelope += level / samples.length;

  background(200);

  circle(100, 100, level * loudnessFactor * 100);
  circle(300, 100, envelope * loudnessFactor * 100);
}

$(document).ready(function () {
  let speedSlider = $('input[name="speed"]'),
    spikesSlider = $('input[name="spikes"]'),
    processingSlider = $('input[name="processing"]');

  let $canvas = $("#blob canvas"),
    canvas = $canvas[0],
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      context: canvas.getContext("webgl2"),
      antialias: true,
      alpha: true,
    }),
    simplex = new SimplexNoise();

  renderer.setSize($canvas.width(), $canvas.height());
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  let scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    $canvas.width() / $canvas.height(),
    0.1,
    1000,
  );

  camera.position.z = 5;

  let geometry = new THREE.SphereGeometry(0.8, 128, 128);

  let material = new THREE.MeshPhongMaterial({
    color: 0xe4ecfa,
    shininess: 100,
  });

  let lightTop = new THREE.DirectionalLight(0xffffff, 0.7);
  lightTop.position.set(0, 500, 200);
  lightTop.castShadow = true;
  scene.add(lightTop);

  let lightBottom = new THREE.DirectionalLight(0xffffff, 0.25);
  lightBottom.position.set(0, -500, 400);
  lightBottom.castShadow = true;
  scene.add(lightBottom);

  let ambientLight = new THREE.AmbientLight(0x798296);
  scene.add(ambientLight);

  let sphere = new THREE.Mesh(geometry, material);

  scene.add(sphere);

  let time = 0;
  let lastTimestamp;

  let update = (timestamp) => {
    const timeDiff = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    time += timeDiff * 0.00005 * speedSlider.val();

    //    let spikes = spikesSlider.val() * processingSlider.val();

    let spikes =
      (0.5 + 1.5 * envelope * loudnessFactor) * processingSlider.val();

    for (let i = 0; i < sphere.geometry.vertices.length; i++) {
      let p = sphere.geometry.vertices[i];
      p.normalize();
      p.multiplyScalar(
        1 +
          0.3 *
            simplex.noise3D(
              p.x * spikes + time,
              p.y * spikes + time,
              p.z * spikes + time,
            ),
      );
    }

    sphere.geometry.computeVertexNormals();
    sphere.geometry.normalsNeedUpdate = true;
    sphere.geometry.verticesNeedUpdate = true;
  };

  function animate(timestamp) {
    update(timestamp);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  lastTimestamp = document.timeline.currentTime;
  requestAnimationFrame(animate);
});
