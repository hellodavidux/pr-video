import { PR_VIDEO_FPS } from '../remotion/constants.js'
import previewMeta from './localDemoPreview.json'

/** Demo slides for local cal-simple Ask Cal feature */
export const LOCAL_CAL_DEMO_SLIDES = [
  {
    id: 's0',
    role: 'hero',
    type: 'title',
    layout: 'linear-hero',
    headline: 'Meet Ask Cal',
    durationSec: 3,
    transition: { style: 'zoom-through', durationFrames: 12 },
    preview: { slideId: 's0' },
  },
  {
    id: 's1',
    role: 'demo',
    type: 'demo',
    layout: 'linear-input',
    beatType: 'click',
    headline: 'Open Ask Cal',
    component: 'AskCalFab',
    durationSec: 5,
    continuesFrom: 's0',
    sharedViewport: true,
    preview: { slideId: 's1' },
  },
  {
    id: 's2',
    role: 'demo',
    type: 'demo',
    layout: 'linear-response',
    beatType: 'reveal',
    headline: 'Suggested prompts',
    component: 'SuggestedPrompts',
    durationSec: 5,
    continuesFrom: 's1',
    sharedViewport: true,
    preview: { slideId: 's2' },
  },
  {
    id: 's3',
    role: 'demo',
    type: 'demo',
    layout: 'linear-response',
    beatType: 'reveal',
    headline: 'Thinking…',
    component: 'ThinkingIndicator',
    durationSec: 5,
    continuesFrom: 's2',
    sharedViewport: true,
    preview: { slideId: 's3' },
  },
  {
    id: 's4',
    role: 'demo',
    type: 'demo',
    layout: 'linear-response',
    beatType: 'reveal',
    headline: 'Message actions',
    component: 'MessageActions',
    durationSec: 5,
    continuesFrom: 's3',
    sharedViewport: true,
    preview: { slideId: 's4' },
  },
  {
    id: 's5',
    role: 'payoff',
    type: 'text',
    layout: 'linear-payoff',
    headline: 'AI scheduling built in',
    durationSec: 4,
    transition: { style: 'dissolve', durationFrames: 10 },
  },
  {
    id: 's6',
    role: 'outro',
    type: 'title',
    layout: 'linear-outro',
    headline: null,
    durationSec: 3,
    transition: { style: 'dissolve', durationFrames: 8 },
  },
]

function payoffHeadline(prScript) {
  const hook = prScript?.hook?.trim()
  if (!hook) return 'AI scheduling built in'
  return hook.split(/\s+/).slice(0, 5).join(' ')
}

export function buildLocalDemoScript(meta = previewMeta, prScript = null) {
  const slides = LOCAL_CAL_DEMO_SLIDES.map((slide) => {
    const slideMeta = meta[slide.id]
    let next = { ...slide }

    if (prScript?.hook && slide.id === 's0') {
      next.headline = prScript.hook
    }
    if (slide.id === 's5') {
      next.headline = payoffHeadline(prScript)
    }

    if (!slideMeta) {
      return { ...next, durationFrames: next.durationSec * PR_VIDEO_FPS }
    }

    return {
      ...next,
      durationFrames: next.durationSec * PR_VIDEO_FPS,
      preview: next.preview ? { ...next.preview, ...slideMeta } : undefined,
    }
  })

  return {
    hook: prScript?.hook ?? 'Ask Cal — AI scheduling assistant',
    caption: prScript?.caption ?? '',
    hashtags: prScript?.hashtags ?? [],
    slides,
    pr: prScript?.pr ?? {
      repo: 'cal-simple',
      number: 1,
      title: 'feat: Ask Cal widget',
      author: 'local',
      url: 'http://localhost',
    },
    theme: {
      accentColor: '#a5b4fc',
      background: '#0a0a0a',
    },
    estimatedDurationSec: slides.reduce((n, s) => n + s.durationSec, 0),
    useLocalRepo: true,
    sourceScript: prScript ?? null,
  }
}

export const DEFAULT_LOCAL_DEMO_SCRIPT = buildLocalDemoScript()
