import { callLLM } from '../llm'
import { bindInteractionPlanToScene, buildDemoScene, formatDemoSceneForPrompt } from '../demoScene.js'
import { resolveDemoComponent } from '../componentCatalog.js'
import {
  demoDurationFromBeats,
  formatBeatsForPrompt,
  interactionPlanToBeats,
  normalizeDemoBeats,
} from '../demoBeatSchema.js'
import { buildElementRegistry, formatRegistryForPrompt } from '../demoElementRegistry.js'
import { parseLLMJson } from '../parseLLMJson.js'
import { normalizeInteractionPlan, interactionPlanToActions, demoDurationFromPlan } from '../storyPlan.js'
import { buildExampleFlowFromRegistry, validateDemoBeats } from '../validateDemoBeats.js'

const SYSTEM = `You are a Remotion motion director for product demo videos.

You output a frame-accurate demoBeats[] timeline. Each beat tells Remotion exactly what to show, hide, zoom, and animate.

ELEMENT REGISTRY:
- Every control has a stable ref (ComponentName@role:label-slug or ComponentName#dom-id)
- You MUST copy refs EXACTLY from the provided registry — never invent or rename refs
- role=trigger is the primary create/open CTA; role=button is secondary chrome (menus, kebab) — do not use button for open flows

BEAT TYPES:
establish | isolate | hover | click | reveal | type | expand | select | submit | payoff

BEAT SHAPE:
{
  "at": 0.35,
  "beat": "isolate",
  "targetRef": "<exact ref from registry>",
  "hideRest": true,
  "show": ["<same ref as targetRef>"],
  "camera": { "scale": 1.32, "focus": "target" },
  "description": "Isolate primary CTA"
}

RULES:
1. 6–14 beats, 0.3–0.5s apart, total ~5–7s
2. establish → role=main on the render root component (wide shot — full UI visible)
3. isolate → hover → click must use the SAME targetRef (role=trigger or role=expand)
4. reveal / type / select / submit target overlay components (modals, forms), not page chrome
5. type beat requires demoText
6. Return ONLY valid JSON`

function parseJson(text) {
  return parseLLMJson(text, 'Story director')
}

function beatsToInteractionPlan(beats, registry) {
  return beats.map((b) => ({
    phase: b.beat,
    at: b.at,
    targetRef: b.targetRef,
    focusTarget: b.targetRef ? registry.byRef.get(b.targetRef)?.role ?? null : null,
    element: b.targetRef ? registry.byRef.get(b.targetRef) ?? { ref: b.targetRef } : null,
    description: b.description,
    demoText: b.demoText,
    show: b.show,
    hide: b.hide,
    reveal: b.reveal,
    hideRest: b.hideRest,
    state: b.state,
  }))
}

function buildDirectorUserPrompt(slide, componentMeta, registry, scene, exampleFlow, validationErrors = null) {
  const errorBlock =
    validationErrors?.length > 0
      ? `\nPREVIOUS PLAN REJECTED — fix every error:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n`
      : ''

  return `Plan demoBeats for this Remotion clip.
${errorBlock}
SLIDE:
headline: ${slide.headline}
narration: ${slide.narration ?? ''}
component: ${slide.component ?? componentMeta?.name ?? 'unknown'}

${formatRegistryForPrompt(registry)}

DEMO SCENE:
${formatDemoSceneForPrompt(scene)}

${exampleFlow}

Return JSON:
{
  "storyBeat": "<snake-case story id>",
  "demoText": "<text typed during type beat, if any>",
  "demoBeats": [ ... ]
}`
}

