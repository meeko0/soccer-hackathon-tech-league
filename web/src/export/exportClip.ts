// Client-side clip export. Nothing is rendered on the server: frames are drawn
// with the same canvas renderer as the player.
//   GIF   : gifenc, 20 fps (interpolated between 10 fps tracking frames), plays anywhere
//   Video : MediaRecorder on a canvas stream (WebM, or MP4 on Safari), 30 fps, recorded in real time
import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import type { MatchData } from '../data/types'
import { composeFrame, exportSize, type ExportClip } from './composeFrame'

export type Progress = (fraction: number) => void

const GIF_WIDTH = 720
const GIF_FPS = 20
const VIDEO_WIDTH = 1280
const VIDEO_FPS = 30

const nextTick = () => new Promise((r) => setTimeout(r, 0))

function makeCanvas(d: MatchData, width: number) {
  const { height } = exportSize(d, width)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return { canvas, ctx }
}

export async function exportGif(d: MatchData, clip: ExportClip, onProgress?: Progress): Promise<Blob> {
  const { canvas, ctx } = makeCanvas(d, GIF_WIDTH)
  const { width, height } = canvas
  const step = d.meta.fps / GIF_FPS
  const n = Math.floor((clip.end_frame - clip.start_frame) / step) + 1
  const frameAt = (i: number) => clip.start_frame + i * step

  // One palette for the whole clip (sampled from start/middle/end) avoids flicker.
  const samples = [0, Math.floor(n / 2), n - 1].map((i) => {
    composeFrame(ctx, d, clip, frameAt(i))
    return ctx.getImageData(0, 0, width, height).data
  })
  const merged = new Uint8ClampedArray(samples.reduce((s, a) => s + a.length, 0))
  samples.reduce((off, a) => (merged.set(a, off), off + a.length), 0)
  const palette = quantize(merged, 256)

  const gif = GIFEncoder()
  for (let i = 0; i < n; i++) {
    composeFrame(ctx, d, clip, frameAt(i))
    const index = applyPalette(ctx.getImageData(0, 0, width, height).data, palette)
    gif.writeFrame(index, width, height, { palette: i === 0 ? palette : undefined, delay: 1000 / GIF_FPS, repeat: 0 })
    if (i % 4 === 0) {
      onProgress?.(i / n)
      await nextTick() // keep the UI responsive
    }
  }
  gif.finish()
  onProgress?.(1)
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' })
}

export function videoMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  return options.find((t) => MediaRecorder.isTypeSupported(t)) ?? null
}

export async function exportVideo(d: MatchData, clip: ExportClip, onProgress?: Progress): Promise<Blob> {
  const mimeType = videoMimeType()
  if (!mimeType) throw new Error('This browser cannot record video. Try the GIF download instead.')
  const { canvas, ctx } = makeCanvas(d, VIDEO_WIDTH)
  const stream = canvas.captureStream(VIDEO_FPS)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise<void>((r) => (recorder.onstop = () => r()))

  const duration = (clip.end_frame - clip.start_frame) / d.meta.fps
  composeFrame(ctx, d, clip, clip.start_frame)
  recorder.start()
  const t0 = performance.now()
  await new Promise<void>((resolve) => {
    // setInterval (not rAF) so recording continues if the tab loses focus.
    const timer = setInterval(() => {
      const t = Math.min(duration, (performance.now() - t0) / 1000)
      composeFrame(ctx, d, clip, clip.start_frame + t * d.meta.fps)
      onProgress?.(t / duration)
      if (t >= duration) {
        clearInterval(timer)
        resolve()
      }
    }, 1000 / VIDEO_FPS)
  })
  // Hold the last frame briefly so players don't cut it off.
  await new Promise((r) => setTimeout(r, 300))
  recorder.stop()
  await stopped
  stream.getTracks().forEach((t) => t.stop())
  return new Blob(chunks, { type: mimeType.split(';')[0] })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function exportFilename(d: MatchData, clip: ExportClip, ext: string) {
  const slug = clip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'clip'
  return `${slug}_${d.meta.match_id}_${clip.start_frame}.${ext}`
}
