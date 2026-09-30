import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../store/player'
import type { ExportClip } from './composeFrame'
import { downloadBlob, exportFilename, exportGif, exportVideo, videoMimeType } from './exportClip'

type Kind = 'gif' | 'video'

export function ExportMenu({ clip, compact = false }: { clip: ExportClip; compact?: boolean }) {
  const data = usePlayer((s) => s.data)!
  const notify = usePlayer((s) => s.notify)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<{ kind: Kind; progress: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const videoType = videoMimeType()
  const videoExt = videoType?.includes('mp4') ? 'mp4' : 'webm'

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const run = async (kind: Kind) => {
    setOpen(false)
    setBusy({ kind, progress: 0 })
    try {
      const onProgress = (p: number) => setBusy({ kind, progress: p })
      const blob = kind === 'gif' ? await exportGif(data, clip, onProgress) : await exportVideo(data, clip, onProgress)
      downloadBlob(blob, exportFilename(data, clip, kind === 'gif' ? 'gif' : videoExt))
      notify(`Downloaded ${kind === 'gif' ? 'GIF' : 'video'} (${(blob.size / 1e6).toFixed(1)} MB).`)
    } catch (e) {
      notify(String((e as Error).message), 'warn')
    } finally {
      setBusy(null)
    }
  }

  const base = compact
    ? 'flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-white/10'
    : 'flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/15'

  if (busy)
    return (
      <span className={`${base} cursor-wait text-yellow-200`} role="status">
        {busy.kind === 'gif' ? 'Making GIF' : 'Recording video'}… {Math.round(busy.progress * 100)}%
      </span>
    )

  return (
    <div ref={ref} className="relative">
      <button className={base} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="currentColor" className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true">
          <path d="M11 4h2v9l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 13zM5 18h14v2H5z" />
        </svg>
        Download
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-60 rounded-lg bg-slate-800 p-1 text-sm shadow-xl ring-1 ring-white/10">
          <button role="menuitem" className="block w-full rounded px-3 py-2 text-left hover:bg-white/10" onClick={() => run('gif')}>
            <div className="font-medium">GIF</div>
            <div className="text-xs text-slate-400">Plays anywhere: Slack, email, slides</div>
          </button>
          <button role="menuitem" disabled={!videoType}
            className="block w-full rounded px-3 py-2 text-left hover:bg-white/10 disabled:opacity-40"
            onClick={() => run('video')}>
            <div className="font-medium">Video ({videoExt.toUpperCase()})</div>
            <div className="text-xs text-slate-400">
              {videoType ? 'HD, smoother and smaller. Records in real time.' : 'Not supported in this browser'}
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
