/**
 * Generic omnibar token language (VS Code extension-search style):
 *
 * - `@flag`            — a boolean filter, e.g. `@installed`
 * - `@key:value`       — a keyed filter, e.g. `@repo:extra`, `@sort:size`
 * - `@key:"a b"`       — a quoted value containing whitespace
 * - everything else    — free text (`"quoted text"` stays one text token)
 *
 * Which flags and keys exist is passed in as a {@link TokenSpec}; an unknown
 * `@word` (or a flag written with a value, or a key written without one) is
 * kept as free text. Keys/flags are case-insensitive and normalized to lower
 * case; values keep their case.
 *
 * All helpers are pure string → string functions so they can drive the omnibar
 * directly (`setOmniBar(applyToken(query, '@aur', SPEC))`). Rebuilt queries put
 * all tokens first (in their original order) followed by the free text.
 *
 * @module
 */

/** Which `@flag`s and `@key:value` keys a tool understands. */
export interface TokenSpec {
  /** Known boolean flags (`@installed`). Case-insensitive. */
  flags?: readonly string[]
  /** Known value keys (`@sort:size`). Case-insensitive. */
  keys?: readonly string[]
}

/** One whitespace-separated piece of a query. */
export interface QueryToken {
  /** The token exactly as typed. */
  raw: string
  kind: 'flag' | 'value' | 'text'
  /** Lower-cased flag/key name (absent for text). */
  key?: string
  /** Unquoted value (only for `kind: 'value'`; may be `''` while typing). */
  value?: string
}

/** Result of {@link parseTokens}. */
export interface ParsedTokens {
  /** Free text, tokens removed, single-space joined. */
  text: string
  /** Present flags, in order of first appearance. */
  flags: Set<string>
  /** Non-empty values by key; the last occurrence of a key wins. */
  values: Record<string, string>
  /** The full token list (see {@link tokenizeQuery}). */
  tokens: QueryToken[]
}

const TOKEN_RE = /@[a-zA-Z][\w-]*(?::(?:"[^"]*"?|[^\s"]*))?|"[^"]*"|\S+/g
const CLASSIFY_RE = /^@([a-zA-Z][\w-]*)(?::(.*))?$/

function unquote(value: string): string {
  if (!value.startsWith('"')) return value
  return value.endsWith('"') && value.length >= 2 ? value.slice(1, -1) : value.slice(1)
}

function includesKey(list: readonly string[] | undefined, key: string): boolean {
  return list === undefined || list.some((k) => k.toLowerCase() === key)
}

/**
 * Classifies a single raw token. Without a `spec`, every `@word` is accepted
 * (as a flag, or as a value when it has `:`).
 */
function classify(raw: string, spec?: TokenSpec): QueryToken {
  const m = CLASSIFY_RE.exec(raw)
  if (m) {
    const key = m[1].toLowerCase()
    if (m[2] === undefined && includesKey(spec?.flags, key)) return { raw, kind: 'flag', key }
    if (m[2] !== undefined && includesKey(spec?.keys, key)) {
      return { raw, kind: 'value', key, value: unquote(m[2]) }
    }
  }
  return { raw, kind: 'text' }
}

/**
 * Splits `query` into classified tokens.
 *
 * @param query - Raw omnibar text.
 * @param spec - Known flags/keys. Omit to accept every `@word`.
 */
export function tokenizeQuery(query: string, spec?: TokenSpec): QueryToken[] {
  return (query.match(TOKEN_RE) ?? []).map((raw) => classify(raw, spec))
}

/**
 * Parses `query` into free text, flags and values.
 *
 * @example
 * parseTokens('@aur @sort:size media', { flags: ['aur'], keys: ['sort'] })
 * // → { text: 'media', flags: Set{'aur'}, values: { sort: 'size' }, tokens: [...] }
 */
export function parseTokens(query: string, spec?: TokenSpec): ParsedTokens {
  const tokens = tokenizeQuery(query, spec)
  const flags = new Set<string>()
  const values: Record<string, string> = {}
  const text: string[] = []
  for (const token of tokens) {
    if (token.kind === 'flag') flags.add(token.key as string)
    else if (token.kind === 'value') {
      if (token.value) values[token.key as string] = token.value
    } else text.push(token.raw)
  }
  return { text: text.join(' '), flags, values, tokens }
}

/**
 * Builds a `@key:value` token, quoting the value when it contains whitespace
 * (or is empty). Double quotes inside the value are dropped.
 *
 * @example valueToken('category', 'Audio Video') // '@category:"Audio Video"'
 */
export function valueToken(key: string, value: string): string {
  const clean = value.replace(/"/g, '')
  return clean === '' || /\s/.test(clean) ? `@${key}:"${clean}"` : `@${key}:${clean}`
}

/** Builds a `@flag` token. */
export function flagToken(flag: string): string {
  return `@${flag}`
}

function sameSlot(a: QueryToken, b: QueryToken): boolean {
  return a.kind !== 'text' && a.kind === b.kind && a.key === b.key
}

function join(tokens: QueryToken[]): string {
  const filters = tokens.filter((t) => t.kind !== 'text').map((t) => t.raw)
  const text = tokens.filter((t) => t.kind === 'text').map((t) => t.raw)
  return [...filters, ...text].join(' ')
}

/**
 * True when `query` contains `token`: the same flag, or the same key with the
 * same value. Text tokens never match.
 */
export function hasToken(query: string, token: string, spec?: TokenSpec): boolean {
  const target = classify(token, spec)
  return tokenizeQuery(query, spec).some(
    (t) => sameSlot(t, target) && (t.kind === 'flag' || t.value === target.value)
  )
}

/**
 * Toggles `token` in `query`: removes it when already present (see
 * {@link hasToken}); otherwise adds it, replacing an existing token of the same
 * key in place. Use for filter-menu checkboxes.
 */
export function applyToken(query: string, token: string, spec?: TokenSpec): string {
  const target = classify(token, spec)
  const tokens = tokenizeQuery(query, spec)
  if (hasToken(query, token, spec)) return join(tokens.filter((t) => !sameSlot(t, target)))
  return setToken(query, token, spec)
}

/**
 * Adds `token` (or replaces the same-key token in place) without ever
 * toggling it off. Use for radio-style choices such as `@sort:`.
 */
export function setToken(query: string, token: string, spec?: TokenSpec): string {
  const target = classify(token, spec)
  const tokens = tokenizeQuery(query, spec)
  const idx = tokens.findIndex((t) => sameSlot(t, target))
  if (idx >= 0) {
    tokens[idx] = target
    return join(tokens.filter((t, i) => i === idx || !sameSlot(t, target)))
  }
  tokens.push(target)
  return join(tokens)
}

/**
 * Removes tokens from `query`, keeping the free text.
 *
 * @param which - `'all'` drops every flag/value token; a key or flag name
 *   (`'sort'`, `'@aur'`, `'@sort:size'`) drops every token with that key.
 */
export function removeToken(query: string, which: string, spec?: TokenSpec): string {
  const tokens = tokenizeQuery(query, spec)
  if (which === 'all') return join(tokens.filter((t) => t.kind === 'text'))
  const key = /^@?([a-zA-Z][\w-]*)/.exec(which)?.[1].toLowerCase()
  return join(tokens.filter((t) => t.kind === 'text' || t.key !== key))
}
