// Shared so CountersService can invalidate the same key campaigns.service.ts
// populates, without the two importing from each other.
export function campaignCacheKey(id: string) {
  return `cache:campaign:${id}`;
}

export function institutionCacheKey(id: string) {
  return `cache:institution:${id}`;
}
