import { describe, it, expect } from 'vitest'
import {
  tokenizeQuery,
  parseTokens,
  applyToken,
  setToken,
  removeToken,
  hasToken,
  valueToken,
  flagToken,
  type TokenSpec,
} from './query-tokens.ts'

const SPEC: TokenSpec = {
  flags: ['installed', 'aur', 'done'],
  keys: ['repo', 'sort', 'category'],
}

describe('tokenizeQuery', () => {
  it('classifies flags, values and text', () => {
    expect(tokenizeQuery('@aur @sort:size vlc', SPEC)).toEqual([
      { raw: '@aur', kind: 'flag', key: 'aur' },
      { raw: '@sort:size', kind: 'value', key: 'sort', value: 'size' },
      { raw: 'vlc', kind: 'text' },
    ])
  })

  it('unquotes quoted values and keeps quoted free text as one token', () => {
    expect(tokenizeQuery('@category:"Audio Video" "two words"', SPEC)).toEqual([
      { raw: '@category:"Audio Video"', kind: 'value', key: 'category', value: 'Audio Video' },
      { raw: '"two words"', kind: 'text' },
    ])
  })

  it('treats unknown @words, flags used with values and keys without values as text', () => {
    expect(tokenizeQuery('@nope @aur:x @sort', SPEC).map((t) => t.kind)).toEqual([
      'text',
      'text',
      'text',
    ])
  })

  it('lower-cases keys but keeps value case', () => {
    expect(tokenizeQuery('@AUR @Repo:Extra', SPEC)).toEqual([
      { raw: '@AUR', kind: 'flag', key: 'aur' },
      { raw: '@Repo:Extra', kind: 'value', key: 'repo', value: 'Extra' },
    ])
  })

  it('accepts any @word when no spec is given', () => {
    expect(tokenizeQuery('@foo @bar:baz x')).toEqual([
      { raw: '@foo', kind: 'flag', key: 'foo' },
      { raw: '@bar:baz', kind: 'value', key: 'bar', value: 'baz' },
      { raw: 'x', kind: 'text' },
    ])
  })

  it('accepts digits, dashes and underscores in keys', () => {
    expect(tokenizeQuery('@all-day @due_on:2026-11-12')).toEqual([
      { raw: '@all-day', kind: 'flag', key: 'all-day' },
      { raw: '@due_on:2026-11-12', kind: 'value', key: 'due_on', value: '2026-11-12' },
    ])
  })

  it('treats an unfinished value (`@repo:` / unclosed quote) as a value token while typing', () => {
    expect(tokenizeQuery('@repo: x', SPEC)[0]).toEqual({
      raw: '@repo:',
      kind: 'value',
      key: 'repo',
      value: '',
    })
    expect(tokenizeQuery('@category:"Audio', SPEC)[0]).toEqual({
      raw: '@category:"Audio',
      kind: 'value',
      key: 'category',
      value: 'Audio',
    })
  })

  it('returns [] for blank input', () => {
    expect(tokenizeQuery('   ', SPEC)).toEqual([])
  })
})

describe('parseTokens', () => {
  it('splits flags, values and text', () => {
    const q = parseTokens('@aur  media @sort:size player @aur', SPEC)
    expect(q.text).toBe('media player')
    expect([...q.flags]).toEqual(['aur'])
    expect(q.values).toEqual({ sort: 'size' })
  })

  it('keeps flag order of first appearance and lets the last value win', () => {
    const q = parseTokens('@done @installed @repo:a @repo:b', SPEC)
    expect([...q.flags]).toEqual(['done', 'installed'])
    expect(q.values).toEqual({ repo: 'b' })
  })

  it('skips empty values', () => {
    expect(parseTokens('@repo: x', SPEC).values).toEqual({})
  })

  it('leaves unknown @words in the text', () => {
    expect(parseTokens('@nope hi', SPEC).text).toBe('@nope hi')
  })

  it('returns the token list too', () => {
    expect(parseTokens('@aur x', SPEC).tokens).toHaveLength(2)
  })

  it('handles blank input', () => {
    const q = parseTokens('', SPEC)
    expect(q.text).toBe('')
    expect(q.flags.size).toBe(0)
    expect(q.values).toEqual({})
  })
})

