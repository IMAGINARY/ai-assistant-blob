import * as THREE from "three/webgpu";
import { output, vec3, vec4, pow, uniform } from 'three/tsl'
import { createUnitSphereBufferGeometry } from "./sphere.js";
import { createNoise3D } from "simplex-noise";

export class Blob {
  constructor(canvas, detail = 5) {
    this.renderer = new THREE.WebGPURenderer({
      canvas: canvas,
      powerPreference: "high-performance",
      antialias: true,
    });

    this.detail = detail;

    this.noise3D = createNoise3D();

    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);

    let scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      canvas.width / canvas.height,
      0.1,
      1000,
    );

    camera.position.z = 5;

    // Create high resolution sphere geometry
    this.sphereGeometry = Blob.createSphereGeometry(detail);
    this.clonedVertices = new Float32Array(
      this.sphereGeometry.attributes.position.array,
    );

    this.material = new THREE.MeshPhongNodeMaterial({
      color: 0xffe0d4,
      specular: 0xffffff,
      shininess: 100,
    });
    this.gamma = uniform(1);
    this.material.outputNode = vec4(pow(output.rgb, vec3(this.gamma, this.gamma, this.gamma)), output.a);

    this.directionalLight1 = new THREE.DirectionalLight();
    this.directionalLight1.castShadow = true;
    this.directionalLight1.shadow.mapSize.set(2048, 2048);
    scene.add(this.directionalLight1);

    this.directionalLight1Helper = new THREE.DirectionalLightHelper( this.directionalLight1, 0.25 );
    scene.add( this.directionalLight1Helper );

    this.directionalLight2 = new THREE.DirectionalLight();
    this.directionalLight2.castShadow = true;
    this.directionalLight2.shadow.mapSize.set(2048, 2048);
    scene.add(this.directionalLight2);

    this.directionalLight2Helper = new THREE.DirectionalLightHelper( this.directionalLight2, 0.25 );
    scene.add( this.directionalLight2Helper );

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(this.ambientLight);

    this.sphere = new THREE.Mesh(this.sphereGeometry, this.material);
    this.sphere.receiveShadow = true;
    this.sphere.castShadow = true;
    scene.add(this.sphere);

    this.render = () => this.renderer.render(scene, camera);

    this.time = 0;
    this.lastTimestamp = -1;
  }

  static createSphereGeometry(detail) {
    const sphereGeometry = createUnitSphereBufferGeometry(detail);
    sphereGeometry.getAttribute("position").setUsage(THREE.StreamDrawUsage);
    sphereGeometry.computeVertexNormals();
    sphereGeometry.getAttribute("normal").setUsage(THREE.StreamDrawUsage);

    return sphereGeometry;
  }

  updateGeometry(spikeRatio, factor, offset) {
    const v = this.clonedVertices;
    const positionAttribute = this.sphere.geometry.getAttribute("position");
    for (let j = 0; j < positionAttribute.count; j += 1) {
      const i = j * 3;
      let x = v[i + 0];
      let y = v[i + 1];
      let z = v[i + 2];

      const simplexNoise = this.noise3D(
        x * factor + offset,
        y * factor + offset,
        z * factor + offset,
      );

      const newLength = 1 - spikeRatio + spikeRatio * simplexNoise;
      positionAttribute.setXYZ(j, x * newLength, y * newLength, z * newLength);
    }
    positionAttribute.needsUpdate = true;
    this.sphere.geometry.computeVertexNormals();
    this.sphere.geometry.vertexNormalsNeedUpdate = true;
  }

  animate(
    timestamp,
    {
      detail,
      blobSize,
      spikeRatio,
      spikes,
      speed,
      gammaFactor,
      shadows,
      blobMaterial,
      ambientLight,
      directionalLight1,
      directionalLight2,
    },
  ) {
    this.renderer.shadowMap.enabled = shadows;
    this.gamma.value = gammaFactor;

    this.ambientLight.intensity = ambientLight.intensity;
    this.ambientLight.color.set(ambientLight.color);

    this.directionalLight1.intensity = directionalLight1.intensity;
    this.directionalLight1.color.set(directionalLight1.color);
    this.directionalLight1.position.set(
      directionalLight1.positionX,
      directionalLight1.positionY,
      directionalLight1.positionZ,
    );
    const directionalLight1Distance = this.directionalLight1.position.length();
    this.directionalLight1.castShadow = shadows;
    this.directionalLight1.shadow.camera.left = -blobSize;
    this.directionalLight1.shadow.camera.right = blobSize;
    this.directionalLight1.shadow.camera.bottom = -blobSize;
    this.directionalLight1.shadow.camera.top = blobSize;
    this.directionalLight1.shadow.camera.near = directionalLight1Distance - blobSize;
    this.directionalLight1.shadow.camera.far = directionalLight1Distance + blobSize;
    this.directionalLight1.shadow.bias = directionalLight1.bias;
    this.directionalLight1.shadow.normalBias = directionalLight1.normalBias;
    this.directionalLight1Helper.visible = directionalLight1.helper;
    this.directionalLight1Helper.parent.updateMatrixWorld();
    this.directionalLight1Helper.update();

    this.directionalLight2.intensity = directionalLight2.intensity;
    this.directionalLight2.color.set(directionalLight2.color);
    this.directionalLight2.position.set(
      directionalLight2.positionX,
      directionalLight2.positionY,
      directionalLight2.positionZ,
    );
    const directionalLight2Distance = this.directionalLight2.position.length();
    this.directionalLight2.castShadow = shadows;
    this.directionalLight2.shadow.camera.left = -blobSize;
    this.directionalLight2.shadow.camera.right = blobSize;
    this.directionalLight2.shadow.camera.bottom = -blobSize;
    this.directionalLight2.shadow.camera.top = blobSize;
    this.directionalLight2.shadow.camera.near = directionalLight2Distance + blobSize;
    this.directionalLight2.shadow.camera.far = directionalLight2Distance - blobSize;
    this.directionalLight2.shadow.bias = directionalLight2.bias;
    this.directionalLight2.shadow.normalBias = directionalLight2.normalBias;
    this.directionalLight2Helper.visible = directionalLight2.helper;
    this.directionalLight2Helper.parent.updateMatrixWorld();
    this.directionalLight2Helper.update();

    this.sphere.scale.set(blobSize, blobSize, blobSize);

    this.material.color.set(blobMaterial.color);
    this.material.emissive.set(blobMaterial.emissive);
    this.material.specular.set(blobMaterial.specular);
    this.material.shininess = blobMaterial.shininess;
    this.material.wireframe = blobMaterial.wireframe;

    const timeDiff =
      this.lastTimestamp === -1 ? 0 : timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.time += (timeDiff * speed) / 1000;

    if (this.detail !== detail) {
      this.sphereGeometry = Blob.createSphereGeometry(detail);
      this.clonedVertices = new Float32Array(
        this.sphereGeometry.attributes.position.array,
      );
      this.sphere.geometry.dispose();
      this.sphere.geometry = this.sphereGeometry;
    }

    this.updateGeometry(spikeRatio, spikes, this.time);
    this.render();
  }
}
