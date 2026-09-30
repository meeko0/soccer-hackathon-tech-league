import { useEffect, useRef } from 'react'
import { usePlayer } from '../store/player'
import { drawFrame } from './renderer'

/** Draws the current frame; subscribes to the store outside React renders. */
export function PitchCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let lastFrame = -1

    const draw = (force = false) => {
      const { data, frame } = usePlayer.getState()
      if (!data || !canvas.width || (!force && frame === lastFrame)) return
      lastFrame = frame
      drawFrame(ctx, data, frame)
    }

    // Fit the pitch inside the wrapper's box (width and height), keeping aspect.
    const ro = new ResizeObserver(() => {
      const { data } = usePlayer.getState()
      if (!data) return
      const dpr = window.devicePixelRatio || 1
      const box = wrap.getBoundingClientRect()
      const aspect = (data.meta.pitch.length + 8) / (data.meta.pitch.width + 8)
      const width = Math.min(box.width, box.height * aspect)
      const height = width / aspect
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      draw(true)
    })
    ro.observe(wrap)
    const unsub = usePlayer.subscribe(() => draw())
    return () => {
      ro.disconnect()
      unsub()
    }
  }, [])

  return (
    // Phones: height follows width via aspect ratio. Desktop: fill remaining height.
    <div ref={wrapRef} className="relative aspect-[112/76] w-full lg:aspect-auto lg:min-h-[280px] lg:flex-1">
      <canvas ref={canvasRef} className="absolute inset-0 m-auto block rounded-lg" aria-label="Pitch view" />
    </div>
  )
}
