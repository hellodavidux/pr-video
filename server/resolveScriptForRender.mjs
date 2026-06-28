import { pathToFileURL } from 'url'

export function resolveScriptForRender(script, apiPort = 4174) {
  if (!script?.slides?.length) return script

  return {
    ...script,
    slides: script.slides.map((slide) => {
      const visual = slide.visual
      if (!visual || (visual.type !== 'app-screenshot' && visual.type !== 'image')) {
        return slide
      }

      let imageUrl = visual.imageUrl
      if (visual.filePath) {
        imageUrl = pathToFileURL(visual.filePath).href
      } else if (
        imageUrl &&
        !/^https?:\/\//i.test(imageUrl) &&
        !imageUrl.startsWith('file://')
      ) {
        imageUrl = `http://127.0.0.1:${apiPort}${imageUrl}`
      }

      return {
        ...slide,
        visual: { ...visual, imageUrl },
      }
    }),
  }
}
