export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'annual'

function parseISODate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function addDays(isoDate: string, days: number): string {
  const date = parseISODate(isoDate)
  date.setDate(date.getDate() + days)
  return formatDateISO(date)
}

function addMonthsClamped(
  isoDate: string,
  monthsToAdd: number,
  options: { anchorDate?: string } = {},
): string {
  const date = parseISODate(isoDate)
  const sourceDay = options.anchorDate ? parseISODate(options.anchorDate).getDate() : date.getDate()
  const targetMonthIndex = date.getMonth() + monthsToAdd
  const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12)
  const normalizedTargetMonth = ((targetMonthIndex % 12) + 12) % 12
  const targetDay = Math.min(sourceDay, daysInMonth(targetYear, normalizedTargetMonth))

  return formatDateISO(new Date(targetYear, normalizedTargetMonth, targetDay))
}

export function getNextRecurrenceDate(
  fromDate: string,
  frequency: RecurrenceFrequency,
  options: { anchorDate?: string } = {},
): string {
  if (frequency === 'weekly') return addDays(fromDate, 7)
  if (frequency === 'biweekly') return addDays(fromDate, 14)
  if (frequency === 'monthly') return addMonthsClamped(fromDate, 1, options)
  return addMonthsClamped(fromDate, 12, options)
}
