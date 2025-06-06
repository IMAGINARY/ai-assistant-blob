
function boolean(value) {
  return {
    value,
    addToGUI: (gui, obj, prop) => gui.add(obj, prop),
  };
}

function number(value, min, max, step) {
  return {
    value,
    addToGUI: (gui, obj, prop) => gui.add(obj, prop, min, max, step),
  };
}

function color(value) {
  return {
    value,
    addToGUI: (gui, obj, prop) => gui.addColor(obj, prop),
  };
}

function choice(value, choices) {
  return {
    value,
    addToGUI: (gui, obj, prop) => gui.add(obj, prop, choices),
  };
}

const parametersWithGUI = {
  loudness: {
    min: number(0.01, 0, 1, 0.001),
    max: number(0.05, 0, 1, 0.001),
  },

  proximity: {
    min: number(0.1, 0, 1, 0.001),
    max: number(1, 0, 1, 0.001),
  },

  spikes: {
    ratio: number(0.3, 0, 1, 0.001),
    min: number(0.2, 0, 100, 0.01),
    max: number(10, 0, 100, 0.01),
    smoothing: number(0.5, 0, 1, 0.001),
    maxDelta: number(0.2, 0, 10, 0.01),
    use: choice("computed", ["computed", "min", "max"]),
  },

  speed: {
    min: number(0.02, 0, 100, 0.01),
    max: number(0.2, 0, 100, 0.01),
    smoothing: number(0.5, 0, 1, 0.001),
    maxDelta: number(0.1, 0, 10, 0.01),
    use: choice("computed", ["computed", "min", "max"]),
  },

  blob: {
    detail: number(7, 0, 8, 1),
    size: number(1.3, 0.1, 3, 0.01),
    offsetX: number(-180, -10000, 10000, 1),
    offsetY: number(80, -10000, 10000, 1),
  },

  blobMaterial: {
    color: color("#ffd09c"),
    emissive: color("#000000"),
    specular: color("#ffffff"),
    shininess: number(25, 0, 100, 0.1),
    wireframe: boolean(false),
  },

  scene: {
    gamma: number(1.1, 0, 10, 0.01),
    background: color("#000000"),
    shadows: boolean(false),
  },

  ambientLight: {
    color: color("#ffffff"),
    intensity: number(1, 0, 1, 0.001),
  },

  directionalLight1: {
    color: color("#ffffff"),
    intensity: number(0.7, 0, 1, 0.001),
    positionX: number(0, -1000, 1000, 1),
    positionY: number(10, -1000, 1000, 1),
    positionZ: number(4, -1000, 1000, 1),
    bias: number(0, -1, 1, 0.001),
    normalBias: number(0.015, -1, 1, 0.001),
  },

  directionalLight2: {
    color: color("#ffffff"),
    intensity: number(0.25, 0, 1, 0.001),
    positionX: number(0, -1000, 1000, 1),
    positionY: number(-5, -1000, 1000, 1),
    positionZ: number(4, -1000, 1000, 1),
    bias: number(0.015, -1, 1, 0.001),
    normalBias: number(0, -1, 1, 0.001),
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
