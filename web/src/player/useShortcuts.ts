import { useEffect } from 'react'
import { isShot } from '../data/loadMatch'
import { usePlayer } from '../store/player'

export const SHORTCUTS: [string, string][] = [
  ['Space / K', 'Play / pause'],
  ['J / L', 'Play backward / forward (press again to speed up)'],
  ['← / →', 'Back / forward one frame (0.1 s)'],
  ['Shift + ← / →', 'Back / forward 5 seconds'],
  ['↑ / ↓', 'Jump to previous / next shot'],
  ['I / O', 'Set clip In / Out point'],
  ['X', 'Clear In / Out'],
  ['?', 'Show this list'],
]

export function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const s = usePlayer.getState()
      if (!s.data) return
      const fps = s.data.meta.fps

      const jumpShot = (dir: 1 | -1) => {
        const now = Math.round(s.frame)
        const shots = s.data!.events.filter(isShot).map((ev) => ev.frame_end)
        const target = dir > 0 ? shots.find((f) => f > now + 5) : [...shots].reverse().find((f) => f < now - 5)
        // Land 5 s before the shot so the build-up is visible.
        if (target != null) s.seek(Math.max(0, target - 5 * fps))
      }

      const actions: Record<string, () => void> = {
        ' ': s.togglePlay,
        k: s.pause,
        j: () => s.shuttle(-1),
        l: () => s.shuttle(1),
        ArrowLeft: () => s.step(e.shiftKey ? -5 * fps : -1),
        ArrowRight: () => s.step(e.shiftKey ? 5 * fps : 1),
        ArrowUp: () => jumpShot(-1),
        ArrowDown: () => jumpShot(1),
        i: () => s.markIn(),
        o: () => s.markOut(),
        x: s.clearRange,
        '?': onHelp,
      }
      const action = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (action) {
        e.preventDefault()
        action()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onHelp])
}
