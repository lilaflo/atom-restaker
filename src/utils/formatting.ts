/**
 * Formats a number for display with locale-specific formatting
 */
export function formatNumber(number: number): string {
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}
