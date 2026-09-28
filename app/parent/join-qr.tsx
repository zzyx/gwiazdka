import { encode } from "uqr";

// A QR code for the join page, drawn here on the server: no outside service
// sees the link, and the library never reaches the browser.
export function JoinQr({ url }: { url: string }) {
  const { data, size } = encode(url, { ecc: "M", border: 2 });
  let d = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code that opens the join page"
      className="size-28 shrink-0 rounded-lg border border-[#E5E7EB] bg-white"
    >
      <path d={d} fill="#111827" />
    </svg>
  );
}
