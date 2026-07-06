export function getDateContext(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  return `Current date: ${now.toISOString()}. Current year: ${currentYear}. When referencing "recent" events, trends, or timeframes, always treat ${currentYear} as the present year. Never refer to past years (e.g. 2022, 2023, 2024) as if they were recent or current.`;
}