function fallbackStory(slide, meta, demoScene, registry) {
  const caps = new Set(meta?.capabilities ?? [])
  const pool =
    registry?.list?.length > 0
      ? registry.list
      : demoScene?.elements?.length > 0
        ? demoScene.elements
        : meta?.elements ?? []

  const pick = (role) => pool.find((e) => e.role === role) ?? null
  const triggerEl = pick('trigger')
  const expandEl = pick('expand')
  const inputEl = pick('input')
  const dropdownEl = pick('dropdown')
  const submitEl = pick('submit')
  const mainEl =
    pool.find((e) => e.role === 'main' && e.component === demoScene?.rootComponent) ??
    pick('main')
  const container = demoScene?.components?.find((c) => c.role === 'container')

  const el = (e) =>
    e
      ? {
          component: e.component ?? container?.name ?? meta?.name,
          role: e.role,
          label: e.label,
          ...(e.ref ? { ref: e.ref } : {}),
        }
      : null

  const actionEl = triggerEl ?? expandEl

  const plan = [
    {
      phase: 'establish',
      at: 0,
      focusTarget: 'main',
      element: el(mainEl ?? { role: 'main', label: 'component body', component: container?.name ?? meta?.name }),
      description: `Wide shot of ${container?.name ?? meta?.name ?? 'UI'}`,
    },
  ]

  if (actionEl) {
    plan.push(
      {
        phase: 'isolate',
        at: 0.35,
        focusTarget: actionEl.role,
        element: el(actionEl),
        description: `Isolate "${actionEl.label}"`,
      },
      {
        phase: 'hover',
        at: 0.65,
        focusTarget: actionEl.role,
        element: el(actionEl),
        description: `Hover "${actionEl.label}"`,
      },
      {
        phase: 'click',
        at: 1.0,
        focusTarget: actionEl.role,
        effect: actionEl.role === 'expand' ? 'expandRow' : 'openModal',
        element: el(actionEl),
        description: `Click "${actionEl.label}"`,
      },
    )
  }

  if ((caps.has('open') || triggerEl) && inputEl) {
    plan.push({
      phase: 'reveal',
      at: 1.15,
      focusTarget: 'input',
      element: el(inputEl),
      description: `Reveal ${inputEl.component}`,
    })
  }

  if (inputEl || caps.has('type')) {
    plan.push({
      phase: 'type',
      at: 1.65,
      focusTarget: 'input',
      demoText: slide.demoText ?? 'Demo value',
      element: el(inputEl),
      description: inputEl ? `Type into "${inputEl.label}"` : 'Type in field',
    })
  }

  if (dropdownEl || caps.has('dropdown')) {
    plan.push({
      phase: 'select',
      at: 2.5,
      focusTarget: 'dropdown',
      element: el(dropdownEl),
      description: dropdownEl ? `Open "${dropdownEl.label}"` : 'Open dropdown',
    })
  }

  if (submitEl) {
    plan.push({
      phase: 'submit',
      at: 3.1,
      focusTarget: 'submit',
      element: el(submitEl),
      description: `Click "${submitEl.label}"`,
    })
  }

  plan.push({
    phase: 'payoff',
    at: 3.6,
    focusTarget: mainEl?.role ?? 'main',
    element: el(mainEl ?? inputEl),
    description: 'Payoff — show result on page',
  })

  return {
    storyBeat: slide.storyBeat ?? 'feature-demo',
    interactionPlan: bindInteractionPlanToScene(plan, demoScene, { strictRefs: true }),
    demoText: slide.demoText ?? null,
  }
}

function storyResult(slide, scene, registry, { storyBeat, demoText, demoBeats, interactionPlan }) {
  const beats = demoBeats ?? interactionPlanToBeats(interactionPlan, registry)
  return {
    storyBeat,
    demoText,
    demoBeats: beats,
    elementRegistry: registry.list,
    interactionPlan,
    demoScene: scene,
    actions: interactionPlanToActions(interactionPlan, { ...slide, demoText }),
  }
}

function applyValidatedBeats(slide, scene, registry, renderMeta, { storyBeat, demoText, demoBeats }) {
  const interactionPlan = bindInteractionPlanToScene(
    beatsToInteractionPlan(demoBeats, registry),
    scene,
    { strictRefs: true },
  )

  return storyResult(slide, scene, registry, {
    storyBeat,
    demoText,
    demoBeats,
    interactionPlan,
  })
}

