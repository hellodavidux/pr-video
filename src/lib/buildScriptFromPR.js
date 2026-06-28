import {
  applySlideDurations,
  computePrMetrics,
  getEstimatedDurationSec,
} from '../remotion/constants'
import {
  fileDisplayName,
  isUIFile,
  pickHighlightLines,
  summarizePatch,
} from './prFiles'
import { prepareComponentPreview } from './prepareComponentPreview'

const SKIP_TITLE_PATTERNS = /^(fix|chore|docs|test|ci|build)(\(|:|\s)/i
const MAX_COMPONENT_SLIDES = 6
const MAX_STYLE_SLIDES = 4
const MAX_SCREENSHOT_SLIDES = 3

function stripMarkdown(text) {
  if (!text || text === '(no description)') return ''
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(text, max) {
  if (!text || text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

function buildInjectedCss(styleSources) {
  return styleSources
    .filter((s) => s.source)
    .map((s) => `/* ${s.filename} */\n${s.source}`)
    .join('\n\n')
}

function inferTone(pr) {
  if (/feat|add|new|launch|ship/i.test(pr.title)) return 'celebratory'
  if (/refactor|perf|arch/i.test(pr.title)) return 'technical'
  if (/fix|patch|bug/i.test(pr.title)) return 'minimal'
  return 'informational'
}

function inferConfidence(pr, componentCount, styleCount, hasScreenshots) {
  if (SKIP_TITLE_PATTERNS.test(pr.title)) return 0.25
  if (hasScreenshots) return 0.9
  if (componentCount > 0) return 0.85
  if (styleCount > 0) return 0.7
  return 0.35
}

function inferSkipReason(componentCount, styleCount, hasScreenshots) {
  if (hasScreenshots || componentCount > 0 || styleCount > 0) return null
  return 'No React or CSS files changed in this PR'
}

function buildHashtags(pr) {
  const [owner] = pr.repo.split('/')
  const titleWord = pr.title.split(/\s+/).find((w) => w.length > 4)?.toLowerCase()
  const tags = ['opensource', owner?.toLowerCase(), 'devtools']
  if (titleWord) tags.push(titleWord.replace(/[^a-z0-9]/gi, ''))
  return [...new Set(tags.filter(Boolean))].slice(0, 4)
}

function slidesFromScreenshots(screenshots, appUrl) {
  return screenshots.slice(0, MAX_SCREENSHOT_SLIDES).map((shot, i) => ({
    id: `app-screenshot-${i}`,
    tag: i === 0 ? 'Live UI' : 'App view',
    headline: shot.label ?? 'App preview',
    body: appUrl ? truncate(appUrl.replace(/^https?:\/\//, ''), 80) : '',
    visual: {
      type: 'app-screenshot',
      imageUrl: shot.url,
      filePath: shot.filePath ?? null,
      alt: shot.label ?? 'App screenshot',
    },
  }))
}

function slideFromComponent(comp, index, injectedCss) {
  const prepared = prepareComponentPreview(comp.source, comp.filename)
  const name = fileDisplayName(comp.filename)

  return {
    id: `component-${index}`,
    tag: comp.status === 'added' ? 'New component' : 'Updated component',
    headline: name,
    body: `${comp.filename} · ${summarizePatch(comp.patch)}`,
    visual: {
      type: 'component-preview',
      filename: comp.filename,
      previewCode: prepared.previewCode,
      canPreview: prepared.canPreview,
      componentName: prepared.componentName,
      previewError: prepared.error,
      injectedCss,
      highlightLines: pickHighlightLines(comp.patch),
      status: comp.status,
      patch: comp.patch,
    },
  }
}

function slideFromCodeFile(file, index, tag) {
  return {
    id: `code-${index}`,
    tag,
    headline: fileDisplayName(file.filename),
    body: `${file.filename} · ${summarizePatch(file.patch)}`,
    visual: {
      type: 'code-change',
      filename: file.filename,
      highlightLines: pickHighlightLines(file.patch, 18),
      status: file.status,
      patch: file.patch,
    },
  }
}

function slideFromStyle(file, index) {
  const tag =
    file.status === 'added'
      ? 'New styles'
      : file.status === 'removed'
        ? 'Removed styles'
        : 'Style changes'
  return slideFromCodeFile(file, index, tag)
}

function buildSlides(
  pr,
  { componentSources, styleSources, screenshots = [], appUrl = null }
) {
  const slides = []
  const bodyText = stripMarkdown(pr.body)
  const heroBody =
    truncate(bodyText, 160) ||
    `PR #${pr.number} by @${pr.author} · ${pr.repo}`
  const hasSummarySlide = bodyText.length > 80

  slides.push({
    id: 'hero',
    tag: 'Release',
    headline: pr.title,
    body: heroBody,
    visual: { type: 'hero' },
  })

  if (hasSummarySlide) {
    slides.push({
      id: 'summary',
      tag: 'Overview',
      headline: "What's changing",
      body: truncate(bodyText, 280),
      visual: { type: 'summary' },
    })
  }

  if (screenshots.length > 0) {
    slides.push(...slidesFromScreenshots(screenshots, appUrl))
  }

  const injectedCss = buildInjectedCss(styleSources)

  const components = componentSources.slice(0, MAX_COMPONENT_SLIDES)
  for (const [i, comp] of components.entries()) {
    if (comp.source) {
      slides.push(slideFromComponent(comp, i, injectedCss))
    } else {
      slides.push(
        slideFromCodeFile(
          comp,
          i,
          comp.status === 'added' ? 'New component' : 'Component change'
        )
      )
    }
  }

  const styles = styleSources.slice(0, MAX_STYLE_SLIDES)
  for (const [i, file] of styles.entries()) {
    slides.push(slideFromStyle(file, i))
  }

  const needsFallback = !slides.some(
    (s) =>
      s.visual?.type === 'app-screenshot' ||
      s.visual?.type === 'component-preview' ||
      (s.visual?.type === 'code-change' && s.id !== 'fallback')
  )

  if (needsFallback) {
    slides.push({
      id: 'fallback',
      tag: 'Tip',
      headline: 'No UI files in this PR',
      body: 'Slides are built from changed React components and CSS. Try a PR that touches .tsx, .jsx, or .css files.',
      visual: {
        type: 'code-change',
        filename: 'src/example.tsx',
        highlightLines: [
          { text: 'export function Feature() {', type: 'add' },
          { text: '  return <Card title="New feature" />', type: 'add' },
          { text: '}', type: 'add' },
        ],
        status: 'added',
      },
    })
  }

  return { slides, hasSummarySlide, screenshotCount: screenshots.length }
}

export function buildScriptFromPR(
  pr,
  {
    componentSources = [],
    styleSources = [],
    screenshots = [],
    appUrl = null,
    captureMode = null,
    captureJobId = null,
    captureError = null,
  } = {}
) {
  const uiFiles = (pr.files ?? []).filter(isUIFile)
  const loadedComponents = componentSources.filter((c) => c.source)
  const hasScreenshots = screenshots.length > 0
  const prMetrics = computePrMetrics(pr)
  const { slides: rawSlides, hasSummarySlide, screenshotCount } = buildSlides(pr, {
    componentSources,
    styleSources,
    screenshots,
    appUrl,
  })

  const slides = applySlideDurations(rawSlides, prMetrics, {
    screenshotCount,
    hasBodySummary: hasSummarySlide || Boolean(stripMarkdown(pr.body)),
  })

  const tone = inferTone(pr)

  return {
    hook: pr.title,
    slides,
    pr: {
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      author: pr.author,
      url: pr.url,
    },
    prMetrics,
    estimatedDurationSec: getEstimatedDurationSec(slides),
    componentSources,
    styleSources,
    changedFiles: pr.files ?? [],
    uiFileCount: uiFiles.length,
    componentCount: loadedComponents.length,
    styleCount: styleSources.length,
    captureMode,
    captureJobId,
    captureError,
    hasScreenshots,
    caption: `${pr.title} — ${pr.repo} PR #${pr.number} by @${pr.author}`,
    hashtags: buildHashtags(pr),
    tone,
    confidence: inferConfidence(
      pr,
      loadedComponents.length,
      styleSources.length,
      hasScreenshots
    ),
    skip_reason: inferSkipReason(
      loadedComponents.length,
      styleSources.length,
      hasScreenshots
    ),
  }
}
