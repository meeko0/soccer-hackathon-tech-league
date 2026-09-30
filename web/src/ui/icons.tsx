// Minimal inline icons (no icon library dependency).
const P = (d: string) => (props: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={props.className ?? 'h-5 w-5'} aria-hidden="true">
    <path d={d} />
  </svg>
)

export const PlayIcon = P('M8 5v14l11-7z')
export const PauseIcon = P('M6 5h4v14H6zm8 0h4v14h-4z')
export const StepBackIcon = P('M6 6h2v12H6zm3.5 6 8.5 6V6z')
export const StepFwdIcon = P('M16 6h2v12h-2zM6 18l8.5-6L6 6z')
export const Back5Icon = P('M11 18V6l-8.5 6zm.5-6 8.5 6V6z')
export const Fwd5Icon = P('M4 18l8.5-6L4 6zm9-12v12l8.5-6z')
export const LinkIcon = P(
  'M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8.5 17.5a3 3 0 0 1-2.1-5.1l2-2a1 1 0 0 1 1.4 1.4l-2 2a1 1 0 0 0 1.4 1.4l2-2a1 1 0 0 1 1.4 1.4l-2 2a3 3 0 0 1-2.1.9zm5.6-3.9a1 1 0 0 1-.7-1.7l2-2a1 1 0 0 0-1.4-1.4l-2 2a1 1 0 0 1-1.4-1.4l2-2a3 3 0 0 1 4.2 4.2l-2 2a1 1 0 0 1-.7.3z',
)
export const TrashIcon = P('M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z')
export const CloseIcon = P('M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z')
