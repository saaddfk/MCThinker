// Ensure videoTools is initialized
window.videoTools = window.videoTools || {};

let actionNet; // Stores the loaded MoViNet model
let objectDetectionNet; // Stores the loaded COCO-SSD model

const MOVINET_MODEL_URL = 'https://tfhub.dev/tensorflow/tfjs-model/movinet/a0/stream/kinetics-600/classification/1';
const MODEL_INPUT_HEIGHT = 172;
const MODEL_INPUT_WIDTH = 172;
const MODEL_EXPECTED_FRAMES = 10; // Example for MoViNet, might need adjustment

// Granular readiness flags
window.videoTools.modelsReady = {
    action: false,
    object: false
};

// Helper to check if all models are ready
function allModelsReady() {
    return window.videoTools.modelsReady.action && window.videoTools.modelsReady.object;
}

/**
 * Loads all required models: Action Recognition (MoViNet) and Object Detection (COCO-SSD).
 */
async function loadAllModels() {
    if (typeof tf === 'undefined') {
        console.error("TensorFlow.js not loaded. Models cannot be loaded.");
        if (document.getElementById('analysisStatus')) {
            document.getElementById('analysisStatus').textContent = "Error: TensorFlow.js not loaded.";
        }
        return;
    }

    // Load Action Recognition Model (MoViNet)
    try {
        console.log("Loading Action Recognition model from:", MOVINET_MODEL_URL);
        updateStatusInUI("Loading action recognition model...");
        actionNet = await tf.loadGraphModel(MOVINET_MODEL_URL, { fromTFHub: true });
        console.log("Action Recognition model loaded successfully.");
        window.videoTools.modelsReady.action = true;
        updateStatusInUI("Action model loaded.");
    } catch (error) {
        console.error("Error loading Action Recognition model:", error);
        window.videoTools.modelsReady.action = false;
        updateStatusInUI("Error loading action model. See console.");
    }

    // Load Object Detection Model (COCO-SSD)
    if (typeof cocoSsd === 'undefined') {
        console.error("COCO-SSD library not loaded. Object detection model cannot be loaded.");
        window.videoTools.modelsReady.object = false;
        updateStatusInUI("Error: COCO-SSD library not loaded.");
        return; // Can't proceed with this model
    }
    try {
        console.log("Loading Object Detection model...");
        updateStatusInUI("Loading object detection model...");
        objectDetectionNet = await cocoSsd.load();
        console.log("Object Detection model loaded successfully.");
        window.videoTools.modelsReady.object = true;
        updateStatusInUI("Object detection model loaded.");
    } catch (error) {
        console.error("Error loading Object Detection model:", error);
        window.videoTools.modelsReady.object = false;
        updateStatusInUI("Error loading object detection model. See console.");
    }

    if (allModelsReady()) {
        console.log("All models loaded successfully.");
        updateStatusInUI("All models loaded and ready for analysis.");
    } else {
        console.warn("One or more models failed to load.");
        updateStatusInUI("Warning: One or more models failed to load. Functionality may be limited.");
    }
}

function updateStatusInUI(message) {
    // This function is a helper. app.js has its own updateStatus, but this is for model loading phase.
    const statusEl = document.getElementById('analysisStatus');
    if (statusEl) {
        statusEl.textContent = message;
    }
}


/**
 * Performs object detection on a single frame using COCO-SSD.
 * @param {string | HTMLImageElement} frameInput Frame data URL or an HTMLImageElement.
 * @param {number} [frameTimestamp] Optional timestamp for the frame.
 * @param {number} confidenceThreshold Minimum confidence score for detected objects.
 * @param {string[]} relevantClasses Array of class names to filter for (e.g., ['person']).
 * @returns {Promise<object | null>} An object { timestamp, objects: [predictions] } or null.
 */
