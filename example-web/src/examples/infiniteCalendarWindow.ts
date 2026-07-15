import { buildCalendarMonthRange, type CalendarMonth, shiftCalendarMonthId } from "@examples/calendar";

export const CALENDAR_INITIAL_SPAN = 12;
export const CALENDAR_PAGE_SIZE = 6;
export const CALENDAR_WINDOW_SIZE = CALENDAR_INITIAL_SPAN * 2 + 1;

export function prependCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[0]!.id, -count);
    return [...buildCalendarMonthRange(startMonthId, count, today), ...months].slice(0, CALENDAR_WINDOW_SIZE);
}

export function appendCalendarMonths(months: CalendarMonth[], count: number, today: Date) {
    const startMonthId = shiftCalendarMonthId(months[months.length - 1]!.id, 1);
    const next = [...months, ...buildCalendarMonthRange(startMonthId, count, today)];
    return next.slice(Math.max(0, next.length - CALENDAR_WINDOW_SIZE));
}

export function ensureMonthRange(months: CalendarMonth[], targetMonthId: string, today: Date) {
    let next = months;

    while (targetMonthId < next[0]!.id) {
        next = prependCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
    }

    while (targetMonthId > next[next.length - 1]!.id) {
        next = appendCalendarMonths(next, CALENDAR_PAGE_SIZE, today);
    }

    return next;
}
