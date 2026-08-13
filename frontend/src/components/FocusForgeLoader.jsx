import React from "react";
import "./FocusForgeLoader.css";

const DEFAULT_ICON_SRC = "/icon-512.png";

export default function FocusForgeLoader({
  message = "Loading...",
  fullScreen = true,
  iconSrc = DEFAULT_ICON_SRC,
}) {
  return (
    <div
      className={[
        "ff-loader",
        fullScreen ? "ff-loader--screen" : "ff-loader--inline",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="ff-loader-stack">
        <div className="ff-loader-mark" aria-hidden="true">
          <svg className="ff-loader-rings" viewBox="0 0 120 120" fill="none">
            <ellipse className="ff-loader-ring ff-loader-ring--blue" cx="60" cy="60" rx="50" ry="17" />
            <ellipse className="ff-loader-ring ff-loader-ring--purple" cx="60" cy="60" rx="50" ry="17" />
            <ellipse className="ff-loader-ring ff-loader-ring--vertical" cx="60" cy="60" rx="18" ry="50" />
          </svg>

          <div className="ff-loader-core">
            <img className="ff-loader-icon" src={iconSrc} alt="" draggable="false" />
            <span className="ff-loader-shimmer" />
          </div>

          <span className="ff-loader-spark" />
        </div>

        {message ? <p className="ff-loader-text">{message}</p> : null}
      </div>
    </div>
  );
}
