/**
 * V3 OG renderer — `next/og` ImageResponse at 1200×630 (DESIGN §1.5.5).
 *
 * Satori renders inline styles only, so `OgCard`'s `.w-og` CSS classes can't
 * apply here; this mirrors the same markup — paper ground, masthead, page
 * kicker, headline, section rule — with every value derived from the
 * `@weekly/ui` tokens (colours, type scale, leading, space, measure).
 *
 * Fonts: Satori wants static TTF/OTF/WOFF, but the repo ships variable
 * woff2. The three faces below are instanced + subsetted (latin + № · — →)
 * from `public/fonts` via fontTools `varLib.instancer`/`pyftsubset`, and live
 * under `src/` so Vercel's file tracing ships them inside the function.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import { colors, fonts, leading, typeScale } from "@weekly/ui";

export const OG_SIZE = { width: 1200, height: 630 } as const;

const FONT_DIR = path.join(process.cwd(), "src", "fonts", "og");

let fontCache: Promise<[Buffer, Buffer, Buffer]> | undefined;
function loadFonts() {
  fontCache ??= Promise.all([
    readFile(path.join(FONT_DIR, "inter-tight-600.ttf")),
    readFile(path.join(FONT_DIR, "inter-tight-700.ttf")),
    readFile(path.join(FONT_DIR, "inter-500.ttf")),
  ]) as Promise<[Buffer, Buffer, Buffer]>;
  return fontCache;
}

const c = colors.light;
const rem = 16;
/** rem size at the wide end of the token's clamp range, in px. */
const px = (t: keyof typeof typeScale) => typeScale[t].max * rem;
/** First family of a token stack — the name `fonts[]` is registered under. */
const family = (stack: string) => stack.split(",")[0]?.replace(/"/g, "") ?? "";

export async function ogImageResponse({
  siteName,
  kicker,
  headline,
}: {
  siteName: string;
  kicker: string;
  headline: string;
}): Promise<ImageResponse> {
  const [display600, display700, text500] = await loadFonts();
  // Long headlines (the Briefing's lead sentence) step down a size and shed
  // the display measure so they stay on the card.
  const long = headline.length > 90;
  const headlinePx = long ? px("t-xl") : px("t-2xl");
  // 28ch ≈ 14em — the measure-display token in px for the chosen size.
  const measure = Math.round(14 * headlinePx);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: c.paper,
          color: c.ink,
          padding: 64, // --space-64
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: family(fonts.display),
            fontSize: px("t-lg"),
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {siteName}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: family(fonts.text),
              fontSize: px("t-xs"),
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: c.ink2,
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 16, // --space-16
              fontFamily: family(fonts.display),
              fontSize: headlinePx,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: leading.display,
              maxWidth: long ? "100%" : measure,
              lineClamp: 4,
            }}
          >
            {headline}
          </div>
        </div>
        <div style={{ display: "flex", borderTop: `2px solid ${c.ink}` }} />
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: family(fonts.display), data: display600, weight: 600 },
        { name: family(fonts.display), data: display700, weight: 700 },
        { name: family(fonts.text), data: text500, weight: 500 },
      ],
    },
  );
}
