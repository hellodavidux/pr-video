import { fetchPRFiles, fetchSourceBundle } from './fetchSource'
import { buildSlideSandboxes } from './buildSandbox'
import { fetchLocalSourceBundle, isLocalRepoAvailable, useLocalRepo } from './localRepo'

/**
 * End-to-end: load PR source (local cal-simple when available, else GitHub),
 * then write component closures for Remotion.
 */
export async function extractComponents(owner, repo, prNumber, headSha, script) {
  if (useLocalRepo() && (await isLocalRepoAvailable())) {
    console.log('[extractComponents] Using local cal-simple repo (skipping GitHub fetch)')
    const bundle = await fetchLocalSourceBundle()
    return buildSlideSandboxes(bundle, { ...script, useLocalRepo: true })
  }

  console.log('[extractComponents] Fetching PR source from GitHub…')
  const changedFiles = await fetchPRFiles(owner, repo, prNumber, headSha)

  if (changedFiles.length === 0) {
    console.warn('[extractComponents] No source files in PR')
    return script
  }

  const bundle = await fetchSourceBundle(owner, repo, headSha, changedFiles)
  return buildSlideSandboxes(bundle, script)
}
