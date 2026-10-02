// Friendly IDs (amber-otter-42) and invite-link helpers.
// An ID is just the string both clients register / address each other by, so it stays a plain slug.

const ADJECTIVES = [
  "amber", "brisk", "cosy", "dusty", "eager", "fuzzy", "gentle", "honey", "ivory", "jolly",
  "kind", "lucky", "mellow", "nimble", "olive", "plucky", "quiet", "rusty", "sunny", "tidy",
  "velvet", "warm", "wild", "zesty",
]
const ANIMALS = [
  "otter", "heron", "badger", "finch", "lynx", "marmot", "newt", "owl", "panda", "quail",
  "robin", "seal", "toad", "vole", "wren", "yak", "gecko", "hare", "ibis", "koala",
  "lemur", "moth", "stoat", "tapir",
]

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

export function generateId(): string {
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${10 + Math.floor(Math.random() * 90)}`
}

/** lower-case, spaces become dashes, only a-z 0-9 - _ kept. Both people type IDs, so be forgiving. */
export function normalizeId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32)
}

/**
 * Invite for the friend: opens the entry screen with both blanks filled in,
 * with their ID and yours swapped (?i=<their id>&with=<your id>).
 */
export function buildInviteUrl(origin: string, myId: string, friendId: string): string {
  const params = new URLSearchParams({ i: friendId, with: myId })
  return `${origin}/?${params.toString()}`
}

export function readInvite(search: string): { me: string; friend: string } | null {
  const params = new URLSearchParams(search)
  const me = normalizeId(params.get("i") ?? "")
  const friend = normalizeId(params.get("with") ?? "")
  return me && friend ? { me, friend } : null
}
