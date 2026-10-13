/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SectionCategory = 
  | "header" | "hero" | "features" | "proof" | "cta" | "pricing" | "faq" | "forms" | "gallery" | "footer";

export interface ContentField {
  key: string;
  label: string;
  type: "text" | "textarea";
  ph: string;
}

export interface SectionDefinition {
  id: string;
  cat: SectionCategory;
  name: string;
  purpose: string;
  layout: string;
  visual: string[];
  behavior: string[];
  components: string[];
  fits: string[];
  contentFields: ContentField[];
}

export interface SiteBlueprint {
  brandName: string;
  offer: string;
  audience: string;
  goal: string;
  style: string[];
  siteType: string;
  pages: {
    name: string;
    sections: string[]; // List of Section IDs
  }[];
}
