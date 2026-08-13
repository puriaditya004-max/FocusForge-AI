import React, { useEffect, useState } from "react";
import "./FocusForgeLoader.css";

const DEFAULT_ICON_SRC = "/icon-512.png";

export default function FocusForgeLoader({
  message = "Building your focus space",
  fullScreen = true,
  iconSrc = DEFAULT_ICON_SRC,
}) {
  const [ringsLive, setRingsLive] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRingsLive(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={[
        "ff-branded-loader",
        ringsLive ? "rings-live" : "",
        fullScreen ? "ff-branded-loader--screen" : "ff-branded-loader--inline",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-label="FocusForge AI is loading"
    >
      <div className="ff-loader-content">
        <div className="ff-solar-stage" aria-hidden="true">
          <div className="ff-stars" />
          <div className="ff-core-aura" />

          <svg className="ff-orbit-art" viewBox="0 0 451 442" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="ffOrbitGlow" x1="60" y1="80" x2="390" y2="360" gradientUnits="userSpaceOnUse">
                <stop stopColor="#35E8FF" />
                <stop offset=".55" stopColor="#177BFF" />
                <stop offset="1" stopColor="#B54DFF" />
              </linearGradient>
              <linearGradient id="ffOrbitGlowReverse" x1="400" y1="120" x2="50" y2="320" gradientUnits="userSpaceOnUse">
                <stop stopColor="#238EFF" />
                <stop offset=".52" stopColor="#3C4BFF" />
                <stop offset="1" stopColor="#CA55FF" />
              </linearGradient>
            </defs>

            <circle cx="228" cy="221" r="157" stroke="url(#ffOrbitGlow)" strokeWidth="1.8" opacity=".66" />

            <g className="ff-orbit-wide">
              <ellipse cx="228" cy="221" rx="169" ry="54" transform="rotate(-17 228 221)" stroke="url(#ffOrbitGlow)" strokeWidth="1.7" opacity=".78" />
              <ellipse className="ff-dash-flow ff-dash-forward" cx="228" cy="221" rx="169" ry="54" transform="rotate(-17 228 221)" stroke="#8BEFFF" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 54" opacity=".92" />
            </g>

            <g className="ff-orbit-reverse">
              <ellipse cx="228" cy="221" rx="171" ry="61" transform="rotate(24 228 221)" stroke="url(#ffOrbitGlowReverse)" strokeWidth="1.45" opacity=".70" />
              <ellipse className="ff-dash-flow ff-dash-reverse" cx="228" cy="221" rx="171" ry="61" transform="rotate(24 228 221)" stroke="#B96CFF" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 69" opacity=".8" />
            </g>

            <g className="ff-orbit-vertical-down">
              <ellipse cx="228" cy="221" rx="59" ry="176" transform="rotate(-9 228 221)" stroke="url(#ffOrbitGlow)" strokeWidth="1.45" opacity=".62" />
              <ellipse className="ff-dash-flow ff-dash-down" cx="228" cy="221" rx="59" ry="176" pathLength="460" transform="rotate(-9 228 221)" stroke="#62EDFF" strokeWidth="2.35" strokeLinecap="round" strokeDasharray="4 42" opacity=".96" />
            </g>

            <g className="ff-orbit-vertical-up">
              <ellipse cx="228" cy="221" rx="51" ry="174" transform="rotate(19 228 221)" stroke="url(#ffOrbitGlowReverse)" strokeWidth="1.35" opacity=".58" />
              <ellipse className="ff-dash-flow ff-dash-up" cx="228" cy="221" rx="51" ry="174" pathLength="470" transform="rotate(19 228 221)" stroke="#C275FF" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="4 43" opacity=".94" />
            </g>
          </svg>

          <div className="ff-planet-system">
            <div className="ff-planet ff-planet--student">
              <div className="ff-planet-upright">
                <div className="ff-planet-visual">
                  <img className="ff-source-crop" src={iconSrc} alt="" draggable="false" />
                  <span className="ff-planet-glint" />
                </div>
              </div>
            </div>

            <div className="ff-planet ff-planet--teacher">
              <div className="ff-planet-upright">
                <div className="ff-planet-visual">
                  <img className="ff-source-crop" src={iconSrc} alt="" draggable="false" />
                  <span className="ff-planet-glint" />
                </div>
              </div>
            </div>

            <div className="ff-planet ff-planet--parent">
              <div className="ff-planet-upright">
                <div className="ff-planet-visual">
                  <img className="ff-source-crop" src={iconSrc} alt="" draggable="false" />
                  <span className="ff-planet-glint" />
                </div>
              </div>
            </div>
          </div>

          <div className="ff-core">
            <div className="ff-core-turn">
              <img className="ff-source-crop" src={iconSrc} alt="" draggable="false" />
              <span className="ff-crystal-shimmer" />
            </div>
          </div>
          <span className="ff-core-spark" />
        </div>

        <div className="ff-loader-status">
          <p className="ff-loader-brand">FOCUSFORGE AI</p>
          <div className="ff-loading-line">
            {message}
            <span className="ff-loading-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
