import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kilig — find your next obsession";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundImage: "linear-gradient(135deg, #12131A 0%, #2a1c30 50%, #3a1a24 100%)",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: "#E8A33D" }}>
          KILIG
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            color: "#F1EEE6",
            textTransform: "uppercase",
            lineHeight: 1.05,
            marginTop: 20,
            maxWidth: 980,
          }}
        >
          Find your next obsession
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#8B8D98", marginTop: 24 }}>
          Discover vertical drama by mood and trope
        </div>
      </div>
    ),
    size
  );
}
