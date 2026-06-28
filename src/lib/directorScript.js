import { callLLM } from './llm.js'
import { MAX_ACTIONS } from './validateScript.js'
import { buildDemoScene, formatDemoSceneForPrompt } from './demoScene.js'
import { parseLLMJson } from './parseLLMJson.js'
import { interactionPlanToActions, normalizeInteractionPlan } from './storyPlan.js'

const TARGET_HINTS = {
  trigger: 'primary CTA that opens or creates something (+ New, Add a redirect, etc.)',
  input: 'main text input field',
  submit: 'save/continue/submit button',
  expand: 'row expand chevron or expand control',
  dropdown: 'select / dropdown field',
  row: 'first data row in a table',
  main: 'center of the component body',
  button: 'any prominent button',
}

function truncateSource(source, max = 3500) {
  if (!source || source.length <= max) return source ?? ''
  return `${source.slice(0, max)}\n/* …truncated… */`
}

function parseDirectorJson(text) {
  return parseLLMJson(text, 'Motion director')
}

export function defaultActionsForKind(kind, name = '', narration = '') {
  const text = narration.toLowerCase()
  const isRedirect = /redirect/i.test(name) || /\bredirect\b/i.test(text)
  const demoText = isRedirect ? 'Holiday coverage' : 'Team standup hours'

  const createFlow = [
    { at: 0, type: 'idle', target: 'main' },
    { at: 0.35, type: 'hover', target: 'trigger' },
    { at: 0.65, type: 'hover', target: 'trigger' },
    { at: 1.0, type: 'click', target: 'trigger', effect: 'openModal' },
    { at: 1.65, type: 'type', target: 'input', text: demoText, effect: 'typeText' },
  ]

  if (kind === 'table' || /Table$/i.test(name)) {
    return [
      { at: 0.2, type: 'idle', target: 'main' },
      { at: 0.5, type: 'hover', target: 'expand' },
      { at: 0.95, type: 'click', target: 'expand', effect: 'expandRow' },
    ]
  }

  if (kind === 'modal' || /Modal$/i.test(name) || kind === 'page' || /Page$/i.test(name)) {
    return [
      ...createFlow,
      { at: 2.5, type: 'click', target: 'dropdown', effect: 'openDropdown' },
    ]
  }

  return [
    { at: 0.3, type: 'hover', target: 'main' },
    { at: 0.9, type: 'click', target: 'main' },
  ]
}

/**
 * Refine timings on an existing action list using component source.
 * Story phases come from storyDirector — this pass only tightens execution.
 */
export async function generateDemoActions(slide, component, { catalog = [] } = {}) {
  const plan = normalizeInteractionPlan(slide.interactionPlan)
  const fromPlan = plan.length > 0 ? interactionPlanToActions(plan, slide) : []
  const existing = Array.isArray(slide.actions) && slide.actions.length > 0 ? slide.actions : fromPlan
  const key = import.meta.env.VITE_ANTHROPIC_KEY
  const demoScene = slide.demoScene ?? buildDemoScene(slide.component ?? component?.name, catalog)

  if (!key || !component?.source) {
    return {
      actions: existing.length > 0 ? existing : defaultActionsForKind(component?.kind ?? 'component', component?.name, slide.narration),
      demoText: slide.demoText,
    }
  }

  const sceneElements = (demoScene?.elements ?? component.elements ?? [])
    .map((e) => `- [${e.component ?? component.name}] ${e.role}: "${e.label}"${e.id ? ` #${e.id}` : ''}`)
    .join('\n')

  const sceneSources = (demoScene?.components ?? [{ name: component.name, source: component.source }])
    .map((c) => {
      const src = catalog.find((x) => x.name === c.name)?.source ?? c.source ?? component.source
      return `--- ${c.name} ---\n${truncateSource(src, 2200)}`
    })
    .join('\n\n')

  const planBlock =
    plan.length > 0
      ? `\nSTORY PHASES (preserve order and element bindings):\n${plan.map((p) => {
          const el = p.element
          const elTag = el ? ` [${el.component} → ${el.label}]` : ''
          return `- ${p.phase} @ ${p.at}s → ${p.focusTarget ?? '?'}${elTag}: ${p.description}`
        }).join('\n')}`
      : ''

  try {
    const text = await callLLM({
      system: `You are a motion director converting a UI story into precise cursor keyframes.
Rules:
- Max ${MAX_ACTIONS} actions, spaced 0–4 seconds
- MUST preserve story order and element targets from STORY PHASES
- Each action target must match focusTarget from the bound element (trigger, input, submit, dropdown, expand, main)
- hover before click on same target
- type action needs text + effect "typeText"
- open modal: click trigger + effect "openModal"
- dropdown: click dropdown + effect "openDropdown"
- Return ONLY valid JSON`,
      user: `SLIDE:
headline: ${slide.headline}
narration: ${slide.narration ?? ''}
storyBeat: ${slide.storyBeat ?? 'demo'}
focus: ${slide.focus ?? 'isolated'}
${planBlock}

DEMO SCENE:
${formatDemoSceneForPrompt(demoScene)}

INTERACTIVE ELEMENTS:
${sceneElements || '(infer from source)'}

SOURCE (by component):
${sceneSources}

${existing.length > 0 ? `DRAFT ACTIONS (refine timings, keep story intent and targets):\n${JSON.stringify(existing, null, 2)}` : ''}

Return: { "actions": [{ "at": 0.35, "type": "hover", "target": "trigger" }, ...], "demoText": "..." }`,
      maxTokens: 900,
    })

    const result = parseDirectorJson(text)
    const actions = Array.isArray(result.actions) ? result.actions : existing
    return {
      actions: actions.slice(0, MAX_ACTIONS),
      demoText: result.demoText ?? slide.demoText,
    }
  } catch (e) {
    console.warn('[directorScript] LLM director failed:', e.message)
    return {
      actions:
        existing.length > 0
          ? existing
          : defaultActionsForKind(component.kind, component.name, slide.narration),
      demoText: slide.demoText,
    }
  }
}

export function mergeDirectorResult(slide, directorResult) {
  const actions = Array.isArray(directorResult)
    ? directorResult
    : directorResult?.actions ?? slide.actions

  return {
    ...slide,
    actions,
    ...(directorResult?.demoText ? { demoText: directorResult.demoText } : {}),
  }
}

export { TARGET_HINTS }
