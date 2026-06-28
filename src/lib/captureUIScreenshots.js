import { capturePagePreview, resolveAppUrl } from './capturePagePreview'
import { captureFromLocalRepo, checkLocalServer } from './captureLocalApp'

export async function captureUIScreenshots(pr) {
  const apiUp = await checkLocalServer()
  if (!apiUp) {
    return {
      screenshots: [],
      captureMode: null,
      appUrl: null,
      jobId: null,
      error: 'Local API server not running — run npm run dev',
    }
  }

  const previewUrl = resolveAppUrl(null, pr)

  try {
    if (previewUrl) {
      const result = await capturePagePreview(previewUrl)
      return {
        screenshots: result.screenshots ?? [],
        captureMode: 'preview',
        appUrl: result.appUrl ?? previewUrl,
        jobId: result.jobId ?? null,
        error: null,
      }
    }

    const result = await captureFromLocalRepo(pr)
    return {
      screenshots: result.screenshots ?? [],
      captureMode: result.captureMode ?? 'local-build',
      appUrl: result.appUrl ?? null,
      jobId: result.jobId ?? null,
      error: null,
    }
  } catch (err) {
    return {
      screenshots: [],
      captureMode: previewUrl ? 'preview' : 'local-build',
      appUrl: previewUrl,
      jobId: null,
      error: err.message,
    }
  }
}
