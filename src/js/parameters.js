/*
{
    "loudness": {
        "min": 0.01,
        "max": 0.05
    },
    "proximity": {
        "min": 0.1,
        "max": 1
    },
    "spikes": {
        "ratio": 0.3,
        "min": 0.2,
        "max": 10,
        "smoothing": 0.5,
        "maxDelta": 0.2,
        "use": "computed"
    },
    "speed": {
        "min": 0.02,
        "max": 0.2,
        "smoothing": 0.5,
        "maxDelta": 0.1,
        "use": "computed"
    },
    "blob": {
        "detail": 7,
        "size": 1.3,
        "offsetX": -180,
        "offsetY": -80
    },
    "blobMaterial": {
        "color": "#ffd09c",
        "emissive": "#000000",
        "specular": "#ffffff",
        "shininess": 25,
        "wireframe": false
    },
    "scene": {
        "gamma": 1.1,
        "background": "#000000",
        "shadows": false
    },
    "ambientLight": {
        "color": "#ffffff",
        "intensity": 1
    },
    "directionalLight1": {
        "color": "#ffffff",
        "intensity": 0.7,
        "positionX": 0,
        "positionY": 500,
        "positionZ": 200
    },
    "directionalLight2": {
        "color": "#ffffff",
        "intensity": 0.25,
        "positionX": 0,
        "positionY": -500,
        "positionZ": 400
    }
}
 */
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
    min: number(0.002, 0, 1, 0.001),
    max: number(0.04, 0, 1, 0.001),
  },

  proximity: {
    min: number(0.1, 0, 1, 0.001),
    max: number(1, 0, 1, 0.001),
  },

  spikes: {
    ratio: number(0.3, 0, 1, 0.001),
    min: number(0.5, 0, 100, 0.01),
    max: number(10, 0, 100, 0.01),
    smoothing: number(0.5, 0, 1, 0.001),
    maxDelta: number(0.2, 0, 10, 0.01),
    use: choice("computed", ["computed", "min", "max"]),
  },

  speed: {
    min: number(0.05, 0, 100, 0.01),
    max: number(2, 0, 100, 0.01),
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
    color: color("#ffe0d4"),
    emissive: color("#000000"),
    specular: color("#ffffff"),
    shininess: number(100, 0, 100, 0.1),
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
    positionY: number(500, -1000, 1000, 1),
    positionZ: number(200, -1000, 1000, 1),
  },

  directionalLight2: {
    color: color("#ffffff"),
    intensity: number(0.25, 0, 1, 0.001),
    positionX: number(0, -1000, 1000, 1),
    positionY: number(-500, -1000, 1000, 1),
    positionZ: number(400, -1000, 1000, 1),
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
