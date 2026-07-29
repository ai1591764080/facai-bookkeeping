export function uuid(): string {
  const s: string[] = []
  const hex = '0123456789abcdef'
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      s.push('-')
    } else if (i === 14) {
      s.push('4')
    } else {
      const r = (Math.random() * 16) | 0
      const v = i === 19 ? (r & 0x3) | 0x8 : r
      s.push(hex[v])
    }
  }
  return s.join('')
}
