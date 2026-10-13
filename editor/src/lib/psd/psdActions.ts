/**
 * PSD Open and Export Actions for UI and Menus.
 */

import { parsePsd, psdToCanvasObjects } from "./psdReader";
import { createPsd, renderObjectToCanvas, type LayerRenderSource } from "./psdWriter";
import { useStore } from "../../store/store";

/** Trigger file picker for .psd file and load into active canvas. */
export async function openPsdDialog(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".psd,.psb";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(false);
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        const decoded = parsePsd(buffer);
        const { objects, order } = psdToCanvasObjects(decoded);

        const s = useStore.getState();
        // Add decoded layers to current board
        const objectsList = order.map((id) => objects[id]).filter(Boolean);
        if (objectsList.length > 0) {
          s.addObjects(objectsList, false);
          s.setSelection(order);
          s.fitAll();
        }
        resolve(true);
      } catch (err) {
        console.error("Failed to parse PSD file:", err);
        alert(`Error opening PSD file: ${err instanceof Error ? err.message : String(err)}`);
        resolve(false);
      }
    };
    input.click();
  });
}

/** Export active canvas and layers into standard Adobe Photoshop PSD file. */
export async function exportCurrentToPsd(): Promise<void> {
  const doc = useStore.getState().doc;
  const layers: LayerRenderSource[] = [];

  // Render each layer to canvas
  for (const id of doc.order) {
    const obj = doc.objects[id];
    if (!obj || obj.hidden) continue;

    const canvas = await renderObjectToCanvas(obj, doc);
    layers.push({
      name: obj.name || obj.type,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      opacity: obj.opacity,
      blendMode: obj.style.blend || "normal",
      hidden: obj.hidden,
      clippingMask: obj.clippingMask ?? false,
      canvas,
    });
  }

  const docWidth = doc.settings.page?.width || 1920;
  const docHeight = doc.settings.page?.height || 1080;

  const psdBytes = await createPsd(docWidth, docHeight, layers);

  // Trigger download
  const blob = new Blob([psdBytes.buffer as ArrayBuffer], { type: "image/vnd.adobe.photoshop" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(doc.name || "flowcanvas").replace(/[^a-zA-Z0-9_-]/g, "_")}.psd`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
