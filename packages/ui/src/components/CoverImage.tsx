/**
 * CoverImage — the issue's one full-bleed image (§1.5), 2px radius (§1.3).
 * v1 ships typographic covers (PLAN §8): with no `src` the block renders as a
 * --paper-2 field carrying the issue number — the only colour-free fallback.
 */
export function CoverImage({
  src,
  alt = "",
  aspect = "4:5",
  issueNo,
}: {
  src?: string;
  alt?: string;
  aspect?: "4:5" | "16:9";
  /** Shown on the typographic fallback when there is no image. */
  issueNo?: number;
}) {
  return (
    <figure
      className={`w-cover w-cover--${aspect.replace(":", "x")}`}
      data-empty={src ? undefined : true}
    >
      {src ? (
        // Package is Next-agnostic; V* routes may swap in next/image.
        <img className="w-cover__img" src={src} alt={alt} />
      ) : (
        <div className="w-cover__fallback" aria-hidden="true">
          {issueNo ? <span className="w-cover__no">№ {issueNo}</span> : null}
        </div>
      )}
    </figure>
  );
}
