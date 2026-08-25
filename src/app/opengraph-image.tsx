import { ImageResponse } from "next/og";

export const alt = "Hire Packet — evidence-backed job fit";
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
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, #050a08 0%, #07110c 55%, #030605 100%)",
          color: "#edf4ef",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(180deg, #1aa36c, #0b4d33)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 18,
                height: 20,
                borderRadius: 2,
                background: "#f4fbf7",
                display: "flex",
                overflow: "hidden",
              }}
            >
              <div style={{ width: 4, height: 20, background: "#0b4d33" }} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Hire Packet</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 58, lineHeight: 1.02, fontWeight: 700, maxWidth: 980 }}>
            See who fits the job.
            <br />
            See the proof.
          </div>
          <div style={{ marginTop: 22, fontSize: 24, color: "rgba(237,244,239,0.62)" }}>
            Scores in code. Evidence on every strong match. You shortlist.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, color: "rgba(237,244,239,0.45)" }}>
          <span>Recruiter software · not an ATS</span>
          <span>No auto-reject</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
