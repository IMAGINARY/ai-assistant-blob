import GUI from 'lil-gui';
import {AdsrEnvelope} from "./adsr-envelope.js";
import createParametersWithGUI from './parameters.js';
import transferFunctions from "./transfer-functions.js";
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

const bodyPoseCalibrationData = [
  {"edge": [0, 1], "length": 14.301801345203806},
  {"edge": [0, 2], "length": 11.953981572261926},
  {"edge": [1, 3], "length": 23.14288087964115},
  {"edge": [2, 4], "length": 25.63858145077031},
  {"edge": [5, 6], "length": 92.13539103378947},
  {"edge": [5, 7], "length": 66.29024934865839},
  {"edge": [5, 11], "length": 141.1914734699386},
  {"edge": [6, 8], "length": 72.83002587952937},
  {"edge": [6, 12], "length": 138.36247679762778},
  {"edge": [7, 9], "length": 70.18937978914478},
  {"edge": [8, 10], "length": 67.54234321771733},
  {"edge": [11, 12], "length": 57.41601742212445},
  {"edge": [11, 13], "length": 107.73159210500128},
  {"edge": [12, 14], "length": 105.93599863645467},
  {"edge": [13, 15], "length": 97.7252829601421},
  {"edge": [14, 16], "length": 96.02396705786506}
];

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
  updateDistance();
  updateSpikes();
  updateSpeed();
}

function updateCss() {
  document.documentElement.style.setProperty(`--blob-offset-x`, parameters.blob.offsetX);
  document.documentElement.style.setProperty(`--blob-offset-y`, parameters.blob.offsetY);
  document.documentElement.style.setProperty(`--background-color`, parameters.scene.background);

}

function updateLoudness() {
  const {min, max, use} = parameters.loudness;
  //get the level of amplitude of the mic
  const level = mic ? mic.getLevel(1) : 0;
  adsrEnvelope.setParameters(parameters.loudnessEnvelope);
  adsrEnvelope.appendSample(level);
  parameters.loudness.value = {computed: adsrEnvelope.getMax(), min, middle: (min + max) / 2, max}[use];

  const clampedLoudness = clamp(parameters.loudness.value, parameters.loudness.min, parameters.loudness.max);
  if(parameters.loudness.max - parameters.loudness.min < Number.EPSILON)
    parameters.loudness.relValue = 0;
  else
    parameters.loudness.relValue = (clampedLoudness - parameters.loudness.min) / (parameters.loudness.max - parameters.loudness.min);
}

function updateDistance() {
  const {min, max, use} = parameters.distance;
  const maxRelEdgeLength = poses.reduce((maxRelEdgeLength, pose) => {
    const maxPoseRelEdgeLength = bodyPoseCalibrationData.reduce((maxPoseRelEdgeLength,edgeWithProps)=>{
      const [v1, v2] = edgeWithProps.edge;
      const kp1 = pose.keypoints[v1];
      const kp2 = pose.keypoints[v2];
      if( kp1.confidence < minKeypointConfidence && kp2.confidence < minKeypointConfidence)
        return maxPoseRelEdgeLength;

      const edgeLength = Math.sqrt((kp1.x - kp2.x) ** 2 + (kp1.y - kp2.y) ** 2);
      return Math.max(maxPoseRelEdgeLength, edgeLength / edgeWithProps.length);
    }, 0);
    return Math.max(maxRelEdgeLength, maxPoseRelEdgeLength);
  }, 0);

  const distance = maxRelEdgeLength !== 0 ? parameters.distance.calibrationDistance / maxRelEdgeLength : Number.MAX_VALUE;
  parameters.distance.value = {computed: distance, min, middle: (min + max) / 2, max}[use];

  let clampedDistance = clamp(parameters.distance.value, parameters.distance.min, parameters.distance.max);
  if( parameters.distance.max - parameters.distance.min < Number.EPSILON)
    parameters.distance.relValue = 1;
  else
    parameters.distance.relValue = (clampedDistance - parameters.distance.min) / (parameters.distance.max - parameters.distance.min);
}

function updateSpikes() {
  updateBlobParameter(parameters.spikes, parameters.loudness.relValue);
}

function updateSpeed() {
  updateBlobParameter(parameters.speed, parameters.distance.relValue);
}

function updateBlobParameter(parameter, relInputValue) {
  const {value, min, max, use, transfer, smoothing, maxDelta} = parameter;
  const transferredRelInputValue = transferFunctions[transfer](relInputValue);
  let newValue = min + transferredRelInputValue * (max - min);
  newValue = lerp(value, newValue, smoothing, maxDelta);
  newValue = {computed: newValue, min, middle: (min + max) / 2, max}[use];
  Object.assign(parameter, {
    relValue: (newValue - min) / (max - min),
    value: newValue,
  });
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

async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function calibrateBodyPose() {
  const initialDelaySeconds = 10;
  const iterationDelaySeconds = 1;
  const minIterationCount = 5;
  console.log(`Starting body pose calibration in ${initialDelaySeconds}s`);
  await delay(initialDelaySeconds * 1000);

  console.log("Starting body pose calibration now");
  const minCalibrationConfidence = 0.5;
  const connections = bodyPose.getConnections();
  const edgesWithProps = connections.map(([v1, v2]) => ({
    edge: [v1, v2],
    length: -1,
  }));

  for(let i = 1; true; i += 1) {
    console.log(`Iteration ${i}`);
    poses.forEach((pose) => {
      edgesWithProps.forEach((edgeWithProps, i) => {
        const [v1, v2] = edgeWithProps.edge;
        const kp1 = pose.keypoints[v1];
        const kp2 = pose.keypoints[v2];
        if( kp1.confidence > minCalibrationConfidence || kp2.confidence > minCalibrationConfidence) {
          const length = Math.sqrt((kp1.x - kp2.x) ** 2 + (kp1.y - kp2.y) ** 2);
          edgeWithProps.length = Math.max(edgeWithProps.length, length);
        }
      })
    });

    const minLength = Math.min(...edgesWithProps.map(({length}) => length));
    const done = i >= minIterationCount && minLength > 0;
    if(done)
      break;
    await delay(iterationDelaySeconds * 1000);
  }

  console.log("Calibration complete. Edges with properties:", edgesWithProps);
}

ready().then(function () {
  const gui = new GUI({ container: document.querySelector('#dev-control-panel') });
  const guiTools = {
    "Log to console": () => console.log(parameters),
    "Calibrate body pose": calibrateBodyPose,
  }
  Object.keys(guiTools).forEach((key) => gui.add(guiTools, key));
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

  const blob = new Blob(canvas);

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
