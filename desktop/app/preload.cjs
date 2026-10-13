/*
 * The only bridge between the window and the desktop. Everything crosses through
 * these named channels; the page never gets Node.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onMaximizeChange: (cb) => {
    const handler = (_e, value) => cb(!!value);
    ipcRenderer.on("window:maximized", handler);
    return () => ipcRenderer.off("window:maximized", handler);
  },
  openFile: (filters) => ipcRenderer.invoke("file:open", filters),
  saveFile: (name, data) => ipcRenderer.invoke("file:save", name, data),
  openStudio: (studio, png) => ipcRenderer.invoke("studio:open", studio, png),
  studiosInstalled: () => ipcRenderer.invoke("studio:installed"),
  onStudioResult: (cb) => {
    const handler = (_e, file) => cb(file);
    ipcRenderer.on("studio:result", handler);
    return () => ipcRenderer.off("studio:result", handler);
  },
  platform: process.platform,
  version: process.versions.electron,
});
