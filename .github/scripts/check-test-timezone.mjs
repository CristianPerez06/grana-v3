#!/usr/bin/env node
/**
 * Fail if any workspace member's `test` script does not pin the financial
 * timezone.
 *
 * Why this exists: `pnpm test` was green in CI and red on a developer's machine,
 * on the same commit (issue #131). The tests inherited the timezone of whatever
 * ran them, and GitHub's runners sit at UTC — where a date read one day early
 * reads correctly, because the offset is zero. The gate was passing by accident
 * of the environment, and the one-day shift was impersonating a behaviour bug.
 *
 * The zone is Argentina's and not UTC on purpose. Pinning UTC would also make
 * local and CI agree, but agree in a timezone the product never runs in, and
 * would keep hiding this family of date bugs instead of exposing them.
 *
 * The prefix lives in each member's own `test` script rather than in one place,
 * because `pnpm test` is `pnpm -r test` and a developer iterating on one suite
 * runs `pnpm --filter <pkg> test` directly — a root-only prefix would miss
 * exactly that path.
 *
 * This used to be shell inside the `monorepo-health` job, which meant CI could
 * check it and a person adding a package could not. See `comment:verify`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FINANCIAL_TIMEZONE = 'TZ=America/Argentina/Buenos_Aires'

/**
 * @param {string} root repository root
 * @returns {{name: string, manifest: string, script: string, pinned: boolean}[]}
 */
export function testScripts(root) {
  const members = []

  for (const group of ['packages', 'apps']) {
    const groupDir = join(root, group)
    if (!existsSync(groupDir)) continue

    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const manifestPath = join(groupDir, entry.name, 'package.json')
      if (!existsSync(manifestPath)) continue

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const script = manifest.scripts?.test
      if (!script) continue

      members.push({
        name: manifest.name,
        manifest: `${group}/${entry.name}/package.json`,
        script,
        pinned: script.startsWith(`${FINANCIAL_TIMEZONE} `),
      })
    }
  }

  return members
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const members = testScripts(root)
  let failed = false

  for (const member of members) {
    console.log(`  ${member.pinned ? 'ok     ' : 'MISSING'} ${member.name}`)
    if (member.pinned) continue
    console.error(
      `::error file=${member.manifest}::'${member.name}' has a test script that does not ` +
        `pin the financial timezone. Prefix it with "${FINANCIAL_TIMEZONE} " so its tests ` +
        `run in the timezone the product runs in (see issue #131).`,
    )
    failed = true
  }

  if (failed) process.exit(1)
  console.log(`\nAll ${members.length} test scripts run in the financial timezone.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
