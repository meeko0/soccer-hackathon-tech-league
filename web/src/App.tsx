import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Workspace } from './workspace/Workspace'

// Opens on the demo match; any SkillCorner open-data match id works in the URL.
const DEFAULT_MATCH = 1959846

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/m/:matchId" element={<Workspace />} />
        <Route path="/m/:matchId/c/:clipId" element={<Workspace />} />
        <Route path="*" element={<Navigate to={`/m/${DEFAULT_MATCH}`} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
