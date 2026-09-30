// Match switcher: any match in SkillCorner open data. Unprocessed matches are
// ingested on demand (download + pack, ~10-20 s) with a progress state.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../data/api'
import type { MatchSummary } from '../data/types'

export function MatchPicker({ current }: { current: number }) {
  const [matches, setMatches] = useState<MatchSummary[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.matches().then(setMatches).catch((e) => setError(String(e.message)))
  }, [])

  const choose = async (id: number) => {
    setError(null)
    const m = matches.find((x) => x.id === id)
    if (m?.state === 'ready') return navigate(`/m/${id}`)
    setBusy(id)
    try {
      let { state } = await api.ingest(id)
      while (state === 'processing') {
        await new Promise((r) => setTimeout(r, 1500))
        const s = await api.status(id)
        state = s.state
        if (s.state === 'error') throw new Error(s.error ?? 'Processing failed')
      }
      setMatches((ms) => ms.map((x) => (x.id === id ? { ...x, state: 'ready' } : x)))
      navigate(`/m/${id}`)
    } catch (e) {
      setError(String((e as Error).message))
    } finally {
      setBusy(null)
    }
  }

  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="match" className="text-sm text-slate-400">Match</label>
      <select id="match" value={busy ?? current} disabled={busy != null}
        onChange={(e) => choose(Number(e.target.value))}
        className="max-w-80 rounded-md bg-white/10 px-2 py-1.5 text-sm ring-1 ring-white/10 focus:outline-none">
        {!matches.some((m) => m.id === current) && <option value={current}>Match {current}</option>}
        {matches.map((m) => (
          <option key={m.id} value={m.id} className="bg-slate-900">
            {m.home} v {m.away} · {date(m.date_time)}{m.state === 'ready' ? '' : ' (not loaded yet)'}
          </option>
        ))}
      </select>
      {busy != null && <span className="animate-pulse text-sm text-amber-300">Loading match data… (about 20 s)</span>}
      {error && <span className="text-sm text-red-300">{error}</span>}
    </div>
  )
}
