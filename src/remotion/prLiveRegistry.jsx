/* Auto-generated — do not edit. Rebuilt when PR components are written. */
import Slide_s0 from './pr-live/s0/entry.jsx'
import Slide_s1 from './pr-live/s1/entry.jsx'
import Slide_s2 from './pr-live/s2/entry.jsx'
import Slide_s3 from './pr-live/s3/entry.jsx'
import Slide_s4 from './pr-live/s4/entry.jsx'

export const PR_LIVE_REGISTRY_VERSION = 1782640307922

const REGISTRY = {
  's0': Slide_s0,
  's1': Slide_s1,
  's2': Slide_s2,
  's3': Slide_s3,
  's4': Slide_s4,
}

export function getPrLiveComponent(slideId) {
  return REGISTRY[slideId] ?? null
}

export function hasPrLiveComponent(slideId) {
  return Object.prototype.hasOwnProperty.call(REGISTRY, slideId)
}
