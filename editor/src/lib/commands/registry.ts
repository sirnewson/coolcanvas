/**
 * FlowCanvas Engine Command Registry.
 * Inspired by Photocraft's central command registry (`crates/engine` & `crates/automation`).
 * Every tool, menu item, CLI script, and MCP server invokes actions through this registry.
 */

import { useStore } from "../../store/store";
import type { CanvasObject, AdjustmentType } from "../../types";
import { defaultParamsFor } from "../adjustments";

export interface CommandDefinition {
  id: string;
  label: string;
  category: "document" | "layer" | "adjustment" | "filter" | "edit" | "view";
  description: string;
  run: (params?: any) => Promise<any> | any;
}

const commands = new Map<string, CommandDefinition>();

export function registerCommand(cmd: CommandDefinition) {
  commands.set(cmd.id, cmd);
}

export function getCommand(id: string): CommandDefinition | undefined {
  return commands.get(id);
}

export function listCommands(): CommandDefinition[] {
  return Array.from(commands.values());
}

export async function executeCommand(id: string, params: any = {}): Promise<any> {
  const cmd = commands.get(id);
  if (!cmd) {
    throw new Error(`Unknown command '${id}'. Use listCommands() to inspect available commands.`);
  }
  return await cmd.run(params);
}

// ---------------------------------------------------------------------------
// Standard Engine Commands Built-in Registry
// ---------------------------------------------------------------------------

// 1. Document Commands
registerCommand({
  id: "document.info",
  label: "Document Info",
  category: "document",
  description: "Get active document metadata and layer hierarchy",
  run: () => {
    const s = useStore.getState();
    return {
      id: s.doc.id,
      name: s.doc.name,
      layerCount: s.doc.order.length,
      layers: s.doc.order.map((id) => {
        const o = s.doc.objects[id];
        return {
          id: o.id,
          name: o.name ?? o.type,
          type: o.type,
          hidden: o.hidden,
          opacity: o.opacity,
          clippingMask: o.clippingMask,
          blend: o.style.blend,
        };
      }),
      settings: s.doc.settings,
    };
  },
});

registerCommand({
  id: "document.new",
  label: "New Document",
  category: "document",
  description: "Create a new board or document",
  run: (params) => {
    useStore.getState().newBoard();
    if (params?.name) {
      useStore.getState().setBoardName(params.name);
    }
    return { status: "ok" };
  },
});

// 2. Layer Commands
registerCommand({
  id: "layer.newAdjustment",
  label: "New Adjustment Layer",
  category: "layer",
  description: "Create a non-destructive adjustment layer",
  run: (params) => {
    const type: AdjustmentType = params?.type || "curves";
    const name = params?.name || `Adjustment (${type})`;
    const s = useStore.getState();
    const id = `adj_${Date.now()}`;
    const obj: CanvasObject = {
      id,
      type: "adjustment",
      name,
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      rotation: 0,
      opacity: params?.opacity ?? 1,
      locked: false,
      hidden: false,
      clippingMask: params?.clippingMask ?? false,
      style: {
        blend: params?.blend ?? "normal",
      },
      data: {
        adjustmentType: type,
        adjustmentParams: params?.params || defaultParamsFor(type),
      },
    };
    s.addObjects([obj]);
    s.setSelection([id]);
    return { id, status: "created" };
  },
});

registerCommand({
  id: "layer.newGroup",
  label: "New Group",
  category: "layer",
  description: "Create a group folder or group selected layers",
  run: (params) => {
    const s = useStore.getState();
    const selection = s.selection;
    if (selection.length > 0) {
      s.group();
      return { status: "grouped", count: selection.length };
    }
    const id = `grp_${Date.now()}`;
    const group: CanvasObject = {
      id,
      type: "group",
      name: params?.name || "Group",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      style: {},
      data: { children: [] },
    };
    s.addObjects([group]);
    s.setSelection([id]);
    return { id, status: "created" };
  },
});

registerCommand({
  id: "layer.duplicate",
  label: "Duplicate Layer",
  category: "layer",
  description: "Duplicate selected layer(s)",
  run: () => {
    useStore.getState().duplicateSelection();
    return { status: "duplicated" };
  },
});

registerCommand({
  id: "layer.delete",
  label: "Delete Layer",
  category: "layer",
  description: "Delete selected layer(s)",
  run: () => {
    useStore.getState().deleteSelection();
    return { status: "deleted" };
  },
});

