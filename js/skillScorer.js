window.skillScorerTools = {};

/**
 * Calculates a skill score based on analytics data.
 * This is a heuristic-based calculation and can be tuned.
 * @param {Object} analyticsData - Object containing analytics metrics like
 *                                { fightEvents, buildEvents, movementActivityPercentage, pvpFramesPercentage, videoDuration }.
 * @returns {number} An integer skill score (0-100).
 */
window.skillScorerTools.calculateSkillScore = function(analyticsData) {
    if (!analyticsData) return 0;

    const {
        fightEvents = 0,
        buildEvents = 0,
        movementActivityPercentage = 0,
        pvpFramesPercentage = 0,
        videoDuration = 0
    } = analyticsData;

    const fightScore = Math.min(fightEvents / 10, 1) * 30;
    const buildScore = Math.min(buildEvents / 20, 1) * 25;
    const movementScore = (movementActivityPercentage / 100) * 20;
    const pvpScore = Math.min(pvpFramesPercentage / 50, 1) * 25;

    let totalScore = fightScore + buildScore + movementScore + pvpScore;
    totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    return totalScore;
};

/**
 * Provides a qualitative assessment based on the skill score.
 * @param {number} skillScore - The skill score (0-100).
 * @returns {string} Qualitative assessment (e.g., "Beginner", "Intermediate", "Pro").
 */
window.skillScorerTools.getQualitativeAssessment = function(skillScore) {
    if (skillScore < 40) {
        return "Beginner";
    } else if (skillScore < 75) {
        return "Intermediate";
    } else {
        return "Pro";
    }
};

/**
 * Generates gameplay recommendations based on analytics data and skill score.
 * @param {Object} analyticsData - The analytics data object.
 * @param {number} skillScore - The calculated skill score.
 * @returns {string} A string containing one or a few formatted recommendations.
 */
window.skillScorerTools.generateRecommendations = function(analyticsData, skillScore) {
    if (!analyticsData) return "No analytics data available to generate recommendations.";

    const recommendations = [];
    const {
        fightEvents = 0,
        buildEvents = 0,
        movementActivityPercentage = 0,
        pvpFramesPercentage = 0
    } = analyticsData;

    // Rule-based recommendations
    if (skillScore < 50 && fightEvents < 5) {
        recommendations.push("Try to engage in more combat scenarios to practice your fighting skills and improve situational awareness.");
    }
    if (skillScore < 60 && buildEvents < 10 ) {
         if (pvpFramesPercentage > 20) {
            recommendations.push("Your PvP activity is good! Consider incorporating more strategic building to gain an edge in fights.");
        } else {
            recommendations.push("Focus on practicing your building skills. Good structures can provide significant advantages.");
        }
    }
    if (movementActivityPercentage < 30) {
        recommendations.push("Explore the map more actively. Increasing your movement and map awareness can lead to better positioning and resource gathering.");
    }
     if (pvpFramesPercentage < 15 && fightEvents > 5) {
        recommendations.push("You're engaging in fights, but perhaps not always against other players. Seek out more direct PvP encounters to sharpen those skills.");
    }

    // Positive reinforcement or general tips
    if (skillScore >= 75) {
        if (fightEvents > 10 && pvpFramesPercentage > 25) {
            recommendations.push("Excellent performance in combat and PvP! Keep refining your advanced tactics.");
        } else if (movementActivityPercentage > 60) {
            recommendations.push("Your high mobility is a great asset! Ensure you're translating that into strategic advantages.");
        }
    }

    if (skillScore < 40 && recommendations.length < 2) {
        recommendations.push("Focus on one aspect at a time. For example, try to increase your survival time or map exploration in the next few games.");
    }


    // Fallback recommendation
    if (recommendations.length === 0) {
        recommendations.push("Keep practicing consistently across all areas of gameplay to see overall improvement!");
    }

    // Select recommendations to display (e.g., first 1 or 2)
    if (recommendations.length > 2) {
        // Simple strategy: pick first and last if many, or first two.
        // This could be randomized or prioritized based on rule importance.
        return recommendations.slice(0, 2).join("\n");
    }

    return recommendations.join("\n"); // Join with newline for potential multi-line display
};