describe('valueToken / flagToken', () => {
  it('quotes values containing whitespace', () => {
    expect(valueToken('category', 'Audio Video')).toBe('@category:"Audio Video"')
    expect(valueToken('repo', 'extra')).toBe('@repo:extra')
  })

  it('drops double quotes from values and quotes empty values', () => {
    expect(valueToken('q', 'a"b')).toBe('@q:ab')
    expect(valueToken('q', '')).toBe('@q:""')
  })

  it('builds flag tokens', () => {
    expect(flagToken('aur')).toBe('@aur')
  })
})

describe('hasToken', () => {
  it('matches flags case-insensitively', () => {
    expect(hasToken('@AUR x', '@aur', SPEC)).toBe(true)
    expect(hasToken('x', '@aur', SPEC)).toBe(false)
  })

  it('matches values by key and exact value', () => {
    expect(hasToken('@sort:size', '@sort:size', SPEC)).toBe(true)
    expect(hasToken('@sort:size', '@sort:name', SPEC)).toBe(false)
    expect(hasToken('@category:"A B" x', '@category:"A B"', SPEC)).toBe(true)
  })

  it('is false for text tokens', () => {
    expect(hasToken('@nope', '@nope', SPEC)).toBe(false)
  })
})

describe('applyToken', () => {
  it('toggles flags, putting tokens before text', () => {
    expect(applyToken('mpv', '@aur', SPEC)).toBe('@aur mpv')
    expect(applyToken('@aur mpv', '@aur', SPEC)).toBe('mpv')
  })

  it('replaces a same-key value in place, or removes an identical one', () => {
    expect(applyToken('@aur @sort:name mpv', '@sort:size', SPEC)).toBe('@aur @sort:size mpv')
    expect(applyToken('@sort:size mpv', '@sort:size', SPEC)).toBe('mpv')
  })

  it('handles quoted values', () => {
    expect(applyToken('vlc', '@category:"Audio Video"', SPEC)).toBe('@category:"Audio Video" vlc')
  })

  it('appends unknown tokens as text (with spec) and accepts any token without spec', () => {
    expect(applyToken('x', '@nope', SPEC)).toBe('x @nope')
    expect(applyToken('x', '@nope')).toBe('@nope x')
  })

  it('works on an empty query', () => {
    expect(applyToken('', '@aur', SPEC)).toBe('@aur')
  })
})

describe('setToken', () => {
  it('adds or replaces without toggling off', () => {
    expect(setToken('@sort:size x', '@sort:size', SPEC)).toBe('@sort:size x')
    expect(setToken('@sort:name x', '@sort:size', SPEC)).toBe('@sort:size x')
    expect(setToken('@aur x', '@aur', SPEC)).toBe('@aur x')
    expect(setToken('x', '@aur', SPEC)).toBe('@aur x')
  })
})

describe('removeToken', () => {
  it("drops every token with 'all', keeping text", () => {
    expect(removeToken('@aur @sort:size @category:"A B" mpv', 'all', SPEC)).toBe('mpv')
  })

  it('drops tokens of one key (with or without @)', () => {
    expect(removeToken('@aur @sort:size x', 'sort', SPEC)).toBe('@aur x')
    expect(removeToken('@aur @sort:size x', '@aur', SPEC)).toBe('@sort:size x')
    expect(removeToken('@aur @sort:size @sort:name x', '@sort:size', SPEC)).toBe('@aur x')
  })

  it('is a no-op when the key is absent', () => {
    expect(removeToken('@aur x', 'repo', SPEC)).toBe('@aur x')
  })
})
