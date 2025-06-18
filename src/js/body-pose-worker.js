WorkerGlobalScope.onerror = (...args) => console.error(...args);

self.document = {
  documentElement: {
    matches: () => false,
  }
};

const ml5ModuleUrl = "../../vendor/ml5@1.2.1/ml5.min.js";
const bodyPoseModelUrl =
  "../../vendor/movenet-tfjs-multipose-lightning-v1/model.json";

onmessage = (e) => e.data.videoFrame.close(); // discard video frames arriving before the detector is ready

async function createBodyPose(ml5) {
  const bodyPoseOptions = { modelUrl: bodyPoseModelUrl };
  return new Promise((resolve, reject) =>
    ml5.bodyPose(bodyPoseOptions, (bodyPose, error) =>
      error ? reject(error) : resolve(bodyPose),
    ),
  );
}

function createDetector(bodyPose) {
  let imageData = new ImageData(1, 1);

  return async (videoFrame) => {
    const { displayWidth, displayHeight } = videoFrame;
    if (imageData.width !== displayWidth || imageData.height !== displayHeight)
      imageData = new ImageData(displayWidth, displayHeight);
    videoFrame.copyTo(imageData.data, { format: "RGBA", colorSpace: "srgb" });

    const poses = await bodyPose.detect(imageData);

    return { poses, width: displayWidth, height: displayHeight };
  };
}

function startDetecting(detect) {
  const dummyVideoFrame = { close: () => {} };
  let videoFrame = dummyVideoFrame;
  let detectionRequestId = null;

  const requestDetection = () => {
    if (detectionRequestId === null) {
      detectionRequestId = setTimeout(async () => {
        detectionRequestId = null;
        const videoFrameForDetection = videoFrame;
        videoFrame = dummyVideoFrame;
        const detectionResult = await detect(videoFrameForDetection);
        postMessage(detectionResult);
        videoFrameForDetection.close();
      }, 0);
    }
  };

  onmessage = async (e) => {
    videoFrame.close();
    videoFrame = e.data.videoFrame;
    requestDetection();
  };
}

async function main() {
  const { default: ml5 } = await import(ml5ModuleUrl);
  const bodyPose = await createBodyPose(ml5);
  const detect = createDetector(bodyPose);
  startDetecting(detect);
}

main()
  .then(() => {})
  .catch((error) => console.error(error));
