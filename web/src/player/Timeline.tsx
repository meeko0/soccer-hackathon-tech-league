// Match timeline: phase-of-play bands (coloured by team in possession), shot and
// goal markers, In/Out range, playhead. Click or drag to scrub; drag the yellow
// handles to trim the clip.
import { useEffect, useMemo, useRef, useState } from 'react'
import { frameLabel, isGoal, isShot } from '../data/loadMatch'
import type { MatchData, MatchEvent, Phase } from '../data/types'
import { usePlayer } from '../store/player'
import { uiColors } from '../ui/colors'

const H = 56
const TICKS = { y: 2, h: 12 }
const BANDS = { y: 16, h: 18 }
const TRACK = { y: 40, h: 6 }
const HANDLE_HIT_PX = 8

export const PHASE_LABELS: Record<string, string> = {
  build_up: 'Build-up',
  create: 'Create',
  finish: 'Finish',
  direct: 'Direct play',
  quick_break: 'Quick break',
  transition: 'Transition',
  chaotic: 'Chaotic',
  set_play: 'Set piece',
}

// Stronger fill for more dangerous phases so attacks stand out at a glance.
const PHASE_ALPHA: Record<string, number> = {
  build_up: 0.35, create: 0.6, finish: 0.95, direct: 0.6, quick_break: 0.95,
  transition: 0.75, chaotic: 0.25, set_play: 0.5,
}

type Drag = 'seek' | 'in' | 'out' | null

interface Hover {
  x: number
  frame: number
  phase?: Phase
  event?: MatchEvent
}

export function Timeline() {
  const data = usePlayer((s) => s.data)!
  const frame = usePlayer((s) => Math.round(s.frame))
  const inFrame = usePlayer((s) => s.inFrame)
  const outFrame = usePlayer((s) => s.outFrame)
  const loop = usePlayer((s) => s.loop)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<Hover | null>(null)
  const drag = useRef<Drag>(null)

  const keyEvents = useMemo(() => data.events.filter(isShot), [data])
  const n = data.meta.n_frames
  const toX = (f: number) => (f / (n - 1)) * width
  const toFrame = (x: number) => Math.round(Math.max(0, Math.min(1, x / width)) * (n - 1))

  useEffect(() => {
    const canvas = canvasRef.current!
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    if (!width) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawTimeline(ctx, data, width, frame, inFrame, outFrame, loop, keyEvents)
  }, [data, width, frame, inFrame, outFrame, loop, keyEvents])

  const hitHandle = (x: number): Drag => {
    if (inFrame != null && Math.abs(x - toX(inFrame)) < HANDLE_HIT_PX) return 'in'
    if (outFrame != null && Math.abs(x - toX(outFrame)) < HANDLE_HIT_PX) return 'out'
    return 'seek'
  }

  const apply = (mode: Drag, f: number) => {
    const s = usePlayer.getState()
    if (mode === 'seek') s.seek(f)
    else if (mode === 'in' && s.outFrame != null) s.setRange(Math.min(f, s.outFrame - 1), s.outFrame)
    else if (mode === 'out' && s.inFrame != null) s.setRange(s.inFrame, Math.max(f, s.inFrame + 1))
  }

  const localX = (e: React.PointerEvent) => e.clientX - canvasRef.current!.getBoundingClientRect().left

  const onDown = (e: React.PointerEvent) => {
    const x = localX(e)
    drag.current = hitHandle(x)
    canvasRef.current!.setPointerCapture(e.pointerId)
    apply(drag.current, toFrame(x))
  }

  const onMove = (e: React.PointerEvent) => {
    const x = localX(e)
    const f = toFrame(x)
    if (drag.current) apply(drag.current, f)
    const tol = (6 / width) * n
    setHover({
      x,
      frame: f,
      phase: data.phases.find((p) => p.frame_start <= f && f <= p.frame_end),
      event: keyEvents.find((ev) => Math.abs(ev.frame_end - f) <= tol),
    })
    canvasRef.current!.style.cursor = hitHandle(x) === 'seek' ? 'pointer' : 'ew-resize'
  }

  const onUp = () => {
    drag.current = null
  }

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef}
        className="block w-full touch-none"
        style={{ height: H }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setHover(null)}
        aria-label="Match timeline"
      />
      {hover && <HoverCard hover={hover} data={data} width={width} />}
    </div>
  )
}

