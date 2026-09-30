// One exported frame = title bar (clip name, tags, teams, score at that moment,
// match clock) + pitch. Shared by GIF and video export so both look identical.
import { frameLabel, isGoal } from '../data/loadMatch'
import type { MatchData } from '../data/types'
import { drawFrame } from '../pitch/renderer'
import { uiColors } from '../ui/colors'

export interface ExportClip {
  title: string
  tags: string[]
  start_frame: number
  end_frame: number
}

const BG = '#0d1117'
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'

export function exportSize(d: MatchData, width: number) {
  const bar = Math.round(width * 0.085)
  const aspect = (d.meta.pitch.length + 8) / (d.meta.pitch.width + 8)
  const pitchH = Math.round(width / aspect)
  // Even dimensions keep video encoders happy.
  return { width, height: (bar + pitchH) & ~1, bar }
}

/** Goals scored up to frame f, from the events' is_goal flags. */
export function scoreAt(d: MatchData, f: number): [number, number] {
  let home = 0
  let away = 0
  for (const e of d.events) {
    if (!isGoal(e) || e.frame_end > f) continue
    if (e.team_id === d.meta.home.id) home++
    else if (e.team_id === d.meta.away.id) away++
  }
  return [home, away]
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

export function composeFrame(ctx: CanvasRenderingContext2D, d: MatchData, clip: ExportClip, f: number) {
  const { width, height } = ctx.canvas
  const bar = Math.round(width * 0.085)
  const pad = Math.round(bar * 0.28)
  const colors = uiColors(d.meta)

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, width, bar)

  // Right block: score at this moment + clock.
  const [hs, as] = scoreAt(d, f)
  const home = d.meta.home.acronym ?? d.meta.home.short_name
  const away = d.meta.away.acronym ?? d.meta.away.short_name
  const big = Math.round(bar * 0.32)
  const small = Math.round(bar * 0.22)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'right'
  ctx.font = `700 ${big}px ${FONT}`
  const score = `${home}  ${hs} – ${as}  ${away}`
  const scoreW = ctx.measureText(score).width
  const sq = Math.round(big * 0.6)
  const right = width - pad - sq - 8
  ctx.fillStyle = '#e6edf3'
  ctx.fillText(score, right, pad + big * 0.85)
  ctx.fillStyle = colors.home
  ctx.fillRect(right - scoreW - sq - 8, pad + big * 0.85 - sq, sq, sq)
  ctx.fillStyle = colors.away
  ctx.fillRect(right + 8, pad + big * 0.85 - sq, sq, sq)
  ctx.font = `500 ${small}px ui-monospace, Consolas, monospace`
  ctx.fillStyle = '#facc15'
  ctx.fillText(frameLabel(d, f), width - pad, bar - pad * 0.7)
  const rightBlockW = scoreW + 2 * sq + 24

  // Left block: clip title + tags.
  ctx.textAlign = 'left'
  ctx.font = `700 ${big}px ${FONT}`
  ctx.fillStyle = '#ffffff'
  const maxLeft = width - rightBlockW - pad * 3
  ctx.fillText(fitText(ctx, clip.title, maxLeft), pad, pad + big * 0.85)
  ctx.font = `500 ${small}px ${FONT}`
  ctx.fillStyle = '#8b949e'
  const secs = ((clip.end_frame - clip.start_frame) / d.meta.fps).toFixed(1)
  const sub = [`${secs} s`, ...clip.tags].join('  ·  ')
  ctx.fillText(fitText(ctx, sub, maxLeft), pad, bar - pad * 0.7)

  drawFrame(ctx, d, f, {}, { x: 0, y: bar, w: width, h: height - bar })

  // Attribution in the pitch margin.
  ctx.textAlign = 'right'
  ctx.font = `500 ${Math.round(small * 0.8)}px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText('Tracking Clipper · SkillCorner open data', width - pad, height - pad * 0.5)
}
