#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const assets = resolve(here, '..', 'assets')

const isotype = await readFile(resolve(assets, 'grana-isotype.svg'))
const wordmark = await readFile(resolve(assets, 'grana-wordmark.svg'))

const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

// An Android adaptive icon is a 108dp layer that the launcher masks down to the central
// 72dp, in whatever shape the OEM picked. The foreground must therefore be the glyph
// ALONE over transparency, with the brand green supplied by adaptiveIcon.backgroundColor:
// if the foreground carries its own green circle, the mask's corners fall outside that
// circle and the background layer shows through as four dark wedges.
const isotypeSvg = isotype.toString()
const glyphSvg = isotypeSvg.replace(/\s*<circle\b[^>]*\/>/, '')
if (glyphSvg === isotypeSvg) {
  throw new Error('grana-isotype.svg no longer has a <circle> to strip for the adaptive foreground')
}
const glyph = new TextEncoder().encode(glyphSvg)

// Scaling the glyph's own viewBox by 72/108 frames it inside the masked region exactly as
// the circle frames it on iOS.
const adaptiveVisible = 72 / 108

const targets = [
  { name: 'icon.png', svg: isotype, size: 1024, flatten: '#10B981' },
  { name: 'adaptive-icon.png', svg: glyph, size: 1024, scale: adaptiveVisible },
  { name: 'splash-icon.png', svg: wordmark, size: 1024, scale: 0.75 },
  { name: 'favicon.png', svg: isotype, size: 64 },
]

for (const t of targets) {
  const out = resolve(assets, t.name)
  const inner = Math.round(t.size * (t.scale ?? 1))
  // Split an odd remainder instead of rounding both sides up, which would overshoot
  // t.size by a pixel and leave the art half a pixel off centre.
  const pad = Math.floor((t.size - inner) / 2)
  const padEnd = t.size - inner - pad
  let pipeline = sharp(t.svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: transparent })
  if (t.size > inner) {
    pipeline = pipeline.extend({ top: pad, bottom: padEnd, left: pad, right: padEnd, background: transparent })
  }
  if (t.flatten) pipeline = pipeline.flatten({ background: t.flatten })
  await pipeline.png().toFile(out)
  console.log(`wrote ${t.name} (${t.size}×${t.size})`)
}
