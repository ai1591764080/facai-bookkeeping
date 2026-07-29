export function formatAmount(amount: number, currency: string = 'CNY'): string {
  const abs = Math.abs(amount)
  if (currency === 'CNY') {
    return abs.toFixed(2)
  }
  return abs.toFixed(2)
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}月${day}日`
}

export function formatFullDate(isoDate: string): string {
  const d = new Date(isoDate)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatMonthKey(isoDate: string): string {
  const d = new Date(isoDate)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getWeekDay(isoDate: string): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[new Date(isoDate).getDay()]
}

export function isToday(isoDate: string): boolean {
  const d = new Date(isoDate)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

export function isYesterday(isoDate: string): boolean {
  const d = new Date(isoDate)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
}

export function getDateLabel(isoDate: string): string {
  if (isToday(isoDate)) return '今天'
  if (isYesterday(isoDate)) return '昨天'
  return `${formatDate(isoDate)} ${getWeekDay(isoDate)}`
}

export function getMonthStart(year: number, month: number): Date {
  return new Date(year, month, 1)
}

export function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

export function getYearStart(year: number): Date {
  return new Date(year, 0, 1)
}

export function getYearEnd(year: number): Date {
  return new Date(year, 11, 31, 23, 59, 59, 999)
}
