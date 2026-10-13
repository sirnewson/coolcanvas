/**
 * Site templates — complete, filled-in section stacks. Loading one puts every
 * section in the queue with its copy already written, so it is a starting
 * point you edit, not a demo you look at.
 */
import type { SiteBrief, SiteSection, SiteState } from "../types";
import { uid } from "../lib/id";

export interface SiteTemplate {
  id: string;
  label: string;
  note: string;
  theme: string;
  brief: SiteBrief;
  sections: { id: string; content?: Record<string, string> }[];
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: "saas",
    label: "SaaS landing",
    note: "Header, split hero, feature grid, stats, pricing, FAQ, CTA, footer.",
    theme: "slate",
    brief: { brand: "Northwind", type: "SaaS product", offer: "Analytics that explain themselves", audience: "Product teams at growing startups", style: "Clean, confident, modern" },
    sections: [
      { id: "HDR_01", content: { brand_name: "Northwind", nav_links: "Product, Pricing, Docs, Blog", cta_label: "Start free" } },
      { id: "HERO_01", content: { headline: "Analytics that explain themselves.", subheadline: "Northwind turns raw events into plain-language answers your whole team can act on.", primary_cta: "Start free" } },
      { id: "TST_05", content: { section_title: "Trusted by teams at", logos: "Linear, Vercel, Notion, Loom, Pitch" } },
      { id: "FEAT_01", content: { section_title: "Why teams switch", feature_1: "⚡ · Instant answers · Ask in plain English, get a chart and the why.", feature_2: "🔒 · Private by design · Your data never trains anything.", feature_3: "🧩 · Fits your stack · Segment, Snowflake, Postgres in minutes." } },
      { id: "FEAT_06", content: { section_title: "Built for scale", stat_1: "2.4B events / day", stat_2: "99.99% uptime" } },
      { id: "PRC_01", content: { section_title: "Simple pricing", plan_1: "Starter · $0 · 1 project, 10k events", plan_2: "Growth · $49/mo · Unlimited projects, 5M events", plan_3: "Scale · Custom · SSO, audit log, SLA" } },
      { id: "FAQ_01", content: { section_title: "Questions, answered", faqs: "Q: Is there a free plan?\nA: Yes — Starter is free forever.\nQ: Can I self-host?\nA: Scale customers can deploy in their own cloud." } },
      { id: "CTA_02", content: { headline: "See your data explain itself", primary_cta: "Start free", secondary_cta: "Book a demo" } },
      { id: "FTR_01", content: { col_1_title: "Product: Features, Pricing, Changelog", copyright: "© 2026 Northwind" } },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    note: "Minimal header, typographic hero, gallery, featured quote, contact.",
    theme: "mono",
    brief: { brand: "Studio Oyelaran", type: "Portfolio / agency", offer: "Brand identity and editorial design", audience: "Founders and cultural institutions", style: "Bold, typographic, black and white" },
    sections: [
      { id: "HDR_02", content: { brand_name: "Oyelaran", nav_links: "Work, Studio, Journal, Contact" } },
      { id: "HERO_07", content: { headline: "WORK THAT\nLASTS.", subtext: "Identity, editorial and digital for people building things that matter.", cta_label: "See the work" } },
      { id: "GAL_01", content: { section_title: "Selected work", images: "Meridian Bank · Identity\nAfrica Nouveau · Editorial\nKola Press · Website\nLumen Hotels · Wayfinding" } },
      { id: "TST_02", content: { quote: "They understood the brand better than we did, then made it impossible to ignore.", attribution_name: "Tunde A.", attribution_role: "Founder, Meridian" } },
      { id: "FEAT_07", content: { section_title: "How we work", step_1: "Listen · A week of conversations before any design", step_2: "Shape · Three directions, one recommendation", step_3: "Make · Systems, files and a team that knows how to use them" } },
      { id: "CTA_01", content: { headline: "Have something worth making?", subtext: "We take on four projects a quarter.", cta_label: "Start a conversation" } },
      { id: "FTR_02", content: { col_groups: "Studio: Work, About, Journal", newsletter_headline: "Lagos · London — occasional letters" } },
    ],
  },
  {
    id: "hotel",
    label: "Hotel",
    note: "Overlay header, full-bleed hero, booking strip, gallery, reviews, FAQ.",
    theme: "forest",
    brief: { brand: "Kilima Lodge", type: "Hospitality / hotel", offer: "Twelve suites above the Rift Valley", audience: "Couples and small groups", style: "Warm, calm, photographic" },
    sections: [
      { id: "HDR_07", content: { brand_name: "Kilima Lodge", nav_links: "Suites, Dining, Experiences, Journal", cta_label: "Reserve" } },
      { id: "HERO_03", content: { headline: "Sleep above the valley.", subheadline: "Twelve suites, one ridge, no neighbours.", cta_label: "Check availability" } },
      { id: "CTA_04", content: { headline: "Plan your stay", form_fields: "Check-in, Check-out, Guests" } },
      { id: "GAL_02", content: { case_1: "The Ridge Suite · The pool at dusk · Breakfast terrace" } },
      { id: "TST_01", content: { section_title: "Guests say", quote_1: "'The quietest place we have ever stayed.' · Amara O.", quote_2: "'Staff remembered everything.' · Daniel K." } },
      { id: "FAQ_02", content: { tab_1_label: "Your stay", tab_1_faqs: "Q: Is breakfast included?\nA: Always, served until noon.\nQ: Do you host weddings?\nA: Up to forty guests, May to October." } },
      { id: "FTR_03", content: { links: "Suites, Dining, Experiences, Journal, Contact" } },
    ],
  },
  {
    id: "shop",
    label: "E-commerce",
    note: "Store navbar, search hero, product grid, trust badges, newsletter.",
    theme: "rose",
    brief: { brand: "Trendify", type: "E-commerce", offer: "Curated homeware from African makers", audience: "Design-minded shoppers", style: "Fresh, friendly, product-led" },
    sections: [
      { id: "HDR_09", content: { brand_name: "Trendify", search_ph: "Search ceramics, textiles, lighting…", cart_count: "2" } },
      { id: "HERO_05", content: { headline: "Find the piece that finishes the room.", search_placeholder: "What are you looking for?", popular_queries: "Ceramics, Linen, Rattan, Brass" } },
      { id: "GAL_03", content: { image_captions: "Bolga basket · $48\nRaffia pendant · $120\nHand-thrown mug · $22\nMud-cloth cushion · $65" } },
      { id: "TST_08", content: { badges: "Free returns\nSecure checkout\nCarbon-neutral shipping\nMade by hand" } },
      { id: "TST_04", content: { ticker_items: "Someone in Nairobi bought a Bolga basket\nNew maker: Lamu Weavers\n4.9★ from 2,300 reviews" } },
      { id: "CTA_03", content: { headline: "First order, 10% off", input_placeholder: "you@email.com", cta_label: "Subscribe" } },
      { id: "FTR_01", content: { col_1_title: "Shop: New, Makers, Gifts", copyright: "© 2026 Trendify" } },
    ],
  },
  {
    id: "agency",
    label: "Agency",
    note: "Pill nav, centered hero, marquee, case studies, process, contact form.",
    theme: "midnight",
    brief: { brand: "Halo", type: "Portfolio / agency", offer: "Growth design for software companies", audience: "Series A–C founders", style: "Dark, cinematic, sharp" },
    sections: [
      { id: "HDR_10", content: { brand_name: "Halo", nav_links: "Work, Services, About", cta_label: "Book a call" } },
      { id: "HERO_02", content: { headline: "Design that moves the number.", subheadline: "Landing pages, onboarding and pricing — measured, not guessed.", cta_label: "See results" } },
      { id: "FEAT_12", content: { marquee_text: "Conversion ++ Onboarding ++ Pricing pages ++ Design systems ++ Experiments ++" } },
      { id: "TST_06", content: { section_title: "Recent results", case_1: "Loop · +38% trial-to-paid in 6 weeks" } },
      { id: "FEAT_07", content: { section_title: "How it works", step_1: "Audit · Two weeks, one report, no fluff", step_2: "Sprint · Ship the top three fixes", step_3: "Measure · Read the numbers together" } },
      { id: "FRM_01", content: { section_title: "Tell us about the funnel", form_fields: "Name\nCompany\nWhere it leaks" } },
      { id: "FTR_02", content: { col_groups: "Halo: Work, Services, About", newsletter_headline: "Monthly notes on growth design" } },
    ],
  },
  {
    id: "app",
    label: "Mobile app",
    note: "Header, app-download hero, bento features, app store reviews, download CTA.",
    theme: "cream",
    brief: { brand: "Pesa", type: "Landing page", offer: "Budgeting that feels like a game", audience: "First-jobbers, 22–30", style: "Playful, bright, mobile-first" },
    sections: [
      { id: "HDR_01", content: { brand_name: "Pesa", nav_links: "Features, Stories, Help", cta_label: "Get the app" } },
      { id: "HERO_09", content: { headline: "Budgeting in your pocket.", subhead: "Join 2M+ people who finally know where the money went.", mockup_desc: "Phone showing a weekly budget ring" } },
      { id: "FEAT_10", content: { section_title: "Small habits, big numbers", box_1: "Weekly rings · See the week at a glance", box_2: "Round-ups · Save the change automatically", box_3: "Shared goals · Save with friends" } },
      { id: "TST_10", content: { review_1: "5 Stars · 'Finally stuck with a budget' · @amara" } },
      { id: "CTA_07", content: { headline: "Download Pesa today" } },
      { id: "FTR_02", content: { col_groups: "Pesa: Features, Stories, Help", newsletter_headline: "Money tips, once a week" } },
    ],
  },
];

export function siteFromTemplate(t: SiteTemplate): SiteState {
  return {
    brief: { ...t.brief },
    theme: t.theme,
    sections: t.sections.map((s) => ({ uid: uid("sec"), id: s.id, content: { ...(s.content ?? {}) } })),
  };
}

export function emptySite(): SiteState {
  return { brief: { brand: "", type: "", offer: "", audience: "", style: "" }, theme: "cream", sections: [] };
}

export function newSection(id: string): SiteSection {
  return { uid: uid("sec"), id, content: {} };
}
