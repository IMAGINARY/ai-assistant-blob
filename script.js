let mic = null;
let level = 0;
let samples = new Array(32).fill(0);
let envelope = 0;

// Fix the width and height of the canvas
const canvasWidth = 3840;
const canvasHeight = 2160;
const loudnessFactor = 50;

let video = null;
let bodyPose;
let poses = [];

const minKeypointConfidence = 0.75;
const proximityFactor = 50;

let relativeProximity = 0;
let debugMode = false;

function preload() {
  // Load the bodyPose model
  bodyPose = ml5.bodyPose();
}

async function listDevices() {
  // Log all devices to be able to set deviceIds
  const devices = await navigator.mediaDevices.enumerateDevices();
  console.log("Video input devices: ", [...devices]);
}

async function setupMic(id) {
  const mic = new p5.AudioIn();
  const audioDevices = await new Promise(mic.getSources.bind(mic));
  console.log("Audio input devices: ", audioDevices);
  if (id !== null && typeof id !== "undefined") {
    const index = audioDevices.findIndex((device) => device.deviceId === id);
    if (index === -1) console.log("Unknown audio device id", id);
    else mic.setSource(index);
  }
  mic.start();
  return mic;
}

async function setupVideo(id) {
  const constraints =
    id !== null && typeof id !== "undefined"
      ? {
          video: {
            deviceId: {
              exact: id,
            },
          },
        }
      : { video: true };
  return createCapture(constraints);
}

async function setupAsync() {
  const searchParams = new URL(document.location.toString()).searchParams;

  await listDevices();

  mic = await setupMic(searchParams.get("audioDeviceId"));

  video = await setupVideo(searchParams.get("videoDeviceId"));
  video.size(640, 480);
  video.hide();

  bodyPose.detectStart(video, gotPoses);
}

function setup() {
  userStartAudio();
  createCanvas(canvasWidth, 200);

  setupAsync();
}

function draw() {
  if (mic) {
    //get the level of amplitude of the mic
    level = mic.getLevel(1);
    const firstSample = samples.shift();
    samples.push(level);
    envelope -= firstSample / samples.length;
    envelope += level / samples.length;

    envelope = clamp(envelope, 0, 0.04);
  }

  if (debugMode) {
    background(200);

    fill(255);
    stroke(0);

    circle(300, 100, envelope * loudnessFactor * 100);

    // Draw the webcam video
    if (video) image(video, 400, 0, (200 * 640) / 480, 200);

    // Draw all the tracked landmark points
    for (let i = 0; i < poses.length; i++) {
      let pose = poses[i];
      for (let j = 0; j < pose.keypoints.length; j++) {
        let keypoint = pose.keypoints[j];
        if (keypoint.confidence < minKeypointConfidence) continue;
        fill(0, 255, 0);
        noStroke();
        circle(
          400 + ((keypoint.x / 640) * 200 * 640) / 480,
          (keypoint.y / 480) * 200,
          10
        );
      }
    }

    fill(255);
    stroke(0);
    circle(400 + (200 * 640) / 480 + 100, 100, relativeProximity * 100);

    fill(0);
    noStroke();
    text("Loudness", 200 + 10, 20);
    text("Bodypose tracking", 400 + 10, 20);
    text("Proximity", 400 + (200 * 640) / 480 + 10, 20);
  }
}

// Callback function for when bodyPose outputs data
function gotPoses(results) {
  // Save the output to the poses variable
  poses = results;

  let screenspace = 0;
  for (let pose of poses) {
    const { width, height } = pose.box;
    screenspace += width * height;
  }

  relativeProximity = clamp(1 - screenspace / (640 * 480), 0.1, 1);
}

$(document).ready(function () {
  let processingSlider = $('input[name="processing"]');

  $(document).on("keydown", (e) => {
    if (e.key === "d") {
      toggleControls();
    }
  });

  let $canvas = $(".blob"),
    canvas = $canvas[0],
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      context: canvas.getContext("webgl2"),
      antialias: true,
      alpha: true,
    }),
    simplex = new SimplexNoise();

  renderer.setSize(canvasWidth, canvasHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  let scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    canvasWidth / canvasHeight,
    0.1,
    1000
  );

  camera.position.z = 5;

  let geometry = new THREE.IcosahedronGeometry(0.8, 6);

  let material = new THREE.MeshPhongMaterial({
    color: 0xfcccb3,
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

    time += timeDiff * 0.00005 * (1 + relativeProximity * proximityFactor);

    let hue = (time / 20) % 1;
    // Desaturate the area starting around purple to match the color scheme
    let baseSat = 0.75;
    let desatStart = 5 / 8;
    let sat =
      hue > desatStart
        ? baseSat *
          (1 - Math.min(1 - hue, hue - desatStart) / ((1 - desatStart) / 2))
        : baseSat;
    sphere.material.color.setHSL(hue, sat, 0.875);

    let spikes =
      (0.5 + 1.5 * envelope * loudnessFactor) * processingSlider.val();

    for (let i = 0; i < sphere.geometry.vertices.length; i++) {
      let p = sphere.geometry.vertices[i];
      p.normalize();
      p.multiplyScalar(
        0.75 +
          0.3 *
            simplex.noise3D(
              p.x * spikes + time,
              p.y * spikes + time,
              p.z * spikes + time
            )
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

function toggleControls() {
  if (debugMode) {
    $(".controls").css("visibility", "hidden");
    $(".p5Canvas").css("visibility", "hidden");
    $("#app").css("border", "none");
  } else {
    $(".controls").css("visibility", "visible");
    $(".p5Canvas").css("visibility", "visible");
    $("#app").css("border", "1px solid red");
  }
  debugMode = !debugMode;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
