import {Blob} from "./blob.js";

let mic = null;
let level = 0;
let relativeLoudness = 0;
let relativeProximity = 0;

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

const debugPanelWidth = canvasWidth / 3;
const debugPanelHeight = canvasHeight / 3;

let video = null;
const videoWidth = 640;
const videoHeight = 480;
let bodyPose;
let poses = [];

const minKeypointConfidence = 0.25;

const parameters = {
  // Sound parameters
  minLoudness: 0.002,
  maxLoudness: 0.4,

  // Proximity parameters
  minProximity: 0.1,
  maxProximity: 1,

  // Spike parameters
  spikeRatio: 0.3,
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

  blobSize: 1.3,
  // Blob offset from the center of the screen.
  blobOffsetX: -180,
  blobOffsetY: -80,

  gammaFactor: 1.1,
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

  bodyPose.detectStart(video, (result) => {poses = result;});
}

function setup(p) {
  p.userStartAudio();

  const p5DebugCanvas = p.createCanvas(canvasWidth / 3, canvasHeight / 3);

  const devPanel = document.querySelector(".dev-panel");
  p5DebugCanvas.parent(devPanel);

  setupAsync(p);
}

function draw(p) {
  updateInputs();

  if (isDevMode())
    drawDebugPanel(p);
}

function updateInputs() {
  updateParametersFromCss();
  updateLoudness();
  updateProximity();
}

function updateParametersFromCss() {
  const computedStyle = getComputedStyle(document.documentElement);
  for (let k of Object.keys(parameters)) {
    const cssProperty = `--${cc2kc(k)}`;
    const cssValue = computedStyle.getPropertyValue(cssProperty);
    const v = Number.parseFloat(cssValue);
    parameters[k] = v;
  }
}

function updateLoudness() {
  //get the level of amplitude of the mic
  level = mic ? mic.getLevel(1) : 0;
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

function updateProximity() {
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

function drawDebugPanel(p) {
  p.background(200);

  p.fill(255);
  p.stroke(0);

  p.circle(300, 100, relativeLoudness * 300);

  // Draw the webcam video
  const debugVideoTop = debugPanelHeight / 3;
  const debugVideoLeft = 0;
  const debugVideoWidth = 2 * debugPanelWidth / 3;
  const debugVideoHeight =  (debugVideoWidth * videoHeight) / videoWidth;
  if (video) {
    p.image(video, debugVideoLeft, debugVideoTop, debugVideoWidth, debugVideoHeight);

    // Draw all the tracked landmark points
    for (let i = 0; i < poses.length; i++) {
      let pose = poses[i];
      for (let j = 0; j < pose.keypoints.length; j++) {
        let keypoint = pose.keypoints[j];
        if (keypoint.confidence < minKeypointConfidence) continue;
        p.fill(255, 255, 0);
        p.stroke(0, 0, 0);
        p.circle(
            debugVideoLeft + (keypoint.x / videoWidth) * debugVideoWidth,
            debugVideoTop + (keypoint.y / videoHeight) * debugVideoHeight,
            20
        );
      }
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
  p.text("Bodypose tracking", debugVideoLeft + 10, debugVideoTop + 20);
  p.text("Proximity", 400 + (200 * videoWidth) / videoHeight + 10, 20);
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
      toggleDevMode();
    }
  });

  const canvas = document.querySelector('.blob');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const detail = 7;
  const blob = new Blob(canvas, detail);
  let spikes = parameters.minSpikes;
  let speed = parameters.minSpeed;

  function animate(timestamp) {
    const newSpikes = parameters.minSpikes + relativeLoudness * (parameters.maxSpikes - parameters.minSpikes);
    spikes = lerp(spikes, newSpikes, parameters.spikeSmoothing, parameters.spikeMaxDelta);

    const newSpeed = parameters.minSpeed + relativeProximity * (parameters.maxSpeed - parameters.minSpeed);
    speed = lerp(speed, newSpeed, parameters.speedSmoothing, parameters.speedMaxDelta);

    const blobParameters = {
        blobSize: parameters.blobSize,
        spikes: spikes,
        spikeRatio: parameters.spikeRatio,
        speed: speed,
        gammaFactor: parameters.gammaFactor,
        ambientLightIntensity: parameters.ambientLightIntensity,
    }
    blob.animate(timestamp, blobParameters);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
});

function isDevMode() {
  const devPanel = document.querySelector(".dev-panel");
  return !devPanel.classList.contains("hidden");
}

function toggleDevMode() {
  const devPanel = document.querySelector(".dev-panel");
  if(!isDevMode())
      devPanel.classList.remove("hidden");
  else
      devPanel.classList.add("hidden");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(current, goal, smoothingFactor, maxSpeed) {
  let output = goal * smoothingFactor + current * (1 - smoothingFactor);
  let diff = output - current;
  return current + Math.sign(diff) * Math.min(maxSpeed, Math.abs(diff));
}
