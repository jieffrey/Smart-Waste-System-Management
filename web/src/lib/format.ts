// Dates are shown in the same time zone the backend counts in.
export const TIME_ZONE = "Asia/Jakarta";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

// "2026-11-04T03:15:00Z" -> "4 Nov 2026, 10:15" (Jakarta time)
export function formatDateTime(iso: string) {
  return dateTimeFormat.format(new Date(iso));
}

// "2026-11-04T20:15:00Z" -> "5 Nov 2026" (the date in Jakarta)
export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

// "2026-11-04" (a calendar date, no time zone) -> "Wed, 4 Nov 2026"
export function formatDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return dayFormat.format(new Date(Date.UTC(year, month - 1, day)));
}

// 0.8571 -> "85.7%"
export function formatPercent(ratio: number) {
  return `${(ratio * 100).toFixed(1)}%`;
}
