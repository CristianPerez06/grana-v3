const TZ = 'America/Argentina/Buenos_Aires'

const arFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function getTodayAR(): Date {
  const parts = arFormatter.formatToParts(new Date())
  const year = Number(parts.find((p) => p.type === 'year')!.value)
  const month = Number(parts.find((p) => p.type === 'month')!.value)
  const day = Number(parts.find((p) => p.type === 'day')!.value)
  return new Date(year, month - 1, day)
}
