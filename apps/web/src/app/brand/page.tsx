import type { Metadata } from "next";

import {
  colors,
  fonts,
  leading,
  Masthead,
  measure,
  motion,
  Rule,
  SectionHead,
  space,
  typeScale,
} from "@weekly/ui";

import { site } from "../../lib/site";

import "./brand.css";

export const metadata: Metadata = {
  title: `Brand — ${site.name}`,
  description:
    "The Weekly AI Edition brand: wordmark, colour tokens, type roles and the take/leave direction.",
};

const SWATCH_NAMES: Record<string, string> = {
  paper: "--paper",
  paper2: "--paper-2",
  ink: "--ink",
  ink2: "--ink-2",
  ink3: "--ink-3",
  rule: "--rule",
  accent: "--accent",
  up: "--up",
  down: "--down",
};

function SwatchGrid({ scheme }: { scheme: "light" | "dark" }) {
  return (
    <div className="v4-swatches">
      {Object.entries(colors[scheme]).map(([name, hex]) => (
        <div key={name} className="v4-swatch">
          <div className="v4-swatch__chip" style={{ background: hex }} />
          <p className="v4-swatch__name">{SWATCH_NAMES[name] ?? name}</p>
          <p className="v4-swatch__hex">{hex}</p>
        </div>
      ))}
    </div>
  );
}

const TYPE_ROLES = [
  {
    role: "Display / headlines",
    face: "Inter Tight",
    var: "--font-display",
    css: fonts.display,
    note: "weight 600 · tracking −0.02em to −0.04em",
    sample: "A newspaper made by people who care",
  },
  {
    role: "Text / UI",
    face: "Inter",
    var: "--font-text",
    css: fonts.text,
    note: "weight 400/500 · tracking 0",
    sample: "Everything that mattered in AI this week, and an italic take.",
  },
  {
    role: "Data / mono",
    face: "Geist Mono",
    var: "--font-mono",
    css: fonts.mono,
    note: "tickers · amounts · dates · agent links",
    sample: "NVDA 192.44 +3.4% · 2026-10-31",
  },
] as const;

const DIRECTION = [
  {
    ref: "distribute.software",
    take: "Data density handled calmly; the Tech Index (rank, logo, count, trend arrow); red kicker for “top”",
    leave: "Calendar grid, dashboard chrome, three-column everything",
  },
  {
    ref: "Enfold Studio",
    take: "Oversized headline type bleeding to the edges; confident scale jumps; muted photography",
    leave: "Agency tone, logo wall",
  },
  {
    ref: "A17.2",
    take: "Whitespace as structure; image-first grid with caption-sized type under it; hairline-thin nav",
    leave: "Portfolio sparseness (we carry more items per page)",
  },
  {
    ref: "Gega “Art Magazine”",
    take: "Full-width ruled grid; cards defined by rules not shadows; pill category labels; uppercase masthead",
    leave: "Card thumbnails on every item",
  },
  {
    ref: "The Fox Newspaper",
    take: "Masthead + tagline + date line; section heads as heavy display type with a rule; column structure; the “Latest” red",
    leave: "Victorian density, serif body, photo on everything",
  },
] as const;

const RULES = [
  "Accent appears at most once per viewport — kicker, “Latest”, the cover’s issue number. Never on buttons, never as a background.",
  "Up/down colours only next to a number.",
  "Hairlines separate; they never box. No shadows, no gradients on UI, radius 0 outside pills and images.",
  "Masthead is the wordmark — Inter Tight 700 uppercase; no logo mark in v1.",
  "Type carries the pages; images are the only colour — generated abstract covers, never stock photos of robots.",
  "Motion is 240ms translate-only; nothing fades, nothing parallaxes.",
] as const;

/**
 * `/brand` — the brand page (PLAN §4): wordmark, colour tokens with hex, the
 * type specimen, and the §0 take/leave direction — rendered to the spec it
 * describes. All visual values come from @weekly/ui tokens; hexes are the
 * token values themselves, printed from `colors`.
 */
