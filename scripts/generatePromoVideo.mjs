#!/usr/bin/env node
/**
 * Generate a 15-second promotional Remotion video from a GitHub PR or local JSON.
 *
 * Usage:
 *   node scripts/generatePromoVideo.mjs --json pr.example.json
 *   node scripts/generatePromoVideo.mjs --pr-url https://github.com/owner/repo/pull/42
 *   node scripts/generatePromoVideo.mjs --json pr.json --generate-code
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { scanRepoContext } from '../src/lib/promo/scanRepoContext.js'
import { fetchPromoPR, normalizePromoInput } from '../src/lib/promo/fetchPromoPR.js'
import { extractPromoDataWithLLM, buildPromoProps } from '../src/lib/promo/extractPromoData.js'
import { callNodeLLM, stripCodeFences } from '../src/lib/promo/nodeLlm.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  try {
    const env = readFileSync(resolve(root, '.env'), 'utf8')
    for (const line of env.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch {
  }
}

function parseArgs(argv) {
  const args = { json: null, prUrl: null, generateCode: false, skipLlm: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = argv[++i]
    else if (a === '--pr-url') args.prUrl = argv[++i]
    else if (a === '--generate-code') args.generateCode = true
    else if (a === '--skip-llm') args.skipLlm = true
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

function writePromoProps(props) {
  const outPath = resolve(root, 'src/videos/promoProps.js')
  const body = `/**
 * Default props for PromotionalVideo — overwritten by scripts/generatePromoVideo.mjs
 */
export const DEFAULT_PROMO_PROPS = ${JSON.stringify(props, null, 2)}
`
  writeFileSync(outPath, body, 'utf8')
  console.log('[generatePromoVideo] Wrote', outPath)
}

async function generateRemotionCode(promoData, repoContext, props) {
  const templatePath = resolve(root, 'src/videos/PromotionalVideo.jsx')
  const template = readFileSync(templatePath, 'utf8')

  const system = `You are a Remotion expert. Generate a single React JSX file for a 15-second promotional video.
Requirements:
- 1920x1080, 30 FPS, 450 frames total
- Scenes: Hook (0-3s), Features (3-10s), CTA (10-15s)
- Use remotion imports: AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Img
- Export default PromotionalVideo component and named exports PROMO_DURATION_FRAMES, PROMO_FPS, PROMO_WIDTH, PROMO_HEIGHT
- Accept props: productName, tagline, features, logoPath, screenshotPath, primaryColor, font, cta
- Use fade/slide/scale animations
- Return ONLY the JSX source code, no markdown fences`

  const user = `PR promo data:
${JSON.stringify(promoData, null, 2)}

Computed props:
${JSON.stringify(props, null, 2)}

Repo context:
- Assets: ${repoContext.assets.slice(0, 30).join(', ') || 'none'}
- Remotion files: ${repoContext.remotionFiles.slice(0, 15).join(', ') || 'none'}

Reference template (improve animations and layout, keep the same prop interface):
${template.slice(0, 4000)}
`

  const code = stripCodeFences(await callNodeLLM({ system, user, maxTokens: 8000 }))
  const outPath = resolve(root, 'src/videos/PromotionalVideo.jsx')
  writeFileSync(outPath, code, 'utf8')
  console.log('[generatePromoVideo] Wrote AI-generated', outPath)
}

async function main() {
  loadEnv()
  const args = parseArgs(process.argv)

  if (args.help) {
    console.log(`Usage:
  node scripts/generatePromoVideo.mjs --json <path>
  node scripts/generatePromoVideo.mjs --pr-url <github-pr-url>
  Options:
    --generate-code   Ask LLM to rewrite PromotionalVideo.jsx
    --skip-llm        Skip LLM extraction (use raw JSON / PR text only)`)
    process.exit(0)
  }

  const repoContext = scanRepoContext(root)
  console.log('[generatePromoVideo] Scanned repo:', {
    assets: repoContext.assets.length,
    remotionFiles: repoContext.remotionFiles.length,
    themePath: repoContext.themePath,
  })

  let prInput
  if (args.json) {
    const raw = JSON.parse(readFileSync(resolve(root, args.json), 'utf8'))
    prInput = { title: raw.title, description: raw.description ?? '', ...raw }
  } else if (args.prUrl) {
    const token = process.env.VITE_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN
    prInput = await fetchPromoPR(args.prUrl, token)
  } else {
    const fallback = resolve(root, 'pr.example.json')
    console.log('[generatePromoVideo] No input — using', fallback)
    prInput = JSON.parse(readFileSync(fallback, 'utf8'))
  }

  let promoData
  if (args.skipLlm) {
    promoData = normalizePromoInput(prInput, repoContext)
  } else {
    try {
      promoData = await extractPromoDataWithLLM(prInput, repoContext)
    } catch (err) {
      console.warn('[generatePromoVideo] LLM extraction failed, using heuristics:', err.message)
      promoData = normalizePromoInput(prInput, repoContext)
    }
  }

  const props = buildPromoProps(promoData, root)
  writePromoProps(props)

  const manifestPath = resolve(root, 'src/videos/promo-manifest.json')
  writeFileSync(
    manifestPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), promoData, props }, null, 2),
    'utf8',
  )
  console.log('[generatePromoVideo] Wrote', manifestPath)

  if (args.generateCode) {
    await generateRemotionCode(promoData, repoContext, props)
  }

  console.log('[generatePromoVideo] Done. Preview with: npm run promo:preview')
}

main().catch((err) => {
  console.error('[generatePromoVideo] Failed:', err.message)
  process.exit(1)
})
