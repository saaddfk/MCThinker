window.gameAnalyticsTools = {};

/**
 * Calculates the number of fight-related events from action recognition results.
 * Assumes actionRecognitionResults is an array of objects, each with an 'action' property (e.g., the top predicted label string).
 * Or, if actionRecognitionResults is just an array of strings (labels), it will work too.
 * @param {Array<Object|string>} actionRecognitionResults - Array of action predictions.
 * @param {string} actionKey - The key in each result object that holds the action label (if objects are passed).
 * @param {Array<string>} fightLabels - Labels considered as fight events.
 * @returns {number} Count of fight events.
 */
window.gameAnalyticsTools.calculateFightEvents = function(actionRecognitionResults, actionKey = 'action', fightLabels = ['fight', 'fighting', 'combat', 'shoot', 'shooting', 'melee', 'kicking', 'punching']) {
    if (!actionRecognitionResults || actionRecognitionResults.length === 0) return 0;
    let count = 0;
    for (const result of actionRecognitionResults) {
        const label = typeof result === 'string' ? result : (result && result[actionKey] ? result[actionKey] : null);
        if (label && fightLabels.includes(label.toLowerCase())) {
            count++;
        }
    }
    return count;
};

/**
 * Calculates the number of build-related events.
 * @param {Array<Object|string>} actionRecognitionResults - Array of action predictions.
 * @param {string} actionKey - The key in each result object that holds the action label.
 * @param {Array<string>} buildLabels - Labels considered as build events.
 * @returns {number} Count of build events.
 */
window.gameAnalyticsTools.calculateBuildEvents = function(actionRecognitionResults, actionKey = 'action', buildLabels = ['build', 'building', 'construct', 'constructing', 'craft', 'crafting']) {
    if (!actionRecognitionResults || actionRecognitionResults.length === 0) return 0;
    let count = 0;
    for (const result of actionRecognitionResults) {
        const label = typeof result === 'string' ? result : (result && result[actionKey] ? result[actionKey] : null);
        if (label && buildLabels.includes(label.toLowerCase())) {
            count++;
        }
    }
    return count;
};

/**
 * Calculates the percentage of movement-related activity.
 * @param {Array<Object|string>} actionRecognitionResults - Array of action predictions.
 * @param {string} actionKey - The key in each result object that holds the action label.
 * @param {Array<string>} movementLabels - Labels considered as movement.
 * @returns {number} Percentage of movement activity (0-100).
 */
window.gameAnalyticsTools.calculateMovementActivity = function(actionRecognitionResults, actionKey = 'action', movementLabels = ['run', 'running', 'walk', 'walking', 'explore', 'exploring', 'move', 'moving', 'jump', 'jumping', 'swimming']) {
    if (!actionRecognitionResults || actionRecognitionResults.length === 0) return 0;
    let movementCount = 0;
    for (const result of actionRecognitionResults) {
        const label = typeof result === 'string' ? result : (result && result[actionKey] ? result[actionKey] : null);
        if (label && movementLabels.includes(label.toLowerCase())) {
            movementCount++;
        }
    }
    return (movementCount / actionRecognitionResults.length) * 100;
};

/**
 * Calculates the percentage of frames considered as PvP based on object detection.
 * @param {Array<Object>} objectDetectionResults - Array of {timestamp, objects: [{class, score}]}.
 * @param {number} minConfidence - Minimum confidence score for an object to be counted.
 * @param {string} playerClass - The class label for players (e.g., 'person').
 * @param {number} minPlayersForPvp - Minimum number of players to consider a frame as PvP.
 * @returns {number} Percentage of PvP frames (0-100).
 */
window.gameAnalyticsTools.calculatePvpFrames = function(objectDetectionResults, minConfidence = 0.5, playerClass = 'person', minPlayersForPvp = 2) {
    if (!objectDetectionResults || objectDetectionResults.length === 0) return 0;

    let pvpFrameCount = 0;
    let framesWithAnyDetections = 0; // Count frames that had any detections to avoid division by zero if no objects ever detected.

    for (const frameResult of objectDetectionResults) {
        if (frameResult.objects && frameResult.objects.length > 0) {
            framesWithAnyDetections++;
            let playerCount = 0;
            for (const obj of frameResult.objects) {
                if (obj.class === playerClass && obj.score >= minConfidence) {
                    playerCount++;
                }
            }
            if (playerCount >= minPlayersForPvp) {
                pvpFrameCount++;
            }
        }
    }

    if (framesWithAnyDetections === 0) return 0; // Or based on total frames from video if preferred
    // The prompt asks for "PvP frames / total frames with detections".
    // If we want PvP frames / total video frames, we'd need total video frames count.
    // Let's stick to "total frames with detections" for now.
    return (pvpFrameCount / framesWithAnyDetections) * 100;
};

/**
 * Generates an overall analytics summary.
 * This is a simplified interpretation of actionResults.
 * It assumes actionResults might be the direct output from MoViNet, which is often a probability distribution per segment.
 * For simplicity, we'll assume a prior step would convert this to a list of top action labels per segment/frame.
 * If actionResults is e.g. [ [prob_action1, prob_action2, ...], ... ], this needs adjustment.
 * Let's assume actionResults is an array of objects, like [{action: "fighting", score: 0.9}, {action: "running", score: 0.8}]
 * Or, if it's the raw output from performActionRecognition, it might be a multi-dimensional array.
 * For this function, we will assume `actionResults` is an array of pre-processed, simplified action items (e.g., strings or objects with a clear label).
 *
 * @param {Array<Object|string>} actionResults - Array of action recognition results (e.g., top label per segment).
 * @param {Array<Object>} objectResults - Array of object detection results.
 * @param {number} videoDuration - Duration of the video in seconds.
 * @param {string} actionLabelKey - If actionResults are objects, this key provides the action string.
 * @returns {Object} Analytics summary.
 */
window.gameAnalyticsTools.generateOverallAnalytics = function(actionResults, objectResults, videoDuration, actionLabelKey = 'action') {
    // Placeholder for actual action label extraction if actionResults is complex
    // For now, assume actionResults are in a format that calculateXEvents can directly use.
    // e.g., if actionResults is the raw output from MoViNet (like a list of probability arrays),
    // it would need to be processed first to get top labels.
    // For now, we pass it directly, assuming the helper functions can handle its structure or it's simplified.
    // A more robust solution would be to ensure actionResults is consistently formatted before this step.

    // Example of how one might process raw MoViNet output if it were, say, an array of probability arrays for K600:
    // const KINETICS_600_LABELS = ['label1', 'label2', ...]; // This would be required
    // const simplifiedActionResults = actionResults.map(probArray => {
    //    const maxProb = Math.max(...probArray);
    //    const index = probArray.indexOf(maxProb);
    //    return KINETICS_600_LABELS[index]; // This gives the top label string
    // });
    // Then pass simplifiedActionResults to the event calculators.
    // For now, this function will assume actionResults is already somewhat simplified.

    const fightEvents = this.calculateFightEvents(actionResults, actionLabelKey);
    const buildEvents = this.calculateBuildEvents(actionResults, actionLabelKey);
    const movementActivityPercentage = this.calculateMovementActivity(actionResults, actionLabelKey);
    const pvpFramesPercentage = this.calculatePvpFrames(objectResults);

    return {
        fightEvents: fightEvents,
        buildEvents: buildEvents,
        movementActivityPercentage: parseFloat(movementActivityPercentage.toFixed(2)),
        pvpFramesPercentage: parseFloat(pvpFramesPercentage.toFixed(2)),
        videoDuration: parseFloat(videoDuration.toFixed(2)) // Ensure duration is a number
    };
};
