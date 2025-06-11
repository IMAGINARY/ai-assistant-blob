import GUI from 'lil-gui';
import {AdsrEnvelope} from "./adsr-envelope.js";
import createParametersWithGUI from './parameters.js';
import {ready} from "./ready.js";
import {Blob} from "./blob.js";

let mic = null;
let relativeLoudness = 0;
let relativeProximity = 0;

const adsrEnvelope = new AdsrEnvelope();

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

const {parameters, buildParameterGUI} = createParametersWithGUI();

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

  const devPanel = document.querySelector("#dev-canvas");
  p5DebugCanvas.parent(devPanel);

  setupAsync(p);
}

function draw(p) {
  updateInputs();

  if (isDevMode())
    drawDebugPanel(p);
}

function updateInputs() {
  updateCss();
  updateLoudness();
  updateProximity();
}

function updateCss() {
  document.documentElement.style.setProperty(`--blob-offset-x`, parameters.blob.offsetX);
  document.documentElement.style.setProperty(`--blob-offset-y`, parameters.blob.offsetY);
  document.documentElement.style.setProperty(`--background-color`, parameters.scene.background);

}

function updateLoudness() {
  //get the level of amplitude of the mic
  const level = mic ? mic.getLevel(1) : 0;
  adsrEnvelope.setParameters(parameters.loudnessEnvelope);
  adsrEnvelope.appendSample(level);
  const maxLoudness = adsrEnvelope.getMax();
  const clampedLoudness = clamp(maxLoudness, parameters.loudness.min, parameters.loudness.max);
  if(parameters.loudness.max - parameters.loudness.min < Number.EPSILON)
    relativeLoudness= 0;
  else
    relativeLoudness = (clampedLoudness - parameters.loudness.min) / (parameters.loudness.max - parameters.loudness.min);
}

function updateProximity() {
  let screenspace = 0;
  for (let pose of poses) {
    const { width, height } = pose.box;
    screenspace += width * height;
  }

  const proximityProxy = 1 - screenspace / (videoWidth * videoHeight);
  let proximity = clamp(proximityProxy, parameters.proximity.min, parameters.proximity.max);
  if( parameters.proximity.max - parameters.proximity.min < Number.EPSILON)
    relativeProximity = 0;
  else
    relativeProximity = (proximity - parameters.proximity.min) / (parameters.proximity.max - parameters.proximity.min);
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

ready().then(function () {
  const gui = new GUI({ container: document.querySelector('#dev-control-panel') });
  const guiTools = {
    "Log to console": () => console.log(parameters),
  }
  gui.add(guiTools, "Log to console");
  buildParameterGUI(gui);

  window.addEventListener("keydown", (e) => {
    if (e.key === "d") {
      toggleDevMode();
    }
  });
  if(!new URLSearchParams(window.location.search).has("dev"))
    toggleDevMode();

  const canvas = document.querySelector('#blob');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const detail = 7;
  const blob = new Blob(canvas, detail);
  let spikes = parameters.spikes.min;
  let speed = parameters.speed.min;

  function animate(timestamp) {
    const newSpikes = parameters.spikes.min + relativeLoudness * (parameters.spikes.max - parameters.spikes.min);
    spikes = lerp(spikes, newSpikes, parameters.spikes.smoothing, parameters.spikes.maxDelta);
    spikes = {computed: spikes, min: parameters.spikes.min, max: parameters.spikes.max}[parameters.spikes.use];

    const newSpeed = parameters.speed.min + relativeProximity * (parameters.speed.max - parameters.speed.min);
    speed = lerp(speed, newSpeed, parameters.speed.smoothing, parameters.speed.maxDelta);
    speed = {computed: speed, min: parameters.speed.min, max: parameters.speed.max}[parameters.speed.use];

    const blobParameters = {
      detail: parameters.blob.detail,
      blobSize: parameters.blob.size,
      spikes: spikes,
      spikeRatio: parameters.spikes.ratio,
      speed: speed,
      gammaFactor: parameters.scene.gamma,
      shadows: parameters.scene.shadows,
      blobMaterial: {...parameters.blobMaterial},
      ambientLight: {...parameters.ambientLight},
      directionalLight1: {...parameters.directionalLight1},
      directionalLight2: {...parameters.directionalLight2},
    }
    blob.animate(timestamp, blobParameters);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
});

function isDevMode() {
  const devPanel = document.querySelector("#dev-panel");
  return !devPanel.classList.contains("hidden");
}

function toggleDevMode() {
  const devPanel = document.querySelector("#dev-panel");
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
