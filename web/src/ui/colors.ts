// Kit colours are used as-is on the pitch, but on the dark UI (timeline, labels)
// dark kits such as navy vanish. uiColors() lightens them and separates two
// kits that would look alike.
import type { MatchMeta } from '../data/types'

type RGB = [number, number, number]

const parse = (hex: string): RGB => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as RGB
}
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const luminance = ([r, g, b]: RGB) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB
const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function lighten(hex: string, minLum = 0.18): RGB {
  let c = parse(hex)
  for (let t = 0.1; luminance(c) < minLum && t <= 1; t += 0.1) c = mix(parse(hex), [255, 255, 255], t)
  return c
}

const cache = new WeakMap<MatchMeta, { home: string; away: string }>()

export function uiColors(meta: MatchMeta): { home: string; away: string } {
  let c = cache.get(meta)
  if (!c) {
    const home = lighten(meta.home.color)
    let away = lighten(meta.away.color)
    if (distance(home, away) < 90) away = parse('#f97316') // clash: fall back to orange
    c = { home: toHex(home), away: toHex(away) }
    cache.set(meta, c)
  }
  return c
}
