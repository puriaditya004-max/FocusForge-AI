const { isFeatureEnabled } = require("../config/launchFlags");

function requireFeature(feature, options = {}) {
  const message =
    options.message ||
    "This feature is temporarily unavailable while FocusForge prepares for launch.";

  return (req, res, next) => {
    if (isFeatureEnabled(feature)) return next();

    return res.status(503).json({
      error: message,
      feature,
      disabled: true,
    });
  };
}

module.exports = { requireFeature };
