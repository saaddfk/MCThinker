document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const videoUpload = document.getElementById('videoUpload');
    const videoPreview = document.getElementById('videoPreview');
    const uploadProgress = document.getElementById('uploadProgress');
    const analysisStatus = document.getElementById('analysisStatus');

    // Dashboard Elements
    const dashboardSection = document.getElementById('dashboard');
    const statFightEvents = document.getElementById('statFightEvents');
    const statBuildEvents = document.getElementById('statBuildEvents');
    const statMovementActivity = document.getElementById('statMovementActivity');
    const statPvpFrames = document.getElementById('statPvpFrames');
    const statVideoDuration = document.getElementById('statVideoDuration');
    const statSkillScore = document.getElementById('statSkillScore');
    const statSkillAssessment = document.getElementById('statSkillAssessment');
    const textRecommendations = document.getElementById('textRecommendations'); // New reference

    const FRAME_EXTRACTION_INTERVAL_SECONDS = 2;
    let storedActionResults = [];
    let storedObjectDetectionResults = [];

    function updateStatus(message) {
        if (analysisStatus) analysisStatus.textContent = message;
        console.log("Status: ", message);
    }

    function setProgress(value) {
        if (uploadProgress) uploadProgress.value = value;
    }

    function resetDashboard() {
        if (dashboardSection) dashboardSection.classList.add('hidden');
        if (statFightEvents) statFightEvents.textContent = '0';
        if (statBuildEvents) statBuildEvents.textContent = '0';
        if (statMovementActivity) statMovementActivity.textContent = '0%';
        if (statPvpFrames) statPvpFrames.textContent = '0%';
        if (statVideoDuration) statVideoDuration.textContent = '0s';
        if (statSkillScore) statSkillScore.textContent = '0';
        if (statSkillAssessment) statSkillAssessment.textContent = 'Calculating...';
        if (textRecommendations) textRecommendations.textContent = 'Analyzing for tips...'; // Reset recommendations
    }

    function updateDashboard(analyticsData) {
        if (!analyticsData) return;
        if (statFightEvents) statFightEvents.textContent = analyticsData.fightEvents || 0;
        if (statBuildEvents) statBuildEvents.textContent = analyticsData.buildEvents || 0;
        if (statMovementActivity) statMovementActivity.textContent = (analyticsData.movementActivityPercentage || 0).toFixed(1) + '%';
        if (statPvpFrames) statPvpFrames.textContent = (analyticsData.pvpFramesPercentage || 0).toFixed(1) + '%';
        if (statVideoDuration) statVideoDuration.textContent = (analyticsData.videoDuration || 0).toFixed(1) + 's';

        if (window.skillScorerTools && analyticsData) {
            const skillScore = window.skillScorerTools.calculateSkillScore(analyticsData);
            const assessment = window.skillScorerTools.getQualitativeAssessment(skillScore);
            if (statSkillScore) statSkillScore.textContent = skillScore;
            if (statSkillAssessment) statSkillAssessment.textContent = assessment;

            // Generate and display recommendations
            const recommendations = window.skillScorerTools.generateRecommendations(analyticsData, skillScore);
            if (textRecommendations) textRecommendations.textContent = recommendations;

        } else {
            if (statSkillScore) statSkillScore.textContent = 'N/A';
            if (statSkillAssessment) statSkillAssessment.textContent = 'Error';
            if (textRecommendations) textRecommendations.textContent = 'Could not generate recommendations.';
        }

        if (dashboardSection) dashboardSection.classList.remove('hidden');
    }

    // --- Library Checks ---
    if (typeof tf === 'undefined') {
        updateStatus("Error: TensorFlow.js library is not loaded.");
        if(videoUpload) videoUpload.disabled = true; return;
    }
    // ... (other library checks remain the same)
    if (typeof cocoSsd === 'undefined') {
        updateStatus("Error: COCO-SSD library is not loaded.");
    }
    if (typeof window.gameAnalyticsTools === 'undefined') {
        updateStatus("Error: Game Analytics tools (gameAnalytics.js) are not loaded.");
        if(videoUpload) videoUpload.disabled = true; return;
    }
    if (typeof window.skillScorerTools === 'undefined') {
        updateStatus("Error: Skill Scorer tools (skillScorer.js) are not loaded.");
        if(videoUpload) videoUpload.disabled = true; return;
    }


    const vt = window.videoTools;
    const analyticsTools = window.gameAnalyticsTools;

    if (!vt || !vt.extractFrames || !vt.loadAllModels || !vt.preprocessFramesForMoViNet || !vt.performActionRecognition || !vt.performObjectDetection) {
        updateStatus("Error: Video processing tools (videoProcessor.js) are not fully loaded.");
        if(videoUpload) videoUpload.disabled = true; return;
    }

    function areAllModelsReady() {
        return vt.modelsReady && vt.modelsReady.action && vt.modelsReady.object;
    }

    if (!areAllModelsReady()) {
        updateStatus("Models are loading (Action & Object Detection)...");
    }

    resetDashboard();

    // --- Event Listener for Video Upload ---
    if (videoUpload) {
        videoUpload.addEventListener('change', async function(event) {
            storedActionResults = [];
            storedObjectDetectionResults = [];
            resetDashboard();

            const files = event.target.files;
            if (files && files[0]) {
                const file = files[0];
                updateStatus("File selected. Loading video...");
                setProgress(5);

                const videoURL = URL.createObjectURL(file);

                if (videoPreview) {
                    videoPreview.src = videoURL;
                    videoPreview.onloadeddata = async () => {
                        updateStatus("Video data loaded. Preparing for analysis...");
                        setProgress(10);

                        if (!areAllModelsReady()) {
                            updateStatus("Waiting for all models to finish loading...");
                            let checks = 0;
                            const maxChecks = 60;
                            const checkInterval = setInterval(async () => {
                                checks++;
                                if (areAllModelsReady()) {
                                    clearInterval(checkInterval);
                                    updateStatus("All models ready. Starting analysis pipeline.");
                                    setProgress(20);
                                    await processVideo();
                                } else if (checks >= maxChecks) {
                                    clearInterval(checkInterval);
                                    updateStatus("Error: Model loading timed out.");
                                    setProgress(0);
                                } else {
                                     updateStatus(`Waiting for models... Action: ${vt.modelsReady.action}, Object: ${vt.modelsReady.object} (${checks}s)`);
                                }
                            }, 1000);
                        } else {
                            updateStatus("All models ready. Starting analysis pipeline.");
                            setProgress(20);
                            await processVideo();
                        }
                    };

                    async function processVideo() {
                        try {
                            updateStatus("Extracting frames from video...");
                            setProgress(30);
                            const extractedFrames = await vt.extractFrames(videoPreview, FRAME_EXTRACTION_INTERVAL_SECONDS);
                            if (!extractedFrames || extractedFrames.length === 0) {
                                updateStatus("Frame extraction failed. Analysis aborted.");
                                setProgress(0); return;
                            }
                            updateStatus(`Extracted ${extractedFrames.length} frames. Starting action recognition...`);
                            setProgress(40);

                            const actionRecognitionTensor = await vt.preprocessFramesForMoViNet(extractedFrames);
                            if (!actionRecognitionTensor) {
                                updateStatus("Action recognition preprocessing failed. Skipping action analysis.");
                                storedActionResults = [];
                            } else {
                                const rawActionResults = await vt.performActionRecognition(actionRecognitionTensor);
                                if (rawActionResults) {
                                    updateStatus("Action recognition complete.");
                                    storedActionResults = rawActionResults;
                                    console.log("Stored Action Recognition Results:", storedActionResults);
                                } else {
                                    updateStatus("Action recognition failed.");
                                    storedActionResults = [];
                                }
                            }
                            setProgress(60);

                            updateStatus("Starting object detection on extracted frames...");
                            storedObjectDetectionResults = [];
                            for (let i = 0; i < extractedFrames.length; i++) {
                                const frameDataUrl = extractedFrames[i];
                                const timestamp = i * FRAME_EXTRACTION_INTERVAL_SECONDS;
                                const detectionResult = await vt.performObjectDetection(frameDataUrl, timestamp);
                                if (detectionResult) {
                                    storedObjectDetectionResults.push(detectionResult);
                                }
                                setProgress(60 + Math.floor(((i + 1) / extractedFrames.length) * 15));
                            }
                            console.log("Stored Object Detection Results:", storedObjectDetectionResults);
                            updateStatus("Object detection complete.");
                            setProgress(75);

                            updateStatus("Calculating game analytics...");
                            setProgress(85);
                            const videoDuration = videoPreview.duration && !isNaN(videoPreview.duration) ? videoPreview.duration : 0;

                            let simplifiedActionsForAnalytics;
                            if (storedActionResults && storedActionResults.length > 0 && Array.isArray(storedActionResults[0])) {
                                console.warn("Action results are raw probabilities. Analytics for actions will be inaccurate without label mapping.");
                                simplifiedActionsForAnalytics = storedActionResults.map((_segment, index) => `segment_${index}_action_placeholder`);
                            } else if (storedActionResults && storedActionResults.length > 0 && typeof storedActionResults[0] === 'object' && storedActionResults[0] !== null && !storedActionResults[0].hasOwnProperty('action') && !storedActionResults[0].hasOwnProperty('label') ) {
                                console.warn("Action results are objects without a direct 'action' or 'label' key. Analytics might be inaccurate.");
                                simplifiedActionsForAnalytics = storedActionResults.map((obj, index) => {
                                    for(const key in obj) if(typeof obj[key] === 'string') return obj[key];
                                    return `segment_${index}_action_placeholder`;
                                });
                            } else {
                                simplifiedActionsForAnalytics = storedActionResults;
                            }

                            const gameAnalytics = analyticsTools.generateOverallAnalytics(
                                simplifiedActionsForAnalytics,
                                storedObjectDetectionResults,
                                videoDuration,
                                'action'
                            );
                            console.log("Game Analytics:", gameAnalytics);
                            updateStatus("Analytics calculation complete! Displaying results.");
                            setProgress(100);
                            updateDashboard(gameAnalytics);

                        } catch (error) {
                            console.error("Error during video processing pipeline:", error);
                            updateStatus(`Error: ${error.message}. Analysis failed.`);
                            setProgress(0);
                            resetDashboard();
                        }
                    }

                    videoPreview.onerror = () => {
                        console.error("Error loading video file.");
                        updateStatus("Error loading video file.");
                        setProgress(0);
                        resetDashboard();
                    };
                } else {
                    console.error('videoPreview element not found');
                    updateStatus("Error: Video preview element missing.");
                }
            } else {
                updateStatus("No file selected.");
                if (videoPreview) videoPreview.src = '';
                setProgress(0);
                resetDashboard();
            }
        });
    } else {
        console.error('videoUpload element not found');
        updateStatus("Error: File upload element missing.");
    }
});
