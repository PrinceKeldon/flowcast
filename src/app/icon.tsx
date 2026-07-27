import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#12131A",
          borderRadius: 6,
        }}
      >
        <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#E8A33D" }}>K</div>
      </div>
    ),
    size
  );
}
