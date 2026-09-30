import { useEffect } from 'react'
import type { MatchData } from '../data/types'
import { usePlayer } from '../store/player'

/** Step over frames with no period (before kickoff, half-time break). */
function skipGap(d: MatchData, f: number, dir: 1 | -1): number {
  const last = d.meta.n_frames - 1
  while (f > 0 && f < last && d.period[Math.floor(f)] === 0) f += dir
  return f
}

/** One requestAnimationFrame loop for the whole app. */
export function usePlayback() {
  useEffect(() => {
    let raf = 0
    let last: number | null = null
    const tick = (t: number) => {
      const s = usePlayer.getState()
      if (s.playing && s.data) {
        const dt = last == null ? 0 : Math.min(0.1, (t - last) / 1000)
        const range = s.loop ?? { start: 0, end: s.data.meta.n_frames - 1 }
        let f = s.frame + dt * s.data.meta.fps * s.speed * s.direction
        let playing = true
        if (f > range.end) {
          if (s.loop) f = range.start
          else {
            f = range.end
            playing = false
          }
        } else if (f < range.start) {
          if (s.loop) f = range.end
          else {
            f = range.start
            playing = false
          }
        }
        usePlayer.setState({ frame: skipGap(s.data, f, s.direction), playing })
      }
      last = t
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
}
