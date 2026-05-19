type JwtAmrEntry = { method?: string }

export function hasRecoveryClaim(accessToken: string | undefined): boolean {
  if (!accessToken) return false
  const parts = accessToken.split('.')
  if (parts.length < 2) return false
  try {
    const padded = parts[1].padEnd(
      parts[1].length + ((4 - (parts[1].length % 4)) % 4),
      '=',
    )
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { amr?: JwtAmrEntry[] }
    return (payload.amr ?? []).some((entry) => entry.method === 'otp')
  } catch {
    return false
  }
}