registerCommand({
  id: "layer.setBlendMode",
  label: "Set Blend Mode",
  category: "layer",
  description: "Set blend mode for active selection",
  run: (params) => {
    const mode = params?.mode || "normal";
    const s = useStore.getState();
    for (const id of s.selection) {
      s.patchObject(id, { style: { ...s.doc.objects[id]?.style, blend: mode } });
    }
    return { status: "ok", blendMode: mode };
  },
});

registerCommand({
  id: "layer.setOpacity",
  label: "Set Opacity",
  category: "layer",
  description: "Set layer opacity (0..1)",
  run: (params) => {
    const op = Math.max(0, Math.min(1, params?.opacity ?? 1));
    const s = useStore.getState();
    for (const id of s.selection) {
      s.patchObject(id, { opacity: op });
    }
    return { status: "ok", opacity: op };
  },
});

registerCommand({
  id: "layer.setFillOpacity",
  label: "Set Fill Opacity",
  category: "layer",
  description: "Set layer fill opacity (0..1)",
  run: (params) => {
    const fillOp = Math.max(0, Math.min(1, params?.fillOpacity ?? 1));
    const s = useStore.getState();
    for (const id of s.selection) {
      s.patchObject(id, { fillOpacity: fillOp });
    }
    return { status: "ok", fillOpacity: fillOp };
  },
});

registerCommand({
  id: "layer.toggleClipping",
  label: "Toggle Clipping Mask",
  category: "layer",
  description: "Toggle clipping mask to the underlying layer",
  run: () => {
    const s = useStore.getState();
    for (const id of s.selection) {
      const cur = s.doc.objects[id]?.clippingMask ?? false;
      s.patchObject(id, { clippingMask: !cur });
    }
    return { status: "toggled" };
  },
});

registerCommand({
  id: "layer.addMask",
  label: "Add Layer Mask",
  category: "layer",
  description: "Add a reveal-all layer mask",
  run: () => {
    const s = useStore.getState();
    for (const id of s.selection) {
      s.patchObject(id, {
        mask: {
          type: "pixel",
          density: 1.0,
          feather: 0,
          inverted: false,
          enabled: true,
        },
      });
    }
    return { status: "mask_added" };
  },
});

registerCommand({
  id: "layer.deleteMask",
  label: "Delete Layer Mask",
  category: "layer",
  description: "Remove layer mask from selected object(s)",
  run: () => {
    const s = useStore.getState();
    for (const id of s.selection) {
      s.patchObject(id, { mask: undefined });
    }
    return { status: "mask_deleted" };
  },
});

registerCommand({
  id: "layer.convertToSmartObject",
  label: "Convert to Smart Object",
  category: "layer",
  description: "Encapsulate layer into a non-destructive Smart Object",
  run: () => {
    const s = useStore.getState();
    const sel = s.selection;
    if (sel.length === 0) return { status: "no_selection" };
    const firstId = sel[0];
    const obj = s.doc.objects[firstId];
    if (!obj) return { status: "not_found" };

    const smartObj: CanvasObject = {
      ...obj,
      type: "smart",
      name: `${obj.name || obj.type} (Smart Object)`,
      data: {
        ...obj.data,
        smartObject: {
          src: obj.data.src,
          width: obj.width,
          height: obj.height,
          smartFilters: [],
        },
      },
    };
    s.patchObject(firstId, smartObj);
    return { status: "converted_to_smart_object", id: firstId };
  },
});

registerCommand({
  id: "layer.rasterize",
  label: "Rasterize Layer",
  category: "layer",
  description: "Rasterize vector, text or smart object into pixel bitmap",
  run: () => {
    const s = useStore.getState();
    for (const id of s.selection) {
      const obj = s.doc.objects[id];
      if (obj && (obj.type === "smart" || obj.type === "vector" || obj.type === "text")) {
        s.patchObject(id, { type: "image" });
      }
    }
    return { status: "rasterized" };
  },
});

// 3. View Commands
registerCommand({
  id: "view.fitOnScreen",
  label: "Fit on Screen",
  category: "view",
  description: "Zoom to fit the canvas or objects on screen",
  run: () => {
    useStore.getState().fitAll();
    return { status: "ok" };
  },
});

registerCommand({
  id: "view.zoomIn",
  label: "Zoom In",
  category: "view",
  description: "Zoom in closer",
  run: () => {
    const s = useStore.getState();
    s.setZoom(s.camera.zoom * 1.25);
    return { status: "ok" };
  },
});

registerCommand({
  id: "view.zoomOut",
  label: "Zoom Out",
  category: "view",
  description: "Zoom out further",
  run: () => {
    const s = useStore.getState();
    s.setZoom(s.camera.zoom * 0.8);
    return { status: "ok" };
  },
});
