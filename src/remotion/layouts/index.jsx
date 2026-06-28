import LinearHeroSlide from './LinearHeroSlide.jsx'
import LinearInputBeat from './LinearInputBeat.jsx'
import LinearResponseBeat from './LinearResponseBeat.jsx'
import LinearCodeDepthBeat from './LinearCodeDepthBeat.jsx'
import LinearPayoffSlide from './LinearPayoffSlide.jsx'
import LinearOutroSlide from './LinearOutroSlide.jsx'

const LAYOUT_MAP = {
  'linear-hero': LinearHeroSlide,
  'linear-input': LinearInputBeat,
  'linear-response': LinearResponseBeat,
  'linear-code-depth': LinearCodeDepthBeat,
  'linear-payoff': LinearPayoffSlide,
  'linear-outro': LinearOutroSlide,
}

export function resolveLinearLayout(slide) {
  if (slide.layout && LAYOUT_MAP[slide.layout]) {
    return LAYOUT_MAP[slide.layout]
  }
  if (slide.role === 'hero') return LinearHeroSlide
  if (slide.role === 'payoff') return LinearPayoffSlide
  if (slide.role === 'outro') return LinearOutroSlide
  if (slide.role === 'demo') {
    if (slide.layout === 'linear-code-depth') return LinearCodeDepthBeat
    if (slide.beatType === 'type' || slide.beatType === 'click' || slide.beatType === 'select') {
      return LinearInputBeat
    }
    return LinearResponseBeat
  }
  return null
}

export {
  LinearHeroSlide,
  LinearInputBeat,
  LinearResponseBeat,
  LinearCodeDepthBeat,
  LinearPayoffSlide,
  LinearOutroSlide,
}