async function performObjectDetection(frameInput, frameTimestamp = 0, confidenceThreshold = 0.5, relevantClasses = ['person']) {
    if (!objectDetectionNet) {
        console.error("Object Detection model not loaded or available.");
        return null;
    }
    if (!frameInput) {
        console.error("No frame input (data URL or ImageElement) provided for object detection.");
        return null;
    }
    if (typeof tf === 'undefined') {
        console.error("TensorFlow.js not available for object detection.");
        return null;
    }

    let imageElement = frameInput;
    if (typeof frameInput === 'string') { // Assuming data URL
        try {
            imageElement = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = (err) => {
                    console.error("Failed to load image from data URL for object detection:", err);
                    reject(new Error("Failed to load image from data URL."));
                };
                img.src = frameInput;
            });
        } catch (error) {
            return null; // Error already logged
        }
    } else if (!(frameInput instanceof HTMLImageElement || frameInput instanceof HTMLVideoElement || frameInput instanceof HTMLCanvasElement || frameInput instanceof ImageData)) {
        // cocoSsd.detect can also take video/canvas/image_data. For simplicity, we focus on ImageElement here.
        console.error("Invalid frameInput type for object detection. Expected data URL or HTMLImageElement.");
        return null;
    }

    console.log(`Performing object detection on frame (timestamp: ${frameTimestamp})...`);
    try {
        const predictions = await objectDetectionNet.detect(imageElement);

        const filteredPredictions = predictions.filter(p =>
            p.score >= confidenceThreshold &&
            (relevantClasses.length === 0 || relevantClasses.includes(p.class))
        );

        console.log(`Object detection complete for frame ${frameTimestamp}. Found ${filteredPredictions.length} relevant objects.`);
        return { timestamp: frameTimestamp, objects: filteredPredictions };

    } catch (error) {
        console.error(`Error during object detection for frame ${frameTimestamp}:`, error);
        return null;
    }
}


// --- Functions from previous steps (potentially modified for new model loading) ---

/**
 * Preprocesses an array of frames (as data URLs) for MoViNet.
 * (No changes needed to this function itself for this step, but its caller in app.js will change)
 * @param {string[]} frameDataUrls Array of frame data URLs.
 * @param {number} targetFrames The exact number of frames the model expects.
 * @returns {Promise<tf.Tensor | null>} A tensor of shape [1, num_frames, height, width, 3] or null if error.
 */
async function preprocessFramesForMoViNet(frameDataUrls, targetFrames = MODEL_EXPECTED_FRAMES) {
    if (!frameDataUrls || frameDataUrls.length === 0) {
        console.error("No frames provided for preprocessing.");
        return null;
    }
    if (typeof tf === 'undefined') {
        console.error("TensorFlow.js not available for preprocessing.");
        return null;
    }

    console.log(`Preprocessing ${frameDataUrls.length} frames for MoViNet. Target frames: ${targetFrames}`);
    const frameTensors = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let selectedFrameUrls = frameDataUrls;
    if (frameDataUrls.length > targetFrames) {
        selectedFrameUrls = frameDataUrls.slice(0, targetFrames);
        console.log(`Selected first ${targetFrames} frames from ${frameDataUrls.length} available.`);
    } else if (frameDataUrls.length < targetFrames) {
        const lastFrame = frameDataUrls[frameDataUrls.length - 1];
        for (let i = frameDataUrls.length; i < targetFrames; i++) {
            selectedFrameUrls.push(lastFrame);
        }
        console.log(`Padded frames from ${frameDataUrls.length} to ${targetFrames} by repeating the last frame.`);
    }

    for (const dataUrl of selectedFrameUrls) {
        try {
            const img = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = (err) => reject(new Error("Failed to load image from data URL: " + err));
                image.src = dataUrl;
            });

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            let tensor = tf.browser.fromPixels(canvas);
            if (tensor.shape[2] === 4) {
                tensor = tensor.slice([0, 0, 0], [tensor.shape[0], tensor.shape[1], 3]);
            }

            const resizedTensor = tf.image.resizeBilinear(tensor, [MODEL_INPUT_HEIGHT, MODEL_INPUT_WIDTH]);
            const normalizedTensor = resizedTensor.div(255.0);

            frameTensors.push(normalizedTensor);
            tf.dispose(tensor);
        } catch (error) {
            console.error("Error processing a frame for MoViNet:", error);
            frameTensors.forEach(t => tf.dispose(t));
            tf.dispose(frameTensors);
            return null;
        }
    }

    if (frameTensors.length === 0) {
        console.error("No frames were successfully processed into tensors for MoViNet.");
        return null;
    }

    const stackedFrames = tf.stack(frameTensors);
    const batchedFrames = stackedFrames.expandDims(0);

    frameTensors.forEach(t => tf.dispose(t));
    tf.dispose(stackedFrames);

    console.log("MoViNet frames preprocessed successfully. Tensor shape:", batchedFrames.shape);
    return batchedFrames;
}


/**
 * Performs action recognition using the loaded MoViNet model.
 * (No changes needed to this function itself for this step)
 * @param {tf.Tensor} preprocessedFramesTensor A tensor of shape [1, num_frames, height, width, 3].
 * @returns {Promise<any | null>} An array of recognized actions with scores, or null if error.
 */
