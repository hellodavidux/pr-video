import { buildLocalDemoScript } from './localDemoScript.js'
import { extractComponents } from './extractComponents.js'
import { isLocalRepoAvailable, useLocalRepo } from './localRepo.js'

/**
 * Turn the step-2 PR script into the linear demo video script (cal-simple components).
 */
export async function prepareVideoScript(approvedScript) {
  const demoBase = buildLocalDemoScript(undefined, approvedScript)

  if (useLocalRepo() && (await isLocalRepoAvailable())) {
    return extractComponents(null, null, null, null, demoBase)
  }

  const pr = approvedScript?.pr
  if (pr?.repo && pr?.number) {
    const [owner, repo] = pr.repo.split('/')
    return extractComponents(owner, repo, pr.number, approvedScript.headSha, demoBase)
  }

  return demoBase
}
