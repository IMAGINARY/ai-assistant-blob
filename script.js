import {createUnitSphereBufferGeometry} from './sphere.js';

let mic = null;
let level = 0;
let relativeLoudness = 0;
let relativeProximity = 0;

let spikes = 0;
let speed = 0;

let attackTime = 0.2; // Attack time in seconds
let decayTime = 1; // Decay time in seconds
let sustainLevel = 0.75; // Sustain level (0 to 1)
let sustainTime = 0; // Sustain time in seconds
let releaseTime = 2; // Release time in seconds

let envelopeSamples = new Array(Math.ceil(60 * (attackTime + decayTime + sustainTime + releaseTime)))
    .fill(0).map((_, i) => {
      let t = i / 60; // Convert sample index to seconds
      if(t < attackTime)
        return t / attackTime; // Linear increase during attack

      t -= attackTime; // Adjust time for decay phase
      if (t < decayTime)
        return 1 - (t / decayTime) * (1 - sustainLevel); // Linear decrease during decay

      t -= decayTime; // Adjust time for sustain phase
      if (t < sustainTime)
        return sustainLevel; // Sustain level

      t -= sustainTime; // Adjust time for release phase
      if (t <= releaseTime)
        return sustainLevel * (1 - (t / releaseTime)); // Linear decrease during release
    });

let samples = new Array(envelopeSamples.length).fill(0);
let lastSampleTime = performance.now();

// Fix the width and height of the canvas
const canvasWidth = 3840;
const canvasHeight = 2160;

let video = null;
const videoWidth = 640;
const videoHeight = 480;
let bodyPose;
let poses = [];

const minKeypointConfidence = 0.75;

let debugMode = false;

const parameters = {
  // Sound parameters
  minLoudness: 0.002,
  maxLoudness: 0.4,

  // Proximity parameters
  minProximity: 0.1,
  maxProximity: 1,

  // Spike parameters
  minSpikes: 0.5,
  maxSpikes: 10,
  spikeSmoothing: 0.5,
  spikeMaxDelta: 0.2,

  // Speed parameters
  minSpeed: 0.05,
  maxSpeed: 2,
  speedSmoothing: 0.5,
  speedMaxDelta: 0.1,

  colorSpeed: 0.02,
  baseSaturation: 0.75,

  blobBaseRadius: 1,
  // Blob offset from the center of the screen.
  blobOffsetX: -180,
  blobOffsetY: -80,

  gammaFactor: 0.5,
  ambientLightIntensity: 0.5,
};

