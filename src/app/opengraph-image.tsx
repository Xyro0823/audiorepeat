import { ImageResponse } from "next/og";

export const alt = "AudioRepeat hands-free language practice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#080b12",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "radial-gradient(circle, rgba(6,182,212,0.32) 0%, rgba(8,11,18,0) 70%)",
            display: "flex",
            height: 760,
            position: "absolute",
            right: -180,
            top: -300,
            width: 760,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", padding: "72px 88px", width: "100%" }}>
          <div style={{ alignItems: "center", display: "flex", fontSize: 30, fontWeight: 800 }}>
            <div
              style={{
                alignItems: "center",
                background: "linear-gradient(135deg, #06b6d4, #2563eb)",
                borderRadius: 18,
                display: "flex",
                height: 56,
                justifyContent: "center",
                marginRight: 18,
                width: 56,
              }}
            >
              ▶
            </div>
            Audio<span style={{ color: "#22d3ee" }}>Repeat</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 72, maxWidth: 920 }}>
            <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>
              Master vocabulary with hands-free audio repeat.
            </div>
            <div style={{ color: "#94a3b8", fontSize: 28, lineHeight: 1.45, marginTop: 30 }}>
              Device speech voices · Spaced repetition · Offline-ready practice
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
