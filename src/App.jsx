import { useState } from 'react'
import RepoInput from './views/RepoInput'
import ScriptReview from './views/ScriptReview'
import VideoPlayer from './views/VideoPlayer'
import './App.css'

export default function App() {
  const [view, setView] = useState('input')
  const [prData, setPrData] = useState(null)
  const [script, setScript] = useState(null)

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">PR → Video</span>
        <div className="app-steps">
          <span className={view === 'input'  ? 'step active' : 'step'}>1. Repo</span>
          <span className="step-divider">›</span>
          <span className={view === 'review' ? 'step active' : 'step'}>2. Script</span>
          <span className="step-divider">›</span>
          <span className={view === 'video'  ? 'step active' : 'step'}>3. Generate video</span>
        </div>
      </header>

      {view === 'input' && (
        <RepoInput
          onFetched={({ pr, script: builtScript }) => {
            setPrData({ pr, script: builtScript })
            setView('review')
          }}
        />
      )}

      {view === 'review' && prData && (
        <ScriptReview
          prData={prData}
          onApproved={(approvedScript) => {
            setScript(approvedScript)
            setView('video')
          }}
        />
      )}

      {view === 'video' && script && <VideoPlayer script={script} />}
    </div>
  )
}
