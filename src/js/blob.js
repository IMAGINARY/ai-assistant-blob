import * as THREE from "three";
import { EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { GammaCorrectionEffect } from "./GammaCorrectionEffect.js";
import { createUnitSphereBufferGeometry } from "./sphere.js";

export class Blob {
  constructor(canvas, detail = 5) {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      context: canvas.getContext("webgl2"),
      powerPreference: "high-performance",
      antialias: false,
      stencil: false,
      depth: false,
      alpha: true,
    });

    this.simplex = new SimplexNoise();

    renderer.setSize(canvas.width, canvas.height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);

    let scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      canvas.width / canvas.height,
      0.1,
      1000,
    );

    camera.position.z = 5;

    // Create high resolution sphere geometry
    this.sphereGeometry = createUnitSphereBufferGeometry(detail);
    this.sphereGeometry
      .getAttribute("position")
      .setUsage(THREE.StreamDrawUsage);
    this.sphereGeometry.computeVertexNormals();
    this.sphereGeometry.getAttribute("normal").setUsage(THREE.StreamDrawUsage);

    this.clonedVertices = new Float32Array(
      this.sphereGeometry.attributes.position.array,
    );

    const material = new THREE.MeshPhongMaterial({
      color: 0xffe0d4,
      specular: 0xffffff,
      shininess: 100,
    });

    const lightTop = new THREE.DirectionalLight(0xffffff, 0.7);
    lightTop.position.set(0, 500, 200);
    lightTop.castShadow = true;
    scene.add(lightTop);

    const lightBottom = new THREE.DirectionalLight(0xffffff, 0.25);
    lightBottom.position.set(0, -500, 400);
    lightBottom.castShadow = true;
    scene.add(lightBottom);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(this.ambientLight);

    this.sphere = new THREE.Mesh(this.sphereGeometry, material);
    scene.add(this.sphere);

    this.gammaCorrectionEffect = new GammaCorrectionEffect({ gamma: 1.2 });
    this.composer = new EffectComposer(renderer, { multisampling: 8 });
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new EffectPass(camera, this.gammaCorrectionEffect));

    this.render = () => this.composer.render(scene, camera);

    this.time = 0;
    this.lastTimestamp = -1;
  }

  updateGeometry(spikeRatio, factor, offset) {
    const v = this.clonedVertices;
    const positionAttribute = this.sphereGeometry.getAttribute("position");
    for (let j = 0; j < positionAttribute.count; j += 1) {
      const i = j * 3;
      let x = v[i + 0];
      let y = v[i + 1];
      let z = v[i + 2];

      const simplexNoise = this.simplex.noise3D(
        x * factor + offset,
        y * factor + offset,
        z * factor + offset,
      );

      const newLength = 1 - spikeRatio + spikeRatio * simplexNoise;
      positionAttribute.setXYZ(j, x * newLength, y * newLength, z * newLength);
    }
    positionAttribute.needsUpdate = true;
    this.sphereGeometry.computeVertexNormals();
    this.sphereGeometry.vertexNormalsNeedUpdate = true;
  }

  animate(
    timestamp,
    { blobSize, spikeRatio, spikes, speed, gammaFactor, ambientLightIntensity },
  ) {
    this.gammaCorrectionEffect.gamma = gammaFactor;
    this.ambientLight.intensity = ambientLightIntensity;
    this.sphere.scale.set(blobSize, blobSize, blobSize);

    const timeDiff =
      this.lastTimestamp === -1 ? 0 : timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.time += (timeDiff * speed) / 1000;

    this.updateGeometry(spikeRatio, spikes, this.time);
    this.render();
  }
}
