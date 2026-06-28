import { callLLM } from '../llm'
import { formatCatalogForPrompt, resolveDemoComponent } from '../componentCatalog'
import { parseLLMJson } from '../parseLLMJson.js'

const SYSTEM_PROMPT = `You plan a 25-40 second product launch video from a GitHub PR.

The PR tells you WHAT to focus on. The full UI map tells you WHERE features live in the app.
Your job: write marketing copy and a STORYLINE of UI steps that show how a user discovers and uses the feature.

Video template: hero title → chained UI demo steps → payoff → outro (handled elsewhere).

STORY RULES:
- 2-4 demo steps that tell a coherent user journey
- Each step picks ONE component from the catalog to RENDER
- renderMode:
  - "page" = wide shot of a page/dashboard (user needs context)
  - "isolated" = zoom to a sub-component alone (button, form field, widget — when that's clearer)
  - "overlay" = modal/dialog on top of its parent page
- Trace the real UI hierarchy: page → trigger → modal → input → submit
- PR-changed components should appear in the story; unchanged parents give context
- contextPage: parent page name when rendering a child in page/overlay mode
- storyBeat: snake-case id (open-schedule-modal, type-team-name)
- beatType: type | click | select | reveal
- Do NOT output interactionPlan, demoBeats, or timings — a motion director handles that
- Never use revolutionize, game-changing, leverage, synergy, empower
- Return ONLY valid JSON, no markdown`

function buildPrompt(prData, catalog) {
  const catalogBlock = formatCatalogForPrompt(catalog)
  const changedList = Array.isArray(prData.changedFiles)
    ? prData.changedFiles.map((f) => `- ${typeof f === 'string' ? f : f.filename}`).join('\n')
    : '(unavailable)'

  const focusComponents = catalog.filter((c) => c.changedInPR).map((c) => c.name)
  const focusBlock =
    focusComponents.length > 0
      ? focusComponents.join(', ')
      : '(no UI components in PR diff — infer from description)'

  return `Plan the demo STORY for this PR video.

PR FOCUS — highlight these changes:
Repo: ${prData.repo}
PR #${prData.number}: ${prData.title}
Author: @${prData.author}
Description:
${prData.body || '(no description)'}

Changed files:
${changedList}

Components touched by PR: ${focusBlock}

FULL UI MAP (entire app — use to find pages, modals, sub-components):
${catalogBlock}

Return ONLY this JSON:
{
  "headline": "hero title",
  "keyBenefit": "payoff line",
  "hook": "opening hook",
  "caption": "social caption",
  "hashtags": ["tag1"],
  "accentColor": null,
  "confidence": 0.8,
  "skipReason": null,
  "beats": [
    {
      "component": "<exact catalog name to render>",
      "renderMode": "page",
      "contextPage": null,
      "beatType": "click",
      "storyBeat": "open-create-modal",
      "headline": "Start from the dashboard",
      "narration": "User lands on Schedules, clicks + New",
      "focusTarget": "trigger"
    }
  ]
}`
}

function fallbackPlan(catalog, prData) {
  const changed = catalog.filter((c) => c.changedInPR)
  const pool = changed.length > 0 ? changed : catalog

  const page = pool.find((c) => /Page$/i.test(c.name))
  const modal = pool.find((c) => /Modal$/i.test(c.name))
  const table = pool.find((c) => /Table$/i.test(c.name))
  const sub = pool.find((c) => !/Page$|Modal$|Table$/i.test(c.name))

  const beats = []

  if (page) {
    beats.push({
      component: page.name,
      renderMode: 'page',
      contextPage: null,
      beatType: 'click',
      storyBeat: 'establish-page',
      headline: page.name.replace(/([A-Z])/g, ' $1').trim(),
      narration: '',
      focusTarget: 'main',
    })
  }

  if (modal && page) {
    beats.push({
      component: modal.name,
      renderMode: 'overlay',
      contextPage: page.name,
      beatType: 'type',
      storyBeat: 'fill-modal',
      headline: modal.name.replace(/([A-Z])/g, ' $1').trim(),
      narration: '',
      focusTarget: 'input',
    })
  } else if (sub && page) {
    beats.push({
      component: sub.name,
      renderMode: 'isolated',
      contextPage: page.name,
      beatType: 'reveal',
      storyBeat: 'focus-widget',
      headline: sub.name.replace(/([A-Z])/g, ' $1').trim(),
      narration: '',
      focusTarget: 'main',
    })
  } else if (table) {
    beats.push({
      component: table.name,
      renderMode: 'page',
      contextPage: null,
      beatType: 'select',
      storyBeat: 'expand-row',
      headline: table.name.replace(/([A-Z])/g, ' $1').trim(),
      narration: '',
      focusTarget: 'expand',
    })
  } else {
    const pick = page ?? table ?? modal ?? pool[0]
    if (pick) {
      beats.push({
        component: pick.name,
        renderMode: /Page$/i.test(pick.name) ? 'page' : 'isolated',
        contextPage: null,
        beatType: 'reveal',
        storyBeat: 'feature-demo',
        headline: pick.name.replace(/([A-Z])/g, ' $1').trim(),
        narration: '',
        focusTarget: 'main',
      })
    }
  }

  return {
    headline: prData?.title ? `Now in ${prData.repo}` : 'Now available',
    keyBenefit: 'Ship faster',
    hook: prData?.title ?? 'See what shipped',
    caption: prData?.title ?? '',
    hashtags: ['shipping', 'product', 'update'],
    accentColor: null,
    confidence: 0.4,
    skipReason: 'Planner JSON failed — using catalog fallback',
    beats,
  }
}

function normalizeBeats(plan, catalog) {
  if (!Array.isArray(plan?.beats)) return plan

  const beats = plan.beats.map((beat) => {
    const component = resolveDemoComponent(beat.component, catalog) ?? beat.component
    const renderMode = ['page', 'isolated', 'overlay'].includes(beat.renderMode)
      ? beat.renderMode
      : inferRenderMode(component, beat, catalog)

    return {
      ...beat,
      component,
      renderMode,
      contextPage: beat.contextPage ? resolveDemoComponent(beat.contextPage, catalog) : null,
    }
  })

  return {
    ...plan,
    beats: beats.filter((b) => b.component && resolveDemoComponent(b.component, catalog)),
  }
}

function inferRenderMode(componentName, beat, catalog) {
  const meta = catalog.find((c) => c.name === componentName)
  if (/Modal$/i.test(componentName)) return 'overlay'
  if (/Page$/i.test(componentName)) return 'page'
  if (meta?.parentPages?.length && !beat.contextPage) return 'isolated'
  return meta?.kind === 'page' ? 'page' : 'isolated'
}

export async function runDemoStoryPlanner(prData, catalog) {
  try {
    const text = await callLLM({
      system: SYSTEM_PROMPT,
      user: buildPrompt(prData, catalog),
      maxTokens: 1400,
    })
    const plan = parseLLMJson(text, 'Demo story planner')
    const normalized = normalizeBeats(plan, catalog)
    if (!normalized.beats?.length) {
      console.warn('[demoStoryPlanner] No valid beats — using fallback')
      return fallbackPlan(catalog, prData)
    }
    return normalized
  } catch (err) {
    console.warn('[demoStoryPlanner] Parse failed, using fallback:', err.message)
    return fallbackPlan(catalog, prData)
  }
}

/** @deprecated use runDemoStoryPlanner */
export const runVideoPlanner = runDemoStoryPlanner
