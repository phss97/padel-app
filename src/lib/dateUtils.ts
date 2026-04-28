export function formatMatchDate(date: Date | string, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatMatchLongDate(date: Date | string, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMatchTime(date: Date | string, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const isPt = locale?.toLowerCase().startsWith("pt");
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: !isPt });
}

export function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

export function toTimeInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toTimeString().slice(0, 5);
}
