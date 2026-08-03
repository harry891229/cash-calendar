const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDateText(date: Date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateText(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isDateText(value: unknown): value is string {
  return typeof value === "string" && parseDateText(value) !== null;
}

export function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function clampDayToMonth(
  year: number,
  monthIndex: number,
  requestedDay: number
) {
  return Math.min(requestedDay, getDaysInMonth(year, monthIndex));
}

export function getDateForClampedDay(
  year: number,
  monthIndex: number,
  requestedDay: number
) {
  return new Date(
    year,
    monthIndex,
    clampDayToMonth(year, monthIndex, requestedDay)
  );
}

export function getWeekdayText(date: Date) {
  return `星期${"日一二三四五六"[date.getDay()]}`;
}

export function isSameMonth(dateText: string, baseDate: Date) {
  const date = parseDateText(dateText);
  return (
    date !== null &&
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth()
  );
}

export function previousDateText(dateText: string) {
  const date = parseDateText(dateText);
  if (!date) return null;
  date.setDate(date.getDate() - 1);
  return toDateText(date);
}