function kc2cc(kc) {
  // Convert kebab case to camel case
  return kc.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function cc2kc(cc) {
  // Convert camel case to kebab case
  return cc.replace(/([a-z])([A-Z])/g, (g) => g[0] + "-" + g[1].toLowerCase());
}

function preload(p) {
  // Load the bodyPose model
  bodyPose = ml5.bodyPose({
    modelUrl: "./vendor/movenet-tfjs-multipose-lightning-v1/model.json",
  });
}

async function listDevices() {
  // Log all devices to be able to set deviceIds
  const devices = await navigator.mediaDevices.enumerateDevices();
  console.log("Video input devices: ", [...devices]);
}

async function setupMic(p, id) {
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

async function setupVideo(p, id) {
  const constraints =
    id !== null && typeof id !== "undefined"
      ? {
          video: {
            deviceId: {
              exact: id,
            },
          },
          audio: false
        }
      : { video: true, audio: false };
  return p.createCapture(constraints);
}

async function setupAsync(p) {
  const searchParams = new URL(document.location.toString()).searchParams;

  await listDevices();

  mic = await setupMic(p, searchParams.get("audioDeviceId"));

  video = await setupVideo(p, searchParams.get("videoDeviceId"));
  video.size(videoWidth, videoHeight);
  video.hide();
  video.volume(0); // mute the video's audio

  bodyPose.detectStart(video, gotPoses);
}

function setup(p) {
  p.userStartAudio();
  p.createCanvas(canvasWidth, 200);

  setupAsync(p);
}

function draw(p) {
  const computedStyle = getComputedStyle(document.documentElement);
  for (let k of Object.keys(parameters)) {
    const cssProperty = `--${cc2kc(k)}`;
    const cssValue = computedStyle.getPropertyValue(cssProperty);
    const v = Number.parseFloat(cssValue);
    parameters[k] = v;
  }

  if (mic) {
    //get the level of amplitude of the mic
    level = mic.getLevel(1);
    const sampleTime = performance.now();
    do {
      const firstSample = samples.pop();
      samples.unshift(level);
      lastSampleTime += 1000 / 60;
    } while((sampleTime - lastSampleTime) * 1000 / 60 > 0);
    lastSampleTime = sampleTime;

    const appliedEnvelope = samples.map((s, i) => envelopeSamples[i] * s);
    const maxLoudness = Math.max(...appliedEnvelope);
    const clampedLoudness = clamp(maxLoudness, parameters.minLoudness, parameters.maxLoudness);
    if(parameters.maxLoudness - parameters.minLoudness < Number.EPSILON)
      relativeLoudness= 0;
    else
      relativeLoudness = (clampedLoudness - parameters.minLoudness) / (parameters.maxLoudness - parameters.minLoudness);
  }

  if (debugMode) {
    p.background(200);

    p.fill(255);
    p.stroke(0);

    p.circle(300, 100, relativeLoudness * 300);

    // Draw the webcam video
    if (video) p.image(video, 400, 0, (200 * videoWidth) / videoHeight, 200);

    // Draw all the tracked landmark points
    for (let i = 0; i < poses.length; i++) {
      let pose = poses[i];
      for (let j = 0; j < pose.keypoints.length; j++) {
        let keypoint = pose.keypoints[j];
        if (keypoint.confidence < minKeypointConfidence) continue;
        p.fill(0, 255, 0);
        p.noStroke();
        p.circle(
          400 + ((keypoint.x / videoWidth) * 200 * videoWidth) / videoHeight,
          (keypoint.y / videoHeight) * 200,
          10
        );
      }
    }

    p.fill(255);
    p.stroke(0);
    p.circle(
      400 + (200 * videoWidth) / videoHeight + 100,
      100,
      relativeProximity * 100
    );

    p.fill(0);
    p.noStroke();
    p.text("Loudness", 200 + 10, 20);
    p.text("Bodypose tracking", 400 + 10, 20);
    p.text("Proximity", 400 + (200 * videoWidth) / videoHeight + 10, 20);
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

  const proximityProxy = 1 - screenspace / (videoWidth * videoHeight);
  let proximity = clamp(proximityProxy, parameters.minProximity, parameters.maxProximity);
  if( parameters.maxProximity - parameters.minProximity < Number.EPSILON)
    relativeProximity = 0;
  else
    relativeProximity = (proximity - parameters.minProximity) / (parameters.maxProximity - parameters.minProximity);
}


const mainSketch = (p) => {
  p.preload = () => preload(p);
  p.setup = () => setup(p);
  p.draw = () => draw(p);
}

new p5(mainSketch);

$(document).ready(function () {
  for (let [k, v] of Object.entries(parameters))
    document.documentElement.style.setProperty(`--${cc2kc(k)}`, v);

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

  renderer.gammaOutput = true;

  let scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    canvasWidth / canvasHeight,
    0.1,
    1000
  );

  camera.position.z = 5;

  // Create high resolution sphere geometry
  const levels = 7;
  const sphereGeometry = createUnitSphereBufferGeometry(levels);
  const clonedVertices = new Float32Array(sphereGeometry.attributes.position.array);

  let material = new THREE.MeshPhongMaterial({
    color: 0xffe0d4,
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

  let ambientLight = new THREE.AmbientLight(
    0xffffff,
    parameters.ambientLightIntensity
  );
  scene.add(ambientLight);

  let sphere = new THREE.Mesh(sphereGeometry, material);

  scene.add(sphere);

  let time = 0;
  let lastTimestamp;

  let update = (timestamp) => {
    renderer.gammaFactor = parameters.gammaFactor;
    ambientLight.intensity = parameters.ambientLightIntensity;

    const newSpikes = parameters.minSpikes + relativeLoudness * (parameters.maxSpikes - parameters.minSpikes);
    spikes = lerp(spikes, newSpikes, parameters.spikeSmoothing, parameters.spikeMaxDelta);

    const newSpeed = parameters.minSpeed + relativeProximity * (parameters.maxSpeed - parameters.minSpeed);
    speed = lerp(speed, newSpeed, parameters.speedSmoothing, parameters.speedMaxDelta);

    const timeDiff = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    time += timeDiff * speed / 1000;

    /*
    let hue = (time * parameters.colorSpeed) % 1;
    // Desaturate the area starting around purple to match the color scheme
    const baseSat = parameters.baseSaturation;
    let desatStart = 5 / 8;
    let sat =
      hue > desatStart
        ? baseSat *
          (1 - Math.min(1 - hue, hue - desatStart) / ((1 - desatStart) / 2))
        : baseSat;
    sphere.material.color.setHSL(hue, sat, 0.875);
    */

    const positionAttribute = sphere.geometry.getAttribute('position');
    for (let j = 0; j < positionAttribute.count; j += 1) {
      const i = j * 3;
      let x = clonedVertices[i + 0];
      let y = clonedVertices[i + 1];
      let z = clonedVertices[i + 2];

      const simplexNoise = simplex.noise3D(
          x * spikes + time,
          y * spikes + time,
          z * spikes + time
      );

      const newLength = parameters.blobBaseRadius + 0.3 * simplexNoise;
      positionAttribute.setXYZ(j, x * newLength, y * newLength, z * newLength,);
    }
    positionAttribute.needsUpdate = true;
    sphere.geometry.computeVertexNormals();
    sphere.geometry.vertexNormalsNeedUpdate = true;
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

function lerp(current, goal, smoothingFactor, maxSpeed) {
  let output = goal * smoothingFactor + current * (1 - smoothingFactor);
  let diff = output - current;
  return current + Math.sign(diff) * Math.min(maxSpeed, Math.abs(diff));
}
