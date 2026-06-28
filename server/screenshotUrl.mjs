import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { CAPTURES_DIR } from './paths.mjs'

function normalizeUrl(url) {
  const trimmed = url.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return new URL(withProtocol).href
}

export async function screenshotUrl(url, jobId) {
  const target = normalizeUrl(url)
  const captureDir = join(CAPTURES_DIR, jobId)
  await mkdir(captureDir, { recursive: true })
  const screenshotPath = join(captureDir, 'page.png')

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await page.goto(target, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: screenshotPath, type: 'png', fullPage: false })
  } finally {
    await browser.close()
  }

  return {
    jobId,
    appUrl: target,
    screenshots: [
      {
        url: `/captures/${jobId}/page.png`,
        filePath: screenshotPath,
        label: 'App page',
        source: target,
      },
    ],
  }
}
