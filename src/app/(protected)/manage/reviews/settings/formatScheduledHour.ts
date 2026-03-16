/** 0~23 → "오전 N시" / "오후 N시" */
export function formatScheduledHourLabel(hour: number): string {
  if (hour === 0) return "오전 12시";
  if (hour < 12) return `오전 ${hour}시`;
  if (hour === 12) return "오후 12시";
  return `오후 ${hour - 12}시`;
}
