// Artwork shared by the generated app icons: a yellow star on sky blue.
export function StarIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#7dd3fc",
      }}
    >
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24">
        <path
          fill="#facc15"
          stroke="#ca8a04"
          strokeWidth="1"
          strokeLinejoin="round"
          d="M12 2l2.9 6.26 6.85.72-5.12 4.6 1.45 6.74L12 16.9l-6.08 3.42 1.45-6.74-5.12-4.6 6.85-.72z"
        />
      </svg>
    </div>
  );
}