function useFallback(slide, scene, registry, renderMeta, demoText) {
  const fb = fallbackStory(slide, renderMeta, scene, registry)
  const demoBeats = interactionPlanToBeats(fb.interactionPlan, registry)
  console.warn('[storyDirector] Using capability fallback story')
  return {
    ...applyValidatedBeats(slide, scene, registry, renderMeta, {
      storyBeat: fb.storyBeat,
      demoText: demoText ?? fb.demoText,
      demoBeats,
    }),
    storyPlanMeta: { source: 'fallback', beatCount: demoBeats.length },
  }
}

async function requestDirectorPlan(slide, componentMeta, registry, scene, validationErrors = null) {
  const exampleFlow = buildExampleFlowFromRegistry(registry, scene, componentMeta)
  const text = await callLLM({
    system: SYSTEM,
    user: buildDirectorUserPrompt(slide, componentMeta, registry, scene, exampleFlow, validationErrors),
    maxTokens: 2200,
  })
  return parseJson(text)
}

export async function planDemoStory(slide, componentMeta, { catalog = [], demoScene = null } = {}) {
  const resolvedComponent = resolveDemoComponent(slide.component, catalog)
  const renderMode = slide.renderMode ?? slide.demoScene?.renderMode ?? 'auto'
  const scene =
    demoScene ??
    (resolvedComponent ? buildDemoScene(resolvedComponent, catalog, { renderMode }) : null)
  const registry = buildElementRegistry(catalog, scene)
  const renderMeta = scene
    ? catalog.find((c) => c.name === scene.rootComponent) ?? componentMeta
    : componentMeta ?? (resolvedComponent ? catalog.find((c) => c.name === resolvedComponent) : null)

  if (!renderMeta && registry.list.length === 0) {
    console.warn('[storyDirector] No catalog metadata for component:', slide.component)
  }

  if (slide.demoBeats?.length >= 4) {
    const demoBeats = normalizeDemoBeats(slide.demoBeats, registry)
    const validation = validateDemoBeats(demoBeats, registry, scene, renderMeta)
    if (!validation.ok) {
      console.warn('[storyDirector] Provided demoBeats failed validation:', validation.errors)
      return useFallback(slide, scene, registry, renderMeta, slide.demoText)
    }
    return {
      ...applyValidatedBeats(slide, scene, registry, renderMeta, {
        storyBeat: slide.storyBeat,
        demoText: slide.demoText,
        demoBeats,
      }),
      storyPlanMeta: { source: 'provided', beatCount: demoBeats.length },
    }
  }

  const existing = normalizeInteractionPlan(slide.interactionPlan)
  if (existing.length >= 4 && existing.every((p) => p.element?.component)) {
    const bound = bindInteractionPlanToScene(existing, scene, { strictRefs: true })
    const demoBeats = interactionPlanToBeats(bound, registry)
    const validation = validateDemoBeats(demoBeats, registry, scene, renderMeta)
    if (!validation.ok) {
      console.warn('[storyDirector] interactionPlan failed validation:', validation.errors)
      return useFallback(slide, scene, registry, renderMeta, slide.demoText)
    }
    return {
      ...storyResult(slide, scene, registry, {
        storyBeat: slide.storyBeat,
        demoText: slide.demoText,
        demoBeats,
        interactionPlan: bound,
      }),
      storyPlanMeta: { source: 'interactionPlan', beatCount: demoBeats.length },
    }
  }

  const key = import.meta.env.VITE_ANTHROPIC_KEY
  if (!key) {
    const fb = fallbackStory(slide, renderMeta, scene, registry)
    return {
      ...applyValidatedBeats(slide, scene, registry, renderMeta, {
        storyBeat: fb.storyBeat,
        demoText: fb.demoText,
        demoBeats: interactionPlanToBeats(fb.interactionPlan, registry),
      }),
      storyPlanMeta: { source: 'fallback-no-key', beatCount: interactionPlanToBeats(fb.interactionPlan, registry).length },
    }
  }

  try {
    let result = await requestDirectorPlan(slide, componentMeta, registry, scene)
    let demoBeats = normalizeDemoBeats(result.demoBeats ?? result.interactionPlan, registry)
    let demoText = result.demoText ?? slide.demoText
    let validation = validateDemoBeats(demoBeats, registry, scene, renderMeta)

    if (!validation.ok) {
      console.warn('[storyDirector] Beat validation failed, retrying:', validation.errors)
      result = await requestDirectorPlan(slide, componentMeta, registry, scene, validation.errors)
      demoBeats = normalizeDemoBeats(result.demoBeats ?? result.interactionPlan, registry)
      demoText = result.demoText ?? slide.demoText
      validation = validateDemoBeats(demoBeats, registry, scene, renderMeta)
    }

    if (!validation.ok || demoBeats.length < 4) {
      if (!validation.ok) {
        console.warn('[storyDirector] Beat validation failed after retry:', validation.errors)
      }
      return useFallback(slide, scene, registry, renderMeta, demoText)
    }

    return {
      ...applyValidatedBeats(slide, scene, registry, renderMeta, {
        storyBeat: result.storyBeat ?? slide.storyBeat ?? 'feature-demo',
        demoText,
        demoBeats,
      }),
      storyPlanMeta: { source: 'llm', beatCount: demoBeats.length },
    }
  } catch (e) {
    console.warn('[storyDirector] LLM failed:', e.message)
    return useFallback(slide, scene, registry, renderMeta, slide.demoText)
  }
}

