import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

function resolveAsset(path) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const cleaned = path.replace(/^public\//, '').replace(/^src\/assets\//, 'assets/')
  return staticFile(cleaned)
}

const HOOK_END = 90
const FEATURES_END = 300
const TOTAL_FRAMES = 450

function FadeSlide({ children, startFrame, style }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
  })
  const opacity = interpolate(progress, [0, 1], [0, 1])
  const y = interpolate(progress, [0, 1], [28, 0])

  return (
    <div style={{ ...style, opacity, transform: `translateY(${y}px)` }}>{children}</div>
  )
}

function HookScene({ productName, tagline, logoPath, primaryColor, font }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } })

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg, #0f0f12 0%, #1a1a24 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: `'${font}', system-ui, sans-serif`,
        color: '#fff',
        padding: 80,
      }}
    >
      {logoPath ? (
        <Img
          src={resolveAsset(logoPath)}
          style={{
            width: 160,
            height: 160,
            objectFit: 'contain',
            marginBottom: 40,
            transform: `scale(${logoScale})`,
            opacity: logoScale,
          }}
        />
      ) : (
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            background: primaryColor,
            marginBottom: 40,
            transform: `scale(${logoScale})`,
            opacity: logoScale,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 42,
            fontWeight: 700,
          }}
        >
          {productName.charAt(0)}
        </div>
      )}
      <FadeSlide startFrame={12}>
        <h1
          style={{
            margin: 0,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            textAlign: 'center',
            color: primaryColor,
          }}
        >
          {productName}
        </h1>
      </FadeSlide>
      <FadeSlide startFrame={28} style={{ marginTop: 24, maxWidth: 900 }}>
        <p
          style={{
            margin: 0,
            fontSize: 32,
            lineHeight: 1.4,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          {tagline}
        </p>
      </FadeSlide>
    </AbsoluteFill>
  )
}

function FeaturesScene({ features, screenshotPath, primaryColor, font }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const sceneFrame = frame - HOOK_END
  const featureDuration = Math.floor((FEATURES_END - HOOK_END) / Math.max(features.length, 1))
  const featureIndex = Math.min(
    Math.floor(sceneFrame / featureDuration),
    Math.max(features.length - 1, 0),
  )
  const localFrame = sceneFrame - featureIndex * featureDuration
  const featureOpacity = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 140 },
  })

  const feature = features[featureIndex] ?? 'New capabilities'

  return (
    <AbsoluteFill
      style={{
        background: '#0a0a0a',
        fontFamily: `'${font}', system-ui, sans-serif`,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 64,
        padding: 80,
      }}
    >
      <div style={{ flex: 1, opacity: featureOpacity, transform: `translateX(${interpolate(featureOpacity, [0, 1], [-40, 0])}px)` }}>
        <p style={{ margin: '0 0 16px', fontSize: 20, color: primaryColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Feature {featureIndex + 1}
        </p>
        <h2 style={{ margin: 0, fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1.15 }}>
          {feature}
        </h2>
      </div>
      {screenshotPath ? (
        <div
          style={{
            flex: 1.2,
            opacity: featureOpacity,
            transform: `scale(${interpolate(featureOpacity, [0, 1], [0.92, 1])})`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: `0 24px 80px ${primaryColor}33`,
            border: `1px solid ${primaryColor}44`,
          }}
        >
          <Img src={resolveAsset(screenshotPath)} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      ) : (
        <div
          style={{
            flex: 1.2,
            height: 420,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}55)`,
            border: `1px solid ${primaryColor}55`,
            opacity: featureOpacity,
          }}
        />
      )}
    </AbsoluteFill>
  )
}

function CTAScene({ cta, primaryColor, font, productName }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const sceneFrame = frame - FEATURES_END
  const pulse = spring({ frame: sceneFrame, fps, config: { damping: 14, stiffness: 90 } })
  const btnScale = interpolate(pulse, [0, 1], [0.85, 1])

  return (
    <AbsoluteFill
      style={{
        background: primaryColor,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: `'${font}', system-ui, sans-serif`,
        padding: 80,
      }}
    >
      <FadeSlide startFrame={0}>
        <h2
          style={{
            margin: '0 0 32px',
            fontSize: 64,
            fontWeight: 700,
            color: '#fff',
            textAlign: 'center',
            maxWidth: 1100,
            lineHeight: 1.15,
          }}
        >
          {cta}
        </h2>
      </FadeSlide>
      <div
        style={{
          transform: `scale(${btnScale})`,
          opacity: pulse,
          background: '#fff',
          color: primaryColor,
          padding: '20px 48px',
          borderRadius: 12,
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {productName}
      </div>
      {/* Placeholder for background music track */}
      {/* <Audio src={staticFile('audio/promo-bg.mp3')} /> */}
    </AbsoluteFill>
  )
}

export default function PromotionalVideo({
  productName,
  tagline,
  features,
  logoPath,
  screenshotPath,
  primaryColor,
  font,
  cta,
}) {
  const frame = useCurrentFrame()

  if (frame < HOOK_END) {
    return (
      <HookScene
        productName={productName}
        tagline={tagline}
        logoPath={logoPath}
        primaryColor={primaryColor}
        font={font}
      />
    )
  }

  if (frame < FEATURES_END) {
    return (
      <FeaturesScene
        features={features}
        screenshotPath={screenshotPath}
        primaryColor={primaryColor}
        font={font}
      />
    )
  }

  return (
    <CTAScene cta={cta} primaryColor={primaryColor} font={font} productName={productName} />
  )
}

export const PROMO_DURATION_FRAMES = TOTAL_FRAMES
export const PROMO_FPS = 30
export const PROMO_WIDTH = 1920
export const PROMO_HEIGHT = 1080
