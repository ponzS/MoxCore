export function trimUrlPath(path: string) {
  const p = String(path || '').trim()
  if (!p) return ''
  return p.startsWith('/') ? p : `/${p}`
}

export function joinUrl(base: string, path: string) {
  const b = String(base || '').trim().replace(/\/+$/, '')
  const p = trimUrlPath(path)
  if (!b) return p
  if (!p) return b
  return `${b}${p}`
}
