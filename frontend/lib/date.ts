import { format, isToday, parseISO } from "date-fns";

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "–";
  try {
    return format(parseISO(value), "dd MMM yyyy");
  } catch {
    return value;
  }
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "–";
  try {
    return format(parseISO(value), "dd MMM yyyy HH:mm");
  } catch {
    return value;
  }
}

export function dayLabel(value: string): string {
  try {
    const d = parseISO(value);
    if (isToday(d)) return "Today";
    return format(d, "dd MMM yyyy");
  } catch {
    return value;
  }
}
