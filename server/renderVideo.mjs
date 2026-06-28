import { execFile as execFileCb } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'
import { ROOT, RENDERS_DIR } from './paths.mjs'
import { resolveScriptForRender } from './resolveScriptForRender.mjs'

const execFile = promisify(execFileCb)

export async function renderVideo(script, _apiPort) {
  const renderId = `render-${Date.now()}`
  const renderDir = join(RENDERS_DIR, renderId)
  await mkdir(renderDir, { recursive: true })

  const propsPath = join(renderDir, 'props.json')
  const resolvedScript = resolveScriptForRender(script, _apiPort)
  await writeFile(propsPath, JSON.stringify({ script: resolvedScript }))

  const outPath = join(renderDir, 'video.mp4')

  await execFile(
    'npx',
    [
      'remotion',
      'render',
      'src/remotion/DemoRoot.jsx',
      'cal-simple-demo',
      outPath,
      `--props=${propsPath}`,
    ],
    {
      cwd: ROOT,
      shell: true,
      timeout: 600000,
      env: { ...process.env, NODE_ENV: 'production' },
    }
  )

  return {
    renderId,
    videoPath: outPath,
    videoUrl: `/renders/${renderId}/video.mp4`,
  }
}
