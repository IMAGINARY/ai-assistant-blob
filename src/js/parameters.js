import transferFunctions from "./transfer-functions.js";

function checkbox(value) {
  return {
    value,
    addToGUI: (gui, obj, prop) => gui.add(obj, prop),
  };
}

function number(value, decimals = 3) {
  return {
    value,
    addToGUI: (gui, obj, prop) => gui.add(obj, prop).decimals(decimals),
  };
}

function slider(value, min, max, step, decimals = 3) {
  return {
    value,
    addToGUI: (gui, obj, prop) =>
      gui.add(obj, prop, min, max, step).decimals(decimals),
  };
}

function colorPicker(value) {
  return {
    value,
    addToGUI: (gui, obj, prop) => gui.addColor(obj, prop),
  };
}

function dropdown(value, choices) {
  return {
    value,
    addToGUI: (gui, obj, prop) => gui.add(obj, prop, choices),
  };
}

function transferFunction(value) {
  return dropdown(value, Object.keys(transferFunctions));
}

const parametersWithGUI = {
  loudness: {
    value: slider(0, 0, 1, 0.001, 4),
    relValue: slider(0, 0, 1, 0.001),
    min: slider(0.005, 0, 1, 0.001),
    max: slider(0.2, 0, 1, 0.001),
    use: dropdown("computed", ["computed", "min", "middle", "max"]),
  },

  loudnessEnvelope: {
    attackTime: slider(0.1, 0, 10, 0.01),
    decayTime: slider(0.1, 0, 10, 0.01),
    sustainLevel: slider(0.75, 0, 1, 0.01),
    sustainTime: slider(0.1, 0, 10, 0.01),
    releaseTime: slider(0.5, 0, 10, 0.01),
    samplesPerSecond: slider(60, 1, 1000, 1),
  },

  distance: {
    value: number(1000, 4),
    relValue: slider(1, 0, 1, 0.001),
    min: slider(2, 0, 100, 0.001),
    max: slider(10, 0, 100, 0.001),
    use: dropdown("computed", ["computed", "min", "middle", "max"]),
    calibrationDistance: slider(5, 0, 100, 0.001),
  },

  spikes: {
    value: number(0.2, 4),
    relValue: slider(0, 0, 1, 0.001),
    ratio: slider(0.3, 0, 1, 0.001),
    min: slider(0.2, 0, 100, 0.01),
    max: slider(10, 0, 100, 0.01),
    smoothing: slider(0.1, 0, 1, 0.001),
    maxDelta: slider(1, 0, 10, 0.01),
    use: dropdown("computed", ["computed", "min", "middle", "max"]),
    transfer: transferFunction("cubicOutIn"),
  },

  speed: {
    value: number(0.02, 4),
    relValue: slider(0, 0, 1, 0.001),
    min: slider(0.02, 0, 100, 0.01),
    max: slider(0.4, 0, 100, 0.01),
    smoothing: slider(0.05, 0, 1, 0.001),
    maxDelta: slider(0.1, 0, 10, 0.01),
    use: dropdown("computed", ["computed", "min", "middle", "max"]),
    transfer: transferFunction("sineInOut"),
  },

  blob: {
    detail: slider(2 ** 7, 0, 2 ** 8, 1),
    size: slider(1.3, 0.1, 3, 0.01),
    offsetX: slider(-180, -10000, 10000, 1),
    offsetY: slider(80, -10000, 10000, 1),
  },

  blobMaterial: {
    color: colorPicker("#ffd09c"),
    emissive: colorPicker("#000000"),
    specular: colorPicker("#ffffff"),
    shininess: slider(25, 0, 100, 0.1),
    wireframe: checkbox(false),
  },

  scene: {
    gamma: slider(1.1, 0, 10, 0.01),
    background: colorPicker("#000000"),
    shadows: checkbox(false),
  },

  ambientLight: {
    color: colorPicker("#ffffff"),
    intensity: slider(1, 0, 1, 0.001),
  },

  directionalLight1: {
    color: colorPicker("#ffffff"),
    intensity: slider(0.7, 0, 1, 0.001),
    positionX: slider(0, -1000, 1000, 0.01),
    positionY: slider(1.25, -1000, 1000, 0.01),
    positionZ: slider(0.5, -1000, 1000, 0.01),
    bias: slider(0, -1, 1, 0.001),
    normalBias: slider(0.015, -1, 1, 0.001),
    helper: checkbox(false),
  },

  directionalLight2: {
    color: colorPicker("#ffffff"),
    intensity: slider(0.25, 0, 1, 0.001),
    positionX: slider(0, -1000, 1000, 0.01),
    positionY: slider(-1.25, -1000, 1000, 0.01),
    positionZ: slider(1, -1000, 1000, 0.01),
    bias: slider(0.015, -1, 1, 0.001),
    normalBias: slider(0, -1, 1, 0.001),
    helper: checkbox(false),
  },
};

export default function createParametersWithGUI() {
  const parameters = {};
  for (let groupName of Object.keys(parametersWithGUI)) {
    parameters[groupName] = {};
    const group = parametersWithGUI[groupName];
    for (let parameterName of Object.keys(group)) {
      parameters[groupName][parameterName] = group[parameterName].value;
    }
  }

  const buildParameterGUI = (gui) => {
    for (let groupName of Object.keys(parametersWithGUI)) {
      const folder = gui.addFolder(groupName);
      const group = parametersWithGUI[groupName];
      for (let parameterName of Object.keys(group)) {
        group[parameterName].addToGUI(
          folder,
          parameters[groupName],
          parameterName,
        );
      }
    }
  };

  return {
    parameters,
    buildParameterGUI,
  };
}
