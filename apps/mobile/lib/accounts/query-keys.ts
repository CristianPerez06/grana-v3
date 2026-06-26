// Query keys for the mobile accounts module. Web keeps its own keys in
// apps/web/lib (not shared), so mobile owns these. Kept under a single
// `['accounts', …]` root so a coarse invalidation can wipe the whole module.
export const accountKeys = {
  all: ['accounts'] as const,
  list: ['accounts', 'list'] as const,
  archived: ['accounts', 'archived'] as const,
  detail: (id: string) => ['accounts', 'detail', id] as const,
  movements: (id: string) => ['accounts', 'movements', id] as const,
  pendingReimbursements: (id: string) => ['accounts', 'pending', id] as const,
  institutions: ['institutions'] as const,
}
