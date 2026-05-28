/**
 * Calm, ambient backdrop for the resume UI.
 *
 * Two layers of motion, both deliberately slow (20–40s loops) so they read
 * as "atmosphere" rather than animation:
 *   1. Pastel blue + violet blobs that drift in opposite directions.
 *   2. A horizontally-tiled SVG wave band that scrolls gently sideways.
 *
 * Both layers respect `prefers-reduced-motion: reduce` via globals.css.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Base wash — calm white with a barely-there blue-purple tint. */}
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#FBFAF8_0%,#F4F7FE_45%,#F3EFFD_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(191,208,255,0.18),_transparent_28%)]" />

      {/* Drifting pastel blobs. The blur + low opacity gives them a glow feel. */}
      <div
        className="blob bg-sky-soft animate-drift"
        style={{ width: 620, height: 620, top: "-10%", left: "-8%" }}
      />
      <div
        className="blob bg-violet-soft animate-drift-slow"
        style={{ width: 580, height: 580, bottom: "-12%", right: "-6%", opacity: 0.5 }}
      />
      <div
        className="blob animate-drift"
        style={{
          width: 380,
          height: 380,
          top: "40%",
          right: "20%",
          background:
            "radial-gradient(circle, rgba(184,199,245,0.45) 0%, rgba(200,182,240,0.25) 60%, transparent 100%)",
          opacity: 0.7,
          animationDelay: "-7s",
        }}
      />
      <div
        className="blob animate-drift-slow"
        style={{
          width: 180,
          height: 180,
          top: "14%",
          right: "12%",
          background:
            "radial-gradient(circle, rgba(211,196,245,0.72) 0%, rgba(211,196,245,0.18) 55%, transparent 100%)",
          opacity: 0.55,
          animationDelay: "-4s",
        }}
      />
      <div
        className="blob animate-drift"
        style={{
          width: 220,
          height: 220,
          bottom: "18%",
          left: "14%",
          background:
            "radial-gradient(circle, rgba(194,208,255,0.55) 0%, rgba(194,208,255,0.16) 60%, transparent 100%)",
          opacity: 0.45,
          animationDelay: "-10s",
        }}
      />
      <div
        className="blob animate-drift-slow"
        style={{
          width: 140,
          height: 140,
          top: "32%",
          left: "38%",
          background:
            "radial-gradient(circle, rgba(208,188,246,0.6) 0%, rgba(208,188,246,0.12) 62%, transparent 100%)",
          opacity: 0.4,
          animationDelay: "-15s",
        }}
      />
      <div
        className="blob animate-drift"
        style={{
          width: 260,
          height: 260,
          bottom: "8%",
          right: "26%",
          background:
            "radial-gradient(circle, rgba(182,195,245,0.42) 0%, rgba(204,184,245,0.18) 58%, transparent 100%)",
          opacity: 0.35,
          animationDelay: "-18s",
        }}
      />

      {/* Soft SVG wave band — repeats horizontally and drifts left forever. */}
      <div className="absolute inset-x-0 bottom-[24%] h-44 opacity-[0.22]">
        <div
          className="wave-band absolute inset-0 animate-wave-drift"
          style={{
            width: "220%",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 180' preserveAspectRatio='none'><path d='M0,96 C240,160 480,28 720,92 C960,156 1200,28 1440,96 L1440,180 L0,180 Z' fill='%23BFD0FF' opacity='0.62'/><path d='M0,118 C240,58 480,176 720,118 C960,58 1200,176 1440,118 L1440,180 L0,180 Z' fill='%23D2C2F5' opacity='0.48'/></svg>\")",
            backgroundRepeat: "repeat-x",
            backgroundSize: "55% 100%",
          }}
        />
      </div>

      {/* A whisper of vignette so the corners feel held, not loud. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 48%, rgba(30,34,56,0.05) 100%)",
        }}
      />
    </div>
  );
}