export async function enrichDemoSlidesWithStory(slides, catalog = []) {
  const byName = Object.fromEntries(catalog.map((c) => [c.name, c]))

  return Promise.all(
    slides.map(async (slide) => {
      if (slide.role !== 'demo' && slide.type !== 'demo') return slide

      const resolvedComponent = resolveDemoComponent(slide.component, catalog)
      const renderMode = slide.renderMode ?? 'auto'
      const demoScene = resolvedComponent
        ? buildDemoScene(resolvedComponent, catalog, { renderMode })
        : null
      const renderName = demoScene?.rootComponent ?? resolvedComponent
      const meta = renderName ? byName[renderName] : null

      const story = await planDemoStory(
        { ...slide, component: resolvedComponent ?? slide.component },
        meta,
        { catalog, demoScene },
      )

      const narrationFromPlan =
        story.demoBeats?.length > 0
          ? story.demoBeats
              .filter((b) => b.description)
              .map((b) => `${b.beat}: ${b.description}${b.targetRef ? ` [${b.targetRef}]` : ''}`)
              .join(' → ')
          : slide.narration

      return {
        ...slide,
        component: renderName ?? resolvedComponent ?? slide.component,
        focusComponent: demoScene?.focusComponent ?? resolvedComponent ?? slide.component,
        demoScene: story.demoScene ?? demoScene,
        elementRegistry: story.elementRegistry,
        storyBeat: story.storyBeat,
        demoBeats: story.demoBeats,
        interactionPlan: story.interactionPlan,
        actions: story.actions,
        storyPlanMeta: story.storyPlanMeta,
        focus: demoScene?.rootMode === 'page' ? 'page' : slide.focus ?? 'isolated',
        renderMode: demoScene?.renderMode ?? slide.renderMode ?? null,
        contextPage: slide.contextPage ?? null,
        ...(story.demoText ? { demoText: story.demoText } : {}),
        ...(narrationFromPlan && !slide.narration?.includes('→') ? { narration: narrationFromPlan } : {}),
        durationSec:
          story.demoBeats?.length > 0
            ? demoDurationFromBeats(story.demoBeats, 5, 8)
            : demoDurationFromPlan(story.interactionPlan, 5, 7),
      }
    }),
  )
}

export { formatBeatsForPrompt }