async function performActionRecognition(preprocessedFramesTensor) {
    if (!actionNet) {
        console.error("Action recognition model not loaded or available.");
        return null;
    }
    if (!preprocessedFramesTensor) {
        console.error("No preprocessed frames tensor provided for action recognition inference.");
        return null;
    }
    if (typeof tf === 'undefined') {
        console.error("TensorFlow.js not available for action recognition inference.");
        return null;
    }

    console.log("Performing action recognition...");
    try {
        const predictions = await actionNet.predict(preprocessedFramesTensor);
        console.log("Raw MoViNet model predictions:", predictions);

        let outputData;
        if (Array.isArray(predictions)) {
            outputData = [];
            for (const p of predictions) {
                outputData.push(await p.array());
                p.dispose();
            }
        } else if (predictions.data) {
            outputData = await predictions.array();
            predictions.dispose();
        } else {
            outputData = "MoViNet output format not immediately processable to JS array/object.";
            console.warn("MoViNet model output was not a tensor with .data() or an array of tensors.");
        }

        console.log("Action recognition complete. Processed MoViNet output:", outputData);
        return outputData;
    } catch (error) {
        console.error("Error during action recognition inference:", error);
        return null;
    } finally {
        tf.dispose(preprocessedFramesTensor);
    }
}

/**
 * Extracts frames from a video element at a specified interval.
 * (No changes needed to this function itself for this step)
 * @param {HTMLVideoElement} videoElement The video element to extract frames from.
 * @param {number} intervalSeconds The interval in seconds at which to extract frames.
 * @returns {Promise<string[]>} A promise that resolves with an array of frame data URLs (jpeg).
 */
