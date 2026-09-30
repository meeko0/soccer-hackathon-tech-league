import { Kbd } from '../clips/ClipPanel'
import { SHORTCUTS } from '../player/useShortcuts'

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-5 shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-semibold">Keyboard shortcuts</h2>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map(([keys, what]) => (
              <tr key={keys} className="border-t border-white/5">
                <td className="py-1.5 pr-4 whitespace-nowrap"><Kbd>{keys}</Kbd></td>
                <td className="py-1.5 text-slate-300">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="mt-4 w-full rounded-md bg-white/10 py-1.5 hover:bg-white/15" onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}
