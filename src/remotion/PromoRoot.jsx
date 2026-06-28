import { registerRoot, Composition } from 'remotion'
import PromotionalVideo, {
  PROMO_DURATION_FRAMES,
  PROMO_FPS,
  PROMO_HEIGHT,
  PROMO_WIDTH,
} from '../videos/PromotionalVideo.jsx'
import { DEFAULT_PROMO_PROPS } from '../videos/promoProps.js'

function PromoRoot() {
  return (
    <Composition
      id="promo-video"
      component={PromotionalVideo}
      fps={PROMO_FPS}
      width={PROMO_WIDTH}
      height={PROMO_HEIGHT}
      durationInFrames={PROMO_DURATION_FRAMES}
      defaultProps={DEFAULT_PROMO_PROPS}
    />
  )
}

registerRoot(PromoRoot)
