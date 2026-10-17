import { ImageResponse } from "next/og";

export const alt = "PayPing — Get paid. Don't chase.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "70px 78px",
        background: "linear-gradient(135deg, #07110e 0%, #0c2f26 55%, #11553f 100%)",
        color: "#ffffff",
        fontFamily: "Georgia, serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", right: -70, top: -155, width: 560, height: 560, border: "1px solid rgba(25,196,138,0.22)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 355, height: 355, border: "1px solid rgba(25,196,138,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 124, height: 124, border: "2px solid rgba(25,196,138,0.85)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#19c48a", fontSize: 58 }}>•</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Arial, sans-serif", fontSize: 24, letterSpacing: "-1px" }}>
        <span style={{ width: 30, height: 30, border: "2px solid #19c48a", borderRadius: "50%" }} />
        <strong>payping</strong>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 850 }}>
        <div style={{ fontSize: 102, lineHeight: 0.92, letterSpacing: "-5px" }}>Get paid.</div>
        <div style={{ fontSize: 102, lineHeight: 0.92, letterSpacing: "-5px", fontStyle: "italic" }}>Don’t chase.</div>
        <div style={{ marginTop: 12, fontFamily: "Arial, sans-serif", color: "#d2e0da", fontSize: 25, lineHeight: 1.4, maxWidth: 730 }}>
          Polite invoice reminders that stop when your client pays.
        </div>
      </div>
      <div style={{ fontFamily: "Arial, sans-serif", color: "#a6c7b9", fontSize: 17, letterSpacing: "2px" }}>A CALMER WAY TO COLLECT</div>
    </div>,
    { ...size },
  );
}
