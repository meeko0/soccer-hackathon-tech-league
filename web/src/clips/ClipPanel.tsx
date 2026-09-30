// Right-hand panel: save the current In/Out range as a clip, and browse,
// filter, play, share or delete the match's saved clips.
import { useMemo, useState } from 'react'
import { api, clipUrl, copyText } from '../data/api'
import { ExportMenu } from '../export/ExportMenu'
import { frameLabel } from '../data/loadMatch'
import type { Clip } from '../data/types'
import { usePlayer } from '../store/player'
import { LinkIcon, PlayIcon, TrashIcon } from '../ui/icons'

export const SUGGESTED_TAGS = ['pressing trigger', 'off-ball run', '3rd man run', 'build-up', 'transition',
  'counter-press', 'set piece', 'defensive shape', 'chance created']

interface Props {
  clips: Clip[]
  onSaved: (c: Clip) => void
  onDeleted: (id: string) => void
  onPlay: (c: Clip) => void
  activeClipId?: string
}

export function ClipPanel({ clips, onSaved, onDeleted, onPlay, activeClipId }: Props) {
  const data = usePlayer((s) => s.data)!
  const inFrame = usePlayer((s) => s.inFrame)
  const outFrame = usePlayer((s) => s.outFrame)
  const notify = usePlayer((s) => s.notify)
  const [filter, setFilter] = useState<string | null>(null)

  const allTags = useMemo(() => [...new Set(clips.flatMap((c) => c.tags))].sort(), [clips])
  const shown = filter ? clips.filter((c) => c.tags.includes(filter)) : clips

  const copy = async (c: Clip) => {
    if (await copyText(clipUrl(c))) notify('Clip link copied. Anyone with the link can watch it.')
    else notify(`Copy this link: ${clipUrl(c)}`, 'warn')
  }

  const remove = async (c: Clip) => {
    if (!confirm(`Delete "${c.title}"?`)) return
    await api.deleteClip(c.id)
    onDeleted(c.id)
  }

  return (
    <aside className="flex min-h-0 flex-col gap-4">
      {inFrame != null && outFrame != null ? (
        <SaveForm matchId={data.meta.match_id} start={inFrame} end={outFrame}
          onSaved={onSaved} />
      ) : (
        <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-slate-400">
          <p className="font-medium text-slate-200">Make a clip</p>
          <p className="mt-1">
            Press <Kbd>I</Kbd> at the start and <Kbd>O</Kbd> at the end (up to 10 seconds), or use the In/Out buttons
            under the timeline.
          </p>
        </div>
      )}

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Clips <span className="text-slate-500">({clips.length})</span></h2>
        </div>
        {allTags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {allTags.map((t) => (
              <button key={t} onClick={() => setFilter(filter === t ? null : t)}
                className={`rounded-full px-2 py-0.5 text-xs ${filter === t ? 'bg-yellow-400 text-slate-900' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}>
                {t}
              </button>
            ))}
          </div>
        )}
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          {shown.length === 0 && <li className="text-sm text-slate-500">No clips yet for this match.</li>}
          {shown.map((c) => (
            <li key={c.id}
              className={`group rounded-lg p-2.5 ring-1 ${c.id === activeClipId ? 'bg-yellow-400/10 ring-yellow-400/50' : 'bg-white/5 ring-white/5 hover:bg-white/10'}`}>
              <button className="block w-full text-left" onClick={() => onPlay(c)}>
                <div className="truncate font-medium">{c.title}</div>
                <div className="font-mono text-xs text-slate-400">
                  {frameLabel(data, c.start_frame)} · {((c.end_frame - c.start_frame) / data.meta.fps).toFixed(1)} s
                </div>
              </button>
              {c.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.tags.map((t) => <span key={t} className="rounded bg-white/10 px-1.5 text-[11px] text-slate-300">{t}</span>)}
                </div>
              )}
              <div className="mt-1.5 flex gap-1">
                <button className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-white/10" onClick={() => onPlay(c)}>
                  <PlayIcon className="h-3.5 w-3.5" /> Play
                </button>
                <button className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-white/10" onClick={() => copy(c)}>
                  <LinkIcon className="h-3.5 w-3.5" /> Share link
                </button>
                <ExportMenu clip={c} compact />
                <button className="ml-auto rounded px-2 py-1 text-xs text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                  onClick={() => remove(c)} title="Delete clip">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

function SaveForm({ matchId, start, end, onSaved }: { matchId: number; start: number; end: number; onSaved: (c: Clip) => void }) {
  const data = usePlayer((s) => s.data)!
  const notify = usePlayer((s) => s.notify)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTag = (t: string) => {
    const v = t.trim().toLowerCase()
    if (v && !tags.includes(v)) setTags([...tags, v])
    setTagInput('')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const clip = await api.createClip({
        match_id: matchId, start_frame: start, end_frame: end,
        title: title.trim() || `Clip at ${frameLabel(data, start)}`, notes, tags,
      })
      notify((await copyText(clipUrl(clip))) ? 'Clip saved and link copied.' : 'Clip saved.')
      onSaved(clip)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-lg bg-yellow-400/10 p-3 ring-1 ring-yellow-400/40">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-yellow-200">New clip</h2>
        <span className="font-mono text-xs text-yellow-200/80">
          {frameLabel(data, start)} · {((end - start) / data.meta.fps).toFixed(1)} s
        </span>
      </div>
      <input className="rounded bg-slate-900/80 px-2 py-1.5 text-sm ring-1 ring-white/10 focus:ring-yellow-400/60 focus:outline-none"
        placeholder={`Clip at ${frameLabel(data, start)}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <button type="button" key={t} onClick={() => setTags(tags.filter((x) => x !== t))}
            className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs text-slate-900" title="Remove tag">{t} ×</button>
        ))}
        <input className="min-w-24 flex-1 bg-transparent px-1 text-sm focus:outline-none" placeholder="Add tag…"
          value={tagInput} onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addTag(tagInput)
            }
          }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((t) => (
          <button type="button" key={t} onClick={() => addTag(t)}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/20">+ {t}</button>
        ))}
      </div>
      <textarea className="rounded bg-slate-900/80 px-2 py-1.5 text-sm ring-1 ring-white/10 focus:ring-yellow-400/60 focus:outline-none"
        rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button disabled={saving} className="rounded-md bg-yellow-400 py-1.5 font-semibold text-slate-900 hover:bg-yellow-300 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save clip & copy link'}
      </button>
    </form>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/20 bg-white/10 px-1.5 font-mono text-xs text-slate-200">{children}</kbd>
}
