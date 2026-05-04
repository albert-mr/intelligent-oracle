interface StatusBadgeProps {
  status?: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status || "Unknown";
  const className = normalized === "Resolved"
    ? "bg-accent-soft text-accent"
    : normalized === "Error"
      ? "bg-danger-soft text-danger"
      : normalized === "PENDING"
        ? "bg-warning-soft text-amber-800"
        : "bg-highlight-soft text-highlight";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {normalized}
    </span>
  );
}
