let mic;
let level = 0;
let samples = new Array(32).fill(0);
let envelope = 0;

// Fix the width and height of the canvas
const canvasWidth = 3840;
const canvasHeight = 2160;
const loudnessFactor = 50;

let video;
let bodyPose;
let poses = [];

const minKeypointConfidence = 0.75;

let nearestZ = Number.POSITIVE_INFINITY;
const minZ = -0.5;
const maxZ = -0.2;
const proximityFactor = 50;

let relativeProximity = 0;

function preload() {
  // Load the bodyPose model
  bodyPose = ml5.bodyPose();
}

async function setup() {
  const searchParams = new URL(document.location.toString()).searchParams;
  createCanvas(canvasWidth, 200);
  userStartAudio();

  // Log all devices for
  const devices = await navigator.mediaDevices.enumerateDevices();
  for (const device of devices) {
    console.log(`${device.label} ${device.kind}: id = ${device.deviceId}`);
  }

  //create & start an audio input
  mic = new p5.AudioIn();
  if (searchParams.has("audioDeviceId")) {
    const audioDevices = await new Promise((resolve) => {
      mic.getSources((sources) => {
        resolve(sources);
      });
    });
    const index = audioDevices.findIndex(
      (device) => device.deviceId === searchParams.get("audioDeviceId")
    );
    mic.setSource(index);
  }
  mic.start();

  // Use provided `videoDeviceId` from search params, if available.
  if (searchParams.has("videoDeviceId")) {
    video = createCapture({
      video: {
        deviceId: {
          exact: searchParams.get("videoDeviceId"),
        },
      },
    });
  } else {
    video = createCapture(VIDEO);
  }

  // Create the video and hide it
  video.size(640, 480);
  video.hide();

  // Start detecting poses in the webcam video
  bodyPose.detectStart(video, gotPoses);
}

function draw() {
  //get the level of amplitude of the mic
  level = mic.getLevel(1);
  const firstSample = samples.shift();
  samples.push(level);
  envelope -= firstSample / samples.length;
  envelope += level / samples.length;

  background(200);

  fill(255);
  stroke(0);

  // circle(100, 100, level * loudnessFactor * 100);
  circle(300, 100, envelope * loudnessFactor * 100);

  // Draw the webcam video
  image(video, 400, 0, (200 * 640) / 480, 200);

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

// Callback function for when bodyPose outputs data
function gotPoses(results) {
  // Save the output to the poses variable
  poses = results;

  let screenspace = 0;
  for (let pose of poses) {
    const { width, height } = pose.box;
    screenspace += width * height;
  }

  relativeProximity = Math.max(0.1, Math.min(1, 1 - screenspace / (640 * 480)));
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

  let geometry = new THREE.SphereGeometry(0.8, 128, 128);

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
  const visible = $(".controls").css("visibility") !== "hidden";
  if (visible) {
    $(".controls").css("visibility", "hidden");
    $(".p5Canvas").css("visibility", "hidden");
    $("#app").css("border", "none");
  } else {
    $(".controls").css("visibility", "visible");
    $(".p5Canvas").css("visibility", "visible");
    $("#app").css("border", "1px solid red");
  }
}
