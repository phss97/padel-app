export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <div className="flex items-center justify-center">
      <div className={`animate-spin rounded-full ${sizeClass} border-b-2 border-primary`} />
    </div>
  );
}
