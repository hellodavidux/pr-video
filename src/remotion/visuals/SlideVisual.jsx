import { HeroVisual } from './HeroVisual'
import { CodeChangeVisual } from './CodeChangeVisual'
import { ComponentPreviewVisual } from './ComponentPreviewVisual'
import { ImageVisual } from './ImageVisual'

export function SlideVisual({ slide, repo, size = 'sm' }) {
  const visual = slide.visual ?? { type: 'code-change', filename: 'unknown', highlightLines: [] }

  if (visual.type === 'hero' || visual.type === 'summary') {
    return <HeroVisual headline={slide.headline} body={slide.body} repo={repo} size={size} />
  }

  if (visual.type === 'app-screenshot' || visual.type === 'image') {
    return (
      <ImageVisual
        imageUrl={visual.imageUrl}
        alt={visual.alt ?? slide.headline}
        size={size}
      />
    )
  }

  if (visual.type === 'component-preview') {
    return (
      <ComponentPreviewVisual
        previewCode={visual.previewCode}
        filename={visual.filename}
        canPreview={visual.canPreview}
        highlightLines={visual.highlightLines}
        status={visual.status}
        injectedCss={visual.injectedCss}
        size={size}
      />
    )
  }

  if (visual.type === 'code-change' || visual.type === 'live-preview') {
    return (
      <CodeChangeVisual
        filename={visual.filename ?? slide.headline}
        highlightLines={visual.highlightLines ?? []}
        status={visual.status ?? 'modified'}
        size={size}
      />
    )
  }

  return (
    <CodeChangeVisual
      filename={slide.headline}
      highlightLines={[]}
      status="modified"
      size={size}
    />
  )
}
