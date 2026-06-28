import { existsSync } from 'fs'
import { join } from 'path'
import { callNodeLLM } from './nodeLlm.js'
import { parseLLMJson } from '../parseLLMJson.js'
import { normalizePromoInput } from './fetchPromoPR.js'

const SYSTEM = `You extract product launch details for a 15-second promotional video.
Return ONLY valid JSON with this shape:
{
  "productName": "string",
  "tagline": "short marketing tagline",
  "features": ["feature 1", "feature 2", "feature 3"],
  "assets": [{ "name": "logo|screenshot", "path": "relative/path" }],
  "brand": {
    "primaryColor": "#hex",
    "font": "Font name",
    "cta": "call to action text"
  }
}
Use available repo assets when they fit. Keep features punchy (3-5 words each).`

/**
 * Use LLM to refine promo fields from PR text + repo context.
 */
export async function extractPromoDataWithLLM(prInput, repoContext, { apiKey } = {}) {
  const user = `PR title: ${prInput.title}
PR description:
${prInput.description}

Available assets:
${repoContext.assets.join('\n') || '(none found)'}

Theme hints:
${JSON.stringify(repoContext.brandHints, null, 2)}

Existing remotion files:
${repoContext.remotionFiles.slice(0, 20).join('\n') || '(none)'}
`

  const text = await callNodeLLM({ system: SYSTEM, user, maxTokens: 1500, apiKey })
  const parsed = parseLLMJson(text, 'promo extraction')
  return normalizePromoInput({ ...prInput, ...parsed }, repoContext)
}

export function buildPromoProps(promoData, root) {
  const logoPath = promoData.assets?.find((a) => a.name === 'logo')?.path ?? ''
  const screenshotPath =
    promoData.assets?.find((a) => a.name === 'screenshot')?.path ??
    promoData.assets?.[0]?.path ??
    ''

  const resolveExisting = (p) => {
    if (!p || !root) return ''
    if (/^https?:\/\//.test(p)) return p
    return existsSync(join(root, p)) ? p : ''
  }

  return {
    productName: promoData.productName,
    tagline: promoData.tagline,
    features: promoData.features ?? [],
    logoPath: resolveExisting(logoPath),
    screenshotPath: resolveExisting(screenshotPath),
    primaryColor: promoData.brand?.primaryColor ?? '#4F46E5',
    font: promoData.brand?.font ?? 'Inter',
    cta: promoData.brand?.cta ?? 'Try it now',
  }
}
