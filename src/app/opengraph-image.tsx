import { ImageResponse } from "next/og";

export const alt = "Hire Packet — Rithvik Velapati";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#121814",
          padding: 48,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#e7e2d4",
            color: "#141c17",
            padding: 56,
          }}
        >
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 6, textTransform: "uppercase", color: "#1a6b45" }}>
            Hire Packet · Verified resume
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 62, lineHeight: 0.95, fontWeight: 700, maxWidth: 920 }}>
              Paste a job. Leave with proof.
            </div>
            <div style={{ marginTop: 20, fontSize: 24, color: "#5c685f" }}>
              Evidence · explainable score · honest gaps
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22 }}>Rithvik Reddy Velapati</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
