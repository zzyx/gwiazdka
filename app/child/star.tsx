// A rounded five-point Star with a navy outline.
export function Star({ className = "", fill = "#FFC93C" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`inline-block ${className}`}>
      <path
        d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
        fill={fill}
        stroke="#1E2A5A"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
