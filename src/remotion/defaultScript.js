import { applySlideDurations, computePrMetrics } from './constants'

const prMetrics = computePrMetrics({ files: [{ additions: 24, deletions: 8 }] })

const rawSlides = [
  {
    id: 'hero',
    tag: 'Release',
    headline: 'Add dark mode to dashboard',
    body: 'PR #42 by @dev · owner/repo',
    visual: { type: 'hero' },
  },
  {
    id: 'app-screenshot-0',
    tag: 'Live UI',
    headline: 'App preview',
    body: 'preview.example.com',
    visual: {
      type: 'app-screenshot',
      imageUrl: null,
      alt: 'App preview',
    },
  },
  {
    id: 'component-0',
    tag: 'Updated component',
    headline: 'Dashboard.tsx',
    body: 'src/components/Dashboard.tsx · +24 / -8 lines',
    visual: {
      type: 'component-preview',
      filename: 'src/components/Dashboard.tsx',
      canPreview: true,
      previewCode:
        'function Dashboard() {\n  return <Card title="Dashboard"><Badge>Dark mode</Badge></Card>;\n}\nconst __previewProps = {};\nrender(<Dashboard {...__previewProps} />);',
      highlightLines: [],
      status: 'modified',
    },
  },
]

const slides = applySlideDurations(rawSlides, prMetrics, { screenshotCount: 1 })

export const defaultScript = {
  hook: 'Add dark mode to dashboard',
  componentSources: [
    { filename: 'src/components/Dashboard.tsx', status: 'modified' },
  ],
  componentCount: 1,
  changedFiles: [],
  uiFileCount: 1,
  hasScreenshots: true,
  estimatedDurationSec: Math.round(
    slides.reduce((n, s) => n + s.durationFrames, 0) / 30
  ),
  slides,
  caption: 'Dark mode components from the PR.',
  hashtags: ['opensource', 'owner', 'devtools'],
  tone: 'celebratory',
  confidence: 0.88,
  skip_reason: null,
  pr: { repo: 'owner/repo', number: 42 },
}
