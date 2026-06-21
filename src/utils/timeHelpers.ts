export function formatGameTime(currentDay: number, currentHour: number): string {
  return `${currentDay}日目 ${String(currentHour).padStart(2, "0")}:00`;
}
