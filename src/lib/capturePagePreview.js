import { captureAppScreenshots } from './captureAppScreenshot'
import { checkLocalServer } from './captureLocalApp'

export function resolveAppUrl(manualUrl, pr) {
  const manual = manualUrl?.trim()
  if (manual) {
    const withProtocol = /^https?:\/\//i.test(manual) ? manual : `https://${manual}`
    return new URL(withProtocol).href.replace(/\/$/, '')
  }
  if (pr.previewUrl) return pr.previewUrl.replace(/\/$/, '')
  return null
}

export async function capturePagePreview(appUrl) {
  const apiUp = await checkLocalServer()

  if (apiUp) {
    const res = await fetch('/api/screenshot-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: appUrl }),
    })
    if (res.ok) {
      return res.json()
    }
  }

  const { appUrl: normalized, screenshots } = await captureAppScreenshots(appUrl)
  return { jobId: null, appUrl: normalized, screenshots }
}