function extractFrames(videoElement, intervalSeconds) {
    return new Promise((resolve, reject) => {
        // ... (implementation from previous step, unchanged)
        if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
            return reject(new Error("Invalid videoElement provided."));
        }
        if (typeof intervalSeconds !== 'number' || intervalSeconds <= 0) {
            return reject(new Error("Invalid intervalSeconds. Must be a positive number."));
        }

        const frames = [];
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
            return reject(new Error("Unable to get 2D context from canvas."));
        }

        videoElement.muted = true;
        videoElement.setAttribute('playsinline', '');

        let currentTime = 0;
        let frameCount = 0;
        let expectedFrames;
        const videoDuration = videoElement.duration; // Cache duration

        const onLoadedMetadata = () => {
            console.log(`Video metadata loaded: Duration: ${videoDuration}s, Dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
            if (videoDuration === Infinity || videoDuration === 0 || isNaN(videoDuration) ) {
                videoElement.currentTime = 0.001;
                console.warn("Video duration is Infinity, 0 or NaN. Frame extraction might be unreliable or incomplete.");
            }

            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;

            if (videoDuration > 0 && videoDuration !== Infinity) {
                 expectedFrames = Math.floor(videoDuration / intervalSeconds) + 1;
            } else {
                console.warn("Video duration is unknown, expectedFrames cannot be pre-calculated accurately.");
                expectedFrames = -1;
            }
            console.log(`Expecting to extract approximately ${expectedFrames > 0 ? expectedFrames : 'an unknown number of'} frames for frame extraction.`);

            seekNextFrame();
        };

        const onSeeked = async () => {
            console.log(`Frame extraction: Seeked to ${videoElement.currentTime.toFixed(2)}s`);

            if (canvas.width !== videoElement.videoWidth || canvas.height !== videoElement.videoHeight) {
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
            }
            if (canvas.width === 0 || canvas.height === 0) {
                console.warn(`Frame extraction: Canvas dimensions are zero at ${videoElement.currentTime.toFixed(2)}s. Skipping frame.`);
                advanceOrResolve();
                return;
            }

            context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            try {
                const dataURL = canvas.toDataURL('image/jpeg');
                frames.push(dataURL);
                frameCount++;
            } catch (error) {
                console.error(`Frame extraction: Error converting canvas to data URL at ${videoElement.currentTime.toFixed(2)}s: `, error);
            }

            advanceOrResolve();
        };

        function advanceOrResolve() {
            currentTime += intervalSeconds;
            // Use cached videoDuration
            if (currentTime <= videoDuration || (videoDuration === Infinity && frameCount < (expectedFrames > 0 ? expectedFrames : 1000 )) ) { // Limit for infinite duration
                seekNextFrame();
            } else {
                if (frames.length > 0 || expectedFrames === 0 || (expectedFrames === -1 && frameCount > 0) ) {
                     console.log(`Frame extraction complete. Total frames: ${frames.length}`);
                } else if (expectedFrames === -1 && frameCount === 0 && videoDuration > 0) {
                    console.warn("Frame extraction finished, but no frames were collected, and duration was initially unknown.");
                } else if (videoDuration <= 0 || isNaN(videoDuration)){
                    console.warn("Frame extraction finished. Video duration was invalid or zero. Collected frames:", frames.length);
                } else {
                    console.warn(`Frame extraction process finished. Expected around ${expectedFrames} frames, got ${frames.length}. Duration: ${videoDuration}, Interval: ${intervalSeconds}`);
                }
                resolve(frames); // Resolve regardless of warnings above, with what we have.
                cleanUpListeners();
            }
        }

        function seekNextFrame() {
            // Use cached videoDuration
            if (videoDuration > 0 && videoDuration !== Infinity && currentTime <= videoDuration) {
                // console.log(`Frame extraction: Seeking to next frame at ${currentTime.toFixed(2)}s`);
                videoElement.currentTime = currentTime;
            } else if (videoDuration === Infinity || videoDuration === 0 || isNaN(videoDuration)) {
                if (currentTime === 0 && (videoDuration === 0 || isNaN(videoDuration))) {
                     console.warn("Frame extraction: Cannot seek: Video duration still unknown or zero after metadata load attempt.");
                     videoElement.currentTime = 0;
                     setTimeout(() => { // Fallback for problematic videos
                        if (frames.length === 0) {
                            console.warn("Frame extraction fallback: Resolving with no frames as duration is problematic.");
                            resolve(frames);
                            cleanUpListeners();
                        }
                     }, 2000);
                     return;
                }
                 videoElement.currentTime = currentTime; // For "infinite" duration, keep seeking
            } else {
                // This means currentTime has exceeded duration, so we are done.
                console.log("Frame extraction: Seeking condition not met (currentTime > duration), resolving.");
                resolve(frames);
                cleanUpListeners();
            }
        }

        let listenersAttached = false;
        function cleanUpListeners() {
            if (listenersAttached) {
                videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
                videoElement.removeEventListener('seeked', onSeeked);
                videoElement.removeEventListener('error', onError);
                listenersAttached = false;
            }
        }

        const onError = (e) => {
            console.error("Frame extraction: Video error occurred:", e);
            reject(new Error("Video playback error prevented frame extraction."));
            cleanUpListeners();
        };

        videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
        videoElement.addEventListener('seeked', onSeeked);
        videoElement.addEventListener('error', onError);
        listenersAttached = true;

        if (videoElement.readyState >= 1) { // HAVE_METADATA or greater
            console.log("Frame extraction: Video metadata already loaded or loading, proceeding.");
            onLoadedMetadata(); // Call directly if metadata already loaded
        } else {
            console.log("Frame extraction: Video metadata not yet loaded. Added event listener for 'loadedmetadata'.");
        }

        // Safety timeout (no change from before)
        const safetyTimeoutDuration = Math.max(30000, (videoDuration || 60) * 1000 * 1.5);
        const safetyTimeout = setTimeout(() => {
            if (frames.length === 0 && (expectedFrames > 0 || expectedFrames === -1)) {
                console.warn(`Frame extraction: Safety timeout. No frames extracted. Duration: ${videoDuration}, Current Time: ${videoElement.currentTime}`);
            } else if (frames.length > 0 && (currentTime <= videoDuration || videoDuration === Infinity)) {
                console.warn(`Frame extraction: Safety timeout. Extracted ${frames.length} frames. Process might be stuck. Duration: ${videoDuration}, Current Time: ${videoElement.currentTime}`);
            }
            resolve(frames); // Resolve with whatever frames were collected
            cleanUpListeners();
        }, safetyTimeoutDuration);


        if (videoElement.src && videoElement.networkState === HTMLMediaElement.NETWORK_NO_SOURCE && videoElement.readyState === HTMLMediaElement.HAVE_NOTHING) {
           console.log("Frame extraction: Attempting to load video data.");
           videoElement.load();
        } else if (!videoElement.src) {
            reject(new Error("Video source is not set. Cannot extract frames."));
            cleanUpListeners();
        }
    });
}


// Expose functions to window.videoTools
window.videoTools.extractFrames = extractFrames;
window.videoTools.loadAllModels = loadAllModels; // Renamed
window.videoTools.preprocessFramesForMoViNet = preprocessFramesForMoViNet;
window.videoTools.performActionRecognition = performActionRecognition;
window.videoTools.performObjectDetection = performObjectDetection; // New function

// Automatically load all models when the script is loaded
loadAllModels();
