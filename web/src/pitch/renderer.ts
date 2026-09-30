// Canvas 2D pitch + player renderer. Pure functions of (data, fractional frame),
// so the same code draws the live player, clip previews and GIF/WebM export.

import type { MatchData } from '../data/types'

export interface View {
  w: number // drawing area size in px
  h: number
  scale: number // px per metre
  ox: number // canvas px of pitch centre
  oy: number
}

const MARGIN_M = 4

export function fitView(width: number, height: number, pitch: { length: number; width: number }): View {
  const scale = Math.min(width / (pitch.length + 2 * MARGIN_M), height / (pitch.width + 2 * MARGIN_M))
  return { w: width, h: height, scale, ox: width / 2, oy: height / 2 }
}

// SkillCorner: metres, origin at centre spot, y points "up" (left when attacking +x).
const toPx = (v: View, x: number, y: number): [number, number] => [v.ox + x * v.scale, v.oy - y * v.scale]

export function drawPitch(ctx: CanvasRenderingContext2D, v: View, pitch: { length: number; width: number }) {
  const L = pitch.length / 2
  const W = pitch.width / 2
  const s = v.scale

  ctx.fillStyle = '#1e5b35'
  ctx.fillRect(0, 0, v.w, v.h)
  // Mowing stripes, 12 bands across the length.
  const band = pitch.length / 12
  ctx.fillStyle = '#226540'
  for (let i = 0; i < 12; i += 2) {
    const [x0, y0] = toPx(v, -L + i * band, W)
    ctx.fillRect(x0, y0, band * s, pitch.width * s)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = Math.max(1, 0.12 * s)
  const rect = (x: number, y: number, w: number, h: number) => {
    const [px, py] = toPx(v, x, y)
    ctx.strokeRect(px, py, w * s, h * s)
  }
  const circle = (x: number, y: number, r: number, a0 = 0, a1 = Math.PI * 2, fill = false) => {
    const [px, py] = toPx(v, x, y)
    ctx.beginPath()
    ctx.arc(px, py, r * s, a0, a1)
    if (fill) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fill()
    } else ctx.stroke()
  }

  rect(-L, W, pitch.length, pitch.width)
  ctx.beginPath()
  ctx.moveTo(...toPx(v, 0, W))
  ctx.lineTo(...toPx(v, 0, -W))
  ctx.stroke()
  circle(0, 0, 9.15)
  circle(0, 0, 0.3, 0, Math.PI * 2, true)

  for (const dir of [-1, 1]) {
    const gx = dir * L
    // Penalty area 16.5 x 40.32, goal area 5.5 x 18.32, spot at 11 m.
    rect(dir < 0 ? gx : gx - 16.5, 20.16, 16.5, 40.32)
    rect(dir < 0 ? gx : gx - 5.5, 9.16, 5.5, 18.32)
    circle(gx - dir * 11, 0, 0.3, 0, Math.PI * 2, true)
    // "D" arc: the part of the 9.15 m circle outside the box.
    const a = Math.acos(5.5 / 9.15)
    if (dir < 0) circle(gx + 11, 0, 9.15, -a, a)
    else circle(gx - 11, 0, 9.15, Math.PI - a, Math.PI + a)
    // Goal, 7.32 wide, drawn 1.5 m deep behind the line.
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    rect(dir < 0 ? gx - 1.5 : gx, 3.66, 1.5, 7.32)
    ctx.restore()
  }
}

/** Interpolated position of a slot at fractional frame f, or null if absent. */
export function slotPosition(d: MatchData, slot: number, f: number): [number, number] | null {
  const { n_slots, encoding, n_frames } = d.meta
  const i0 = Math.max(0, Math.min(n_frames - 1, Math.floor(f)))
  const i1 = Math.min(n_frames - 1, i0 + 1)
  const t = f - i0
  const k0 = (i0 * n_slots + slot) * 2
  const k1 = (i1 * n_slots + slot) * 2
  const has0 = d.positions[k0] !== encoding.missing
  const has1 = d.positions[k1] !== encoding.missing
  const sc = encoding.position_scale
  if (has0 && has1) {
    return [
      (d.positions[k0] + (d.positions[k1] - d.positions[k0]) * t) / sc,
      (d.positions[k0 + 1] + (d.positions[k1 + 1] - d.positions[k0 + 1]) * t) / sc,
    ]
  }
  if (has0 && t < 0.5) return [d.positions[k0] / sc, d.positions[k0 + 1] / sc]
  if (has1 && t >= 0.5) return [d.positions[k1] / sc, d.positions[k1 + 1] / sc]
  return null
}

export interface DrawOptions {
  showNumbers?: boolean
  highlight?: Set<number>
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Draw frame f (fractional = interpolated) into rect (default: whole canvas). */
export function drawFrame(ctx: CanvasRenderingContext2D, d: MatchData, f: number, opts: DrawOptions = {}, rect?: Rect) {
  const r0 = rect ?? { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height }
  ctx.save()
  ctx.translate(r0.x, r0.y)
  ctx.beginPath()
  ctx.rect(0, 0, r0.w, r0.h)
  ctx.clip()
  drawFrameInner(ctx, d, f, opts, fitView(r0.w, r0.h, d.meta.pitch))
  ctx.restore()
}

function drawFrameInner(ctx: CanvasRenderingContext2D, d: MatchData, f: number, opts: DrawOptions, v: View) {
  const { meta } = d
  drawPitch(ctx, v, meta.pitch)

  const i = Math.max(0, Math.min(meta.n_frames - 1, Math.round(f)))
  const r = Math.max(5, 1.1 * v.scale)

  for (const slot of meta.slots) {
    const p = slotPosition(d, slot.slot, f)
    if (!p) continue
    const [px, py] = toPx(v, p[0], p[1])
    const team = meta[slot.team]
    const extrapolated = d.detected[i * meta.n_slots + slot.slot] === meta.encoding.detected.extrapolated

    // Extrapolated (off-camera) players are ghosted: data honesty.
    ctx.globalAlpha = extrapolated ? 0.45 : 1
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fillStyle = team.color
    ctx.fill()
    ctx.lineWidth = opts.highlight?.has(slot.slot) ? 3 : 1.5
    ctx.strokeStyle = opts.highlight?.has(slot.slot) ? '#ffd33d' : slot.is_goalkeeper ? '#111' : team.number_color
    if (extrapolated) ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])

    if (opts.showNumbers !== false && slot.number != null) {
      ctx.fillStyle = team.number_color
      ctx.font = `600 ${Math.round(r * 1.05)}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(slot.number), px, py + 0.5)
    }
    ctx.globalAlpha = 1
  }

  const ball = slotPosition(d, meta.ball_slot, f)
  if (ball) {
    const [bx, by] = toPx(v, ball[0], ball[1])
    const z = d.ballZ[i] === meta.encoding.missing ? 0 : d.ballZ[i] / meta.encoding.position_scale
    // Shadow on the ground, ball lifted and enlarged with height.
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.arc(bx, by, r * 0.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(bx, by - z * v.scale * 0.35, r * (0.5 + Math.min(z, 10) * 0.03), 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#111'
    ctx.stroke()
  }
}
