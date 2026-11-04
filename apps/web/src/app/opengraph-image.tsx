import { ImageResponse } from "next/og";

export const alt = "Gearboxe vehicle marketplace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#101d32", color: "#ffffff", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 36, color: "#9dc6f0", marginBottom: 44 }}>GEARBOXE</div>
      <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>Your next vehicle.<br />Your local marketplace.</div>
      <div style={{ display: "flex", fontSize: 30, marginTop: 44, color: "#cbd5e1" }}>Discover vehicles. Connect with sellers.</div>
    </div>, size,
  );
}
