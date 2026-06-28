import { AbsoluteFill, Sequence } from 'remotion'
import PRSlide from './PRSlide.jsx'
import { PR_VIDEO_FPS } from './constants.js'

function slideDurationFrames(slide) {
  if (slide.durationFrames) return slide.durationFrames
  if (slide.durationSec) return Math.round(slide.durationSec * PR_VIDEO_FPS)
  return 5 * PR_VIDEO_FPS
}

export function LinearPRVideo({ script }) {
  const slides = script?.slides ?? []
  let from = 0

  return (
    <AbsoluteFill style={{ background: '#0a0a0a' }}>
      {slides.map((slide) => {
        const duration = slideDurationFrames(slide)
        const sequence = (
          <Sequence key={slide.id} from={from} durationInFrames={duration} name={slide.id}>
            <PRSlide slide={slide} pr={script?.pr} theme={script?.theme} />
          </Sequence>
        )
        from += duration
        return sequence
      })}
    </AbsoluteFill>
  )
}

export function getLinearVideoDurationInFrames(slides) {
  if (!slides?.length) return 30 * PR_VIDEO_FPS
  return slides.reduce((n, s) => n + slideDurationFrames(s), 0)
}
