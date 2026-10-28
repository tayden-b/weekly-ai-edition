import { Kicker } from "./Kicker";

/**
 * OgCard — the OG image template (§1.5): paper ground, masthead, page kicker,
 * headline. 1200×630; rendered scaled-down in the kitchen sink, rasterized by
 * V3's OG route.
 */
export function OgCard({
  siteName,
  kicker,
  headline,
}: {
  siteName: string;
  kicker: string;
  headline: string;
}) {
  return (
    <div className="w-og" role="img" aria-label={`${kicker}: ${headline}`}>
      <p className="w-og__wordmark">{siteName}</p>
      <div className="w-og__body">
        <Kicker>{kicker}</Kicker>
        <p className="w-og__headline">{headline}</p>
      </div>
      <hr className="w-rule w-rule--section" />
    </div>
  );
}
