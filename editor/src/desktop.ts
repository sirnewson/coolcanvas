/**
 * The bridge to the desktop shell. In the browser none of this exists, so every
 * call degrades to something sensible and the app stays usable either way.
 */

export interface DesktopBridge {
  minimize(): void;
  maximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(cb: (max: boolean) => void): () => void;
  openFile(filters: { name: string; extensions: string[] }[]): Promise<{ name: string; data: ArrayBuffer } | null>;
  saveFile(name: string, data: ArrayBuffer | string): Promise<string | null>;
  /** Opens an installed native studio in its own window, optionally with a picture to edit. */
  openStudio?(studio: "photo" | "vector", png?: ArrayBuffer): Promise<boolean>;
  /** Fires when a native studio saves a file CoolCanvas can bring back. */
  onStudioResult?(cb: (file: { studio: string; name: string; type: string; bytes: ArrayBuffer }) => void): () => void;
  platform: string;
  version: string;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const desktop = (): DesktopBridge | null => (typeof window !== "undefined" ? window.desktop ?? null : null);

export const isDesktop = () => !!desktop();

/** True when the OS window is drawn by us rather than by the browser. */
export const hasCustomChrome = () => isDesktop();

export const APP = {
  name: "CoolSketch",
  tagline: "Draw in 3D",
  author: "Sir Newson",
  company: "YXM Digital",
  site: "yxmdigital.com",
  siteUrl: "https://yxmdigital.com",
} as const;
