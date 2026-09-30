import { useEffect } from 'react'
import { usePlayer } from '../store/player'

export function Toast() {
  const notice = usePlayer((s) => s.notice)
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => usePlayer.setState({ notice: null }), notice.kind === 'warn' ? 4000 : 2500)
    return () => clearTimeout(t)
  }, [notice])
  if (!notice) return null
  return (
    <div role="status"
      className={`fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium shadow-xl ${notice.kind === 'warn' ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-900'}`}>
      {notice.text}
    </div>
  )
}
