#!/usr/bin/env node
/**
 * Build pr-live slide entries from the local cal-simple folder (no GitHub fetch).
 *
 * Run: node scripts/setupLocalDemo.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  buildLocalSourceBundle,
  rebuildPrLiveRegistry,
  writePrComponents,
} from '../server/localRepo.mjs'
import { buildSlideSandboxes, setPrLiveWriters, resetPrLiveWriters } from '../src/lib/buildSandbox.js'
import { preparePrComponentFiles } from '../src/lib/buildRemotionEntry.js'
import { buildLocalDemoScript } from '../src/lib/localDemoScript.js'

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
    // no .env
  }
}

async function main() {
  loadEnv()

  const bundle = buildLocalSourceBundle()
  const script = buildLocalDemoScript()

  setPrLiveWriters({
    postComponents: async (slideId, files, component, slide) => {
      const { filesToWrite, demoScript } = preparePrComponentFiles(files, component, slide)
      writePrComponents(slideId, filesToWrite)
      return { slideId, demoScript }
    },
    finalizeRegistry: async () => rebuildPrLiveRegistry(),
  })

  let result
  try {
    result = await buildSlideSandboxes(bundle, script)
  } finally {
    resetPrLiveWriters()
  }

  const previewMeta = {}
  for (const slide of result.slides) {
    if (slide.preview?.slideId) {
      previewMeta[slide.id] = {
        slideId: slide.preview.slideId,
        styles: slide.preview.styles,
        tailwindConfig: slide.preview.tailwindConfig,
        demoScript: slide.preview.demoScript,
        registryVersion: slide.preview.registryVersion,
      }
    }
  }

  const previewPath = resolve(root, 'src/lib/localDemoPreview.json')
  writeFileSync(previewPath, JSON.stringify(previewMeta, null, 2), 'utf8')
  console.log('[setupLocalDemo] Wrote', previewPath)

  console.log('[setupLocalDemo] Wrote pr-live slides:', Object.keys(previewMeta).join(', '))
  console.log('[setupLocalDemo] Registry version:', result.prLiveRegistryVersion)
  console.log('[setupLocalDemo] Preview: npm run remotion:demo')
}

main().catch((err) => {
  console.error('[setupLocalDemo] Failed:', err.message)
  process.exit(1)
})
