const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 640,
    icon: path.join(__dirname, "icon.png"), // optional — apna icon.png yahan daal dena
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#0b0b14", // app ke dark theme se match, white-flash avoid karta hai
    show: false,
  });

  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(FRONTEND_DIST, "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});