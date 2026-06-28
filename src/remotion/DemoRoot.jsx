import { registerRoot, Composition } from 'remotion'
import { LinearPRVideo, getLinearVideoDurationInFrames } from './LinearPRVideo.jsx'
import { DEFAULT_LOCAL_DEMO_SCRIPT } from '../lib/localDemoScript.js'
import { COMPOSITION_HEIGHT, COMPOSITION_WIDTH, PR_VIDEO_FPS } from './constants.js'

function DemoRoot() {
  const durationInFrames = getLinearVideoDurationInFrames(DEFAULT_LOCAL_DEMO_SCRIPT.slides)

  return (
    <Composition
      id="cal-simple-demo"
      component={LinearPRVideo}
      fps={PR_VIDEO_FPS}
      width={COMPOSITION_WIDTH}
      height={COMPOSITION_HEIGHT}
      durationInFrames={durationInFrames}
      defaultProps={{ script: DEFAULT_LOCAL_DEMO_SCRIPT }}
      calculateMetadata={({ props }) => ({
        durationInFrames: getLinearVideoDurationInFrames(props.script?.slides ?? []),
      })}
    />
  )
}

registerRoot(DemoRoot)