export default function BrandPage() {
  return (
    <main className="v4-brand">
      <Masthead variant="band" siteName={site.name} tagline={site.tagline} />

      <section className="v4-brand-block">
        <SectionHead title="Wordmark" />
        <p className="v4-brand-note">
          No logo mark in v1 — the wordmark is the brand (DESIGN §1.2, §7.2).
          Inter Tight 700, uppercase, tracking −0.03em at hero size, +0.08em at
          nav size.
        </p>
        <p className="v4-wordmark">{site.name}</p>
        <p className="v4-wordmark--nav">{site.name}</p>
      </section>

      <section className="v4-brand-block">
        <SectionHead title="Colour" />
        <p className="v4-brand-note">
          Warm paper ground, near-black ink, one red accent. Dark scheme via
          prefers-color-scheme; every value below is the token itself.
        </p>
        <div className="v4-schemes">
          <div>
            <p className="v4-scheme-name">Light</p>
            <SwatchGrid scheme="light" />
          </div>
          <div className="w-dark">
            <p className="v4-scheme-name">Dark</p>
            <SwatchGrid scheme="dark" />
          </div>
        </div>
      </section>

      <section className="v4-brand-block">
        <SectionHead title="Type" />
        <p className="v4-brand-note">
          Two families, three roles (§1.2). Self-hosted, subset,
          font-display: swap — no external CDN at runtime.
        </p>
        <div className="v4-type">
          {TYPE_ROLES.map((r) => (
            <div key={r.var} className="v4-type-row">
              <div className="v4-type-meta">
                <p className="v4-type-face">{r.face}</p>
                <p className="v4-type-role">
                  {r.role} · <code>{r.var}</code>
                </p>
                <p className="v4-type-stack">{r.css}</p>
                <p className="v4-type-note">{r.note}</p>
              </div>
              <p
                className="v4-type-sample"
                style={{
                  fontFamily: `var(${r.var})`,
                  fontSize:
                    r.var === "--font-display"
                      ? "var(--t-xl)"
                      : "var(--t-base)",
                }}
              >
                {r.sample}
              </p>
            </div>
          ))}
        </div>
        <p className="v4-brand-note">Scale — clamp across 390px → 1280px.</p>
        <div className="v4-scale">
          {(Object.entries(typeScale) as [string, { min: number; max: number }][]).map(
            ([name, v]) => (
              <div key={name} className="v4-scale-row">
                <code className="v4-scale-token">
                  --{name}
                  <span>
                    {v.min}–{v.max}rem
                  </span>
                </code>
                <span
                  className="v4-scale-sample"
                  style={{ fontSize: `var(--${name})` }}
                >
                  The weekly AI edition
                </span>
              </div>
            ),
          )}
        </div>
        <p className="v4-brand-note">
          Line-height — display {leading.display} · text {leading.text} · mono{" "}
          {leading.mono}. Measure — {measure.body} body, {measure.display}{" "}
          display.
        </p>
      </section>

      <section className="v4-brand-block">
        <SectionHead title="Space &amp; motion" />
        <div className="v4-space">
          {space.map((s) => (
            <div key={s} className="v4-space-row">
              <code className="v4-space-token">{s}</code>
              <div
                className="v4-space-bar"
                style={{ width: `var(--space-${s})` }}
              />
            </div>
          ))}
        </div>
        <p className="v4-brand-note">
          Motion — page {motion.pageMs}ms {motion.pageEase} · fill{" "}
          {motion.fillMs}ms linear · hover {motion.hoverMs}ms. Translate only;
          reduced-motion cuts to instant.
        </p>
      </section>

      <section className="v4-brand-block">
        <SectionHead title="Direction — take / leave" />
        <p className="v4-brand-note">
          “Broadsheet, redrawn” (§0). A newspaper’s structure with the
          restraint of a design studio site — each reference contributes only
          this:
        </p>
        <div className="v4-direction">
          <div className="v4-direction-head">
            <span>Ref</span>
            <span>Take</span>
            <span>Leave</span>
          </div>
          {DIRECTION.map((d) => (
            <div key={d.ref} className="v4-direction-row">
              <span className="v4-direction-ref">{d.ref}</span>
              <span>{d.take}</span>
              <span className="v4-direction-leave">{d.leave}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="v4-brand-block">
        <SectionHead title="Rules" />
        <ul className="v4-rules">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <Rule weight="hairline" />
      <p className="v4-brand-foot">
        {site.name} · brand page · designed to the spec it describes
      </p>
    </main>
  );
}