function HoverCard({ hover, data, width }: { hover: Hover; data: MatchData; width: number }) {
  const colors = uiColors(data.meta)
  const pid = hover.phase?.team_in_possession_id
  const phaseTeam = pid === data.meta.home.id ? data.meta.home : pid === data.meta.away.id ? data.meta.away : null
  const phaseColor = pid === data.meta.home.id ? colors.home : colors.away
  const left = Math.max(80, Math.min(width - 80, hover.x))
  return (
    <div
      className="pointer-events-none absolute bottom-full mb-2 w-44 -translate-x-1/2 rounded-md bg-slate-900/95 px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-white/10"
      style={{ left }}
    >
      <div className="font-mono font-semibold">{frameLabel(data, hover.frame)}</div>
      {hover.event && (
        <div className="mt-0.5 text-amber-300">
          {isGoal(hover.event) ? '⚽ Goal' : 'Shot'}: {hover.event.player_name} ({hover.event.team_shortname})
        </div>
      )}
      {hover.phase && phaseTeam && (
        <div className="mt-0.5 text-slate-300">
          <span style={{ color: phaseColor }}>■</span>{' '}
          {phaseTeam.short_name}:{' '}
          {PHASE_LABELS[hover.phase.team_in_possession_phase_type ?? ''] ?? hover.phase.team_in_possession_phase_type}
        </div>
      )}
    </div>
  )
}

function drawTimeline(
  ctx: CanvasRenderingContext2D,
  d: MatchData,
  w: number,
  frame: number,
  inFrame: number | null,
  outFrame: number | null,
  loop: { start: number; end: number } | null,
  keyEvents: MatchEvent[],
) {
  const n = d.meta.n_frames
  const x = (f: number) => (f / (n - 1)) * w
  ctx.clearRect(0, 0, w, H)

  const colors = uiColors(d.meta)
  const colorOf = (teamId?: number) =>
    teamId === d.meta.home.id ? colors.home : teamId === d.meta.away.id ? colors.away : null

  // Phase bands.
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(0, BANDS.y, w, BANDS.h)
  for (const p of d.phases) {
    const color = colorOf(p.team_in_possession_id)
    if (!color) continue
    ctx.globalAlpha = PHASE_ALPHA[p.team_in_possession_phase_type ?? ''] ?? 0.4
    ctx.fillStyle = color
    // Home band on top half, away on bottom half, so possession swings read clearly.
    const half = BANDS.h / 2
    const y = p.team_in_possession_id === d.meta.home.id ? BANDS.y : BANDS.y + half
    ctx.fillRect(x(p.frame_start), y, Math.max(1, x(p.frame_end) - x(p.frame_start)), half)
  }
  ctx.globalAlpha = 1

  // Half-time divider(s).
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (const p of d.meta.periods.slice(1)) ctx.fillRect(x(p.start_frame) - 0.5, 0, 1, H)

  // Track + played portion.
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(0, TRACK.y, w, TRACK.h)
  ctx.fillStyle = '#ef4444'
  ctx.fillRect(0, TRACK.y, x(frame), TRACK.h)

  // Shots (small ticks) and goals (ball markers), in team colour.
  for (const ev of keyEvents) {
    const color = colorOf(ev.team_id) ?? '#fff'
    const ex = x(ev.frame_end)
    if (isGoal(ev)) {
      ctx.beginPath()
      ctx.arc(ex, TICKS.y + TICKS.h / 2, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = color
      ctx.stroke()
    } else {
      ctx.fillStyle = color
      ctx.globalAlpha = 0.9
      ctx.fillRect(ex - 1, TICKS.y + 3, 2, TICKS.h - 3)
      ctx.globalAlpha = 1
    }
  }

  // Looping clip (clip view).
  if (loop) {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.3)'
    ctx.fillRect(x(loop.start), 0, Math.max(3, x(loop.end) - x(loop.start)), H)
  }

  // Clip range.
  if (inFrame != null && outFrame != null) {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)'
    ctx.fillRect(x(inFrame), 0, Math.max(2, x(outFrame) - x(inFrame)), H)
    ctx.fillStyle = '#facc15'
    for (const f of [inFrame, outFrame]) ctx.fillRect(x(f) - 1.5, 0, 3, H)
  } else if (inFrame != null) {
    ctx.fillStyle = '#facc15'
    ctx.fillRect(x(inFrame) - 1.5, 0, 3, H)
  }

  // Playhead.
  const px = x(frame)
  ctx.fillStyle = '#fff'
  ctx.fillRect(px - 1, 0, 2, H)
  ctx.beginPath()
  ctx.arc(px, TRACK.y + TRACK.h / 2, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#ef4444'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#fff'
  ctx.stroke()
}
