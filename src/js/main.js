import GUI from 'lil-gui';
import {AdsrEnvelope} from "./adsr-envelope.js";
import createParametersWithGUI from './parameters.js';
import {ready} from "./ready.js";
import {Blob} from "./blob.js";

let mic = null;

const adsrEnvelope = new AdsrEnvelope();

// Fix the width and height of the canvas
const canvasWidth = 3840;
const canvasHeight = 2160;

let video = null;
const videoWidth = 1280;
const videoHeight = 960;

const debugPanelWidth = canvasWidth / 3;
const debugPanelHeight = debugPanelWidth * (videoHeight / videoWidth);

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
  updateSpikes();
  updateSpeed();
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
  parameters.loudness.value = maxLoudness;

  const clampedLoudness = clamp(maxLoudness, parameters.loudness.min, parameters.loudness.max);
  if(parameters.loudness.max - parameters.loudness.min < Number.EPSILON)
    parameters.loudness.relValue = 0;
  else
    parameters.loudness.relValue = (clampedLoudness - parameters.loudness.min) / (parameters.loudness.max - parameters.loudness.min);
}

function updateProximity() {
  let screenspace = 0;
  for (let pose of poses) {
    const { width, height } = pose.box;
    screenspace += width * height;
  }

  const proximityProxy = 1 - screenspace / (videoWidth * videoHeight);
  parameters.proximity.value = proximityProxy;
  let proximity = clamp(proximityProxy, parameters.proximity.min, parameters.proximity.max);
  if( parameters.proximity.max - parameters.proximity.min < Number.EPSILON)
    parameters.proximity.relValue = 0;
  else
    parameters.proximity.relValue = (proximity - parameters.proximity.min) / (parameters.proximity.max - parameters.proximity.min);
}

function updateSpikes() {
  const newSpikes = parameters.spikes.min + parameters.loudness.relValue * (parameters.spikes.max - parameters.spikes.min);
  let spikes = lerp(parameters.spikes.value, newSpikes, parameters.spikes.smoothing, parameters.spikes.maxDelta);
  spikes = {computed: spikes, min: parameters.spikes.min, max: parameters.spikes.max}[parameters.spikes.use];
  parameters.spikes.value = spikes;
}

function updateSpeed() {
  const newSpeed = parameters.speed.min + parameters.proximity.relValue * (parameters.speed.max - parameters.speed.min);
  let speed = lerp(parameters.speed.value, newSpeed, parameters.speed.smoothing, parameters.speed.maxDelta);
  speed = {computed: speed, min: parameters.speed.min, max: parameters.speed.max}[parameters.speed.use];
  parameters.speed.value = speed;
}

function drawDebugPanel(p) {
  // Draw the webcam video
  if (video) {
    p.image(video, 0, 0, debugPanelWidth, debugPanelHeight);

    // Draw all the tracked landmark points
    for (let i = 0; i < poses.length; i++) {
      let pose = poses[i];
      for (let j = 0; j < pose.keypoints.length; j++) {
        let keypoint = pose.keypoints[j];
        if (keypoint.confidence < minKeypointConfidence) continue;
        p.fill(255, 255, 0);
        p.stroke(0, 0, 0);
        p.circle(
            (keypoint.x / video.width) * debugPanelWidth,
            (keypoint.y / video.height) * debugPanelHeight,
            30
        );
      }
    }
  }
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

  function animate(timestamp) {
    if (isDevMode())
      gui.controllersRecursive().forEach(c => c.updateDisplay());

    const blobParameters = {
      detail: parameters.blob.detail,
      blobSize: parameters.blob.size,
      spikes: parameters.spikes.value,
      spikeRatio: parameters.spikes.ratio,
      speed: parameters.speed.value,
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
