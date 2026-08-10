import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme, getStoredTheme } from "./utils/theme";

// ---------------------------------------------------------
// main.jsx
// Entry point — mounts the App component into index.html's
// <div id="root"></div>
// ---------------------------------------------------------

applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
