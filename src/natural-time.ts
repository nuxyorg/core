/* cspell:disable -- Turkish/English date vocabulary and fixtures. */
/**
 * Turkish/English natural-language date, time and duration parser.
 *
 * Pure and deterministic: `now` is injectable and all calendar maths uses local
 * `Date` construction (`new Date(y, m, d, h, min)`), so results are DST-safe
 * wall-clock times. No `Intl` locale data is used for parsing. Matching is case-
 * and diacritic-insensitive (`ı/i`, `ş/s`, `ğ/g`, `ü/u`, `ö/o`, `ç/c`).
 *
 * Recognised forms (any of them may sit anywhere in a sentence; the rest of the
 * sentence is returned as `rest`, e.g. a reminder label):
 *
 * | Kind     | Examples |
 * |----------|----------|
 * | duration | `10dk` `10 min` `1s30dk` `1h30m` `1h30` `1.5 saat` `2h` `45sn` `3g` `1w` `yarım saat` `half an hour` `in 2 hours` `2 saat sonra` `10 dakika içinde` |
 * | time     | `15:30` `15.30` `3pm` `3:30 pm` `9'da` `9da` `saat 9` `at 5` `sabah 9` `akşam 7'de` `tonight` `noon` `midnight` |
 * | date     | `bugün` `yarın` `öbür gün` `today` `tomorrow` `dün` `cuma` `next friday` `gelecek cuma` `haftaya cuma` `12 kasım` `12 Nov` `nov 12` `2026-11-12` `12.11.2026` |
 * | combos   | `yarın 9'da` `cuma 14:00` `12 kasım 10:30` `tomorrow at 3pm` `3pm tomorrow` |
 *
 * Unit letters: `s`/`sa`/`saat`/`h` = hour (Turkish `s` = saat, **not** second),
 * `dk`/`dak`/`dakika`/`m`/`min` = minute, `sn`/`sec`/`saniye` = second,
 * `g`/`gün`/`d`/`day` = day, `w`/`wk`/`hafta`/`week` = week. Months/years are not
 * durations (calendar-dependent). Bare numbers (`10`, `2026`) never match.
 *
 * Resolution rules:
 * - A time without a date that has already passed today rolls to tomorrow
 *   (`rollPastTimes`, default on). A weekday whose time passed today rolls a week.
 * - Hour-only forms without am/pm (`9'da`, `saat 9`, `at 5`) are ambiguous. With
 *   `ambiguousHours: 'next'` (default) and no date they resolve to the next
 *   occurrence of `h` or `h+12`; with a date, 1–6 mean afternoon (`yarın 3'te` →
 *   15:00) and 7–12 are taken as written. `'as-is'` always takes them literally.
 *   Colon forms (`9:30`) are always 24-hour.
 * - Bare weekdays (`cuma`, `friday`, `bu cuma`) are the upcoming one, today
 *   included; `next`/`gelecek`/`önümüzdeki` are 1–7 days ahead (never today);
 *   `haftaya` is that weekday in next (Monday-based) week.
 * - Yearless dates already behind today move to next year (`preferFutureDates`).
 * - `12.11.2026` / `12/11/2026` are day-first.
 *
 * @module
 */

/** What a matched expression describes. */
export type NaturalTimeKind = 'duration' | 'datetime' | 'date'

/** Options for {@link parseNaturalTime}. */
export interface NaturalTimeOptions {
  /** Reference time. Defaults to `Date.now()`. */
  now?: Date | number
  /** Roll a date-less time that already passed today to tomorrow. Default `true`. */
  rollPastTimes?: boolean
  /** How to read hour-only forms without am/pm (see module docs). Default `'next'`. */
  ambiguousHours?: 'next' | 'as-is'
  /** Move yearless dates that are before today to next year. Default `true`. */
  preferFutureDates?: boolean
}

/** One parsed date/time/duration expression. */
export interface NaturalTimeMatch {
  kind: NaturalTimeKind
  /** Resolved moment. For `duration` it is `now + durationMs`; for `date` local midnight. */
  at: Date
  /** True for date-only matches (`kind: 'date'`). */
  allDay: boolean
  /** Duration length in ms (only for `kind: 'duration'`). */
  durationMs?: number
  /** The matched substring of the original text (original case). */
  matched: string
  /** `[start, end)` indices of {@link matched} in the original text. */
  consumed: [number, number]
  /** The input with this expression removed, whitespace collapsed and trimmed. */
  rest: string
  /**
   * True when the match is only a bare day-part word (`sabah`, `akşam`, `gece`,
   * `in the morning`) with no hour and no day — e.g. the "gece" in "gece ışığı".
   * Callers that act on free text (reminders, calendar) should require an
   * explicit trigger before accepting a vague match. `tonight`, `noon`,
   * `midnight` and `gece yarısı` are never vague.
   */
  vague?: boolean
}

// ---------------------------------------------------------------------------
// Text folding
// ---------------------------------------------------------------------------

const FOLD_MAP: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  I: 'i',
  ş: 's',
  Ş: 's',
  ğ: 'g',
  Ğ: 'g',
  ü: 'u',
  Ü: 'u',
  ö: 'o',
  Ö: 'o',
  ç: 'c',
  Ç: 'c',
  '’': "'",
  '‘': "'",
  ʼ: "'",
  '`': "'",
}

/**
 * Lower-cases and strips diacritics (Turkish-aware: `İ`/`I`/`ı` → `i`), one
 * UTF-16 unit at a time, so the result has exactly the input's length and
 * indices map 1:1 back to the original. Curly apostrophes become `'`.
 *
 * Handy for diacritic-insensitive search (`foldDiacritics(name).includes(q)`).
 */
export function foldDiacritics(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const code = ch.charCodeAt(0)
    if (code >= 0xd800 && code <= 0xdfff) {
      out += ch
      continue
    }
    const mapped = FOLD_MAP[ch]
    if (mapped !== undefined) {
      out += mapped
      continue
    }
    const r = ch.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    out += r.length === 1 ? r : ch
  }
  return out
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const UNITS: Record<string, number> = {
  saniye: SECOND,
  seconds: SECOND,
  second: SECOND,
  secs: SECOND,
  sec: SECOND,
  sn: SECOND,
  dakika: MINUTE,
  minutes: MINUTE,
  minute: MINUTE,
  mins: MINUTE,
  min: MINUTE,
  dak: MINUTE,
  dk: MINUTE,
  m: MINUTE,
  saat: HOUR,
  hours: HOUR,
  hour: HOUR,
  hrs: HOUR,
  hr: HOUR,
  sa: HOUR,
  s: HOUR,
  h: HOUR,
  gun: DAY,
  days: DAY,
  day: DAY,
  g: DAY,
  d: DAY,
  hafta: 7 * DAY,
  weeks: 7 * DAY,
  week: 7 * DAY,
  wks: 7 * DAY,
  wk: 7 * DAY,
  w: 7 * DAY,
}

const WORD_NUMBERS: Record<string, number> = {
  bir: 1,
  one: 1,
  an: 1,
  a: 1,
  yarim: 0.5,
  'half an': 0.5,
  'half a': 0.5,
  half: 0.5,
}

const MONTHS: Record<string, number> = {
  ocak: 1,
  oca: 1,
  subat: 2,
  sub: 2,
  mart: 3,
  nisan: 4,
  nis: 4,
  mayis: 5,
  haziran: 6,
  haz: 6,
  temmuz: 7,
  tem: 7,
  agustos: 8,
  agu: 8,
  eylul: 9,
  eyl: 9,
  ekim: 10,
  eki: 10,
  kasim: 11,
  kas: 11,
  aralik: 12,
  ara: 12,
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

/** 0 = Sunday … 6 = Saturday (same as `Date#getDay`). */
const WEEKDAYS: Record<string, number> = {
  pazartesi: 1,
  sali: 2,
  carsamba: 3,
  persembe: 4,
  cuma: 5,
  cumartesi: 6,
  pazar: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
  mon: 1,
  tues: 2,
  tue: 2,
  wed: 3,
  thurs: 4,
  thur: 4,
  thu: 4,
  fri: 5,
}

const RELATIVE_DAYS: Record<string, number> = {
  'day after tomorrow': 2,
  'yarindan sonra': 2,
  'obur gun': 2,
  'obursu gun': 3,
  bugun: 0,
  today: 0,
  yarin: 1,
  tomorrow: 1,
  dun: -1,
  yesterday: -1,
}

interface PeriodDef {
  /** Default hour when no hour follows. */
  hour: number
  /** How a following 1–12 hour is read. */
  shift: 'am' | 'pm' | 'night'
}

/** Period words that name an exact moment, so they are never vague on their own. */
const EXACT_PERIODS = new Set(['gece yarisi', 'noon', 'midnight', 'tonight'])

/** Normalizes a matched period phrase for {@link EXACT_PERIODS} lookups. */
function foldPhrase(phrase: string): string {
  return phrase.trim().replace(/\s+/g, ' ')
}

const PERIODS: Record<string, PeriodDef> = {
  'gece yarisi': { hour: 0, shift: 'night' },
  'ogleden sonra': { hour: 15, shift: 'pm' },
  sabah: { hour: 9, shift: 'am' },
  oglen: { hour: 12, shift: 'pm' },
  ogleyin: { hour: 12, shift: 'pm' },
  ogle: { hour: 12, shift: 'pm' },
  aksam: { hour: 18, shift: 'pm' },
  gece: { hour: 22, shift: 'night' },
  morning: { hour: 9, shift: 'am' },
  noon: { hour: 12, shift: 'pm' },
  afternoon: { hour: 15, shift: 'pm' },
  evening: { hour: 18, shift: 'pm' },
  tonight: { hour: 20, shift: 'pm' },
  midnight: { hour: 0, shift: 'night' },
}

// ---------------------------------------------------------------------------
// Regex building blocks (applied to folded text, sticky at a word start)
// ---------------------------------------------------------------------------

function alternation(words: string[]): string {
  return [...words]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*'))
    .join('|')
}

/** End of a word: no letter or digit follows. */
const B = '(?![\\p{L}\\p{N}])'
/** Optional Turkish case suffix (`'da`, `de`, `'ya`, `e` …). */
const SFX = "(?:'?(?:da|de|ta|te|ya|ye|a|e))?"
const MERIDIEM = '(am|pm|a\\.m\\.|p\\.m\\.)'
const WEEKDAY_ALT = alternation(Object.keys(WEEKDAYS))
const UNIT_ALT = alternation(Object.keys(UNITS))
const WORDNUM_ALT = alternation(Object.keys(WORD_NUMBERS))

const sticky = (src: string): RegExp => new RegExp(src, 'uy')

/** Looks up a (possibly multi-word) matched phrase, ignoring inner whitespace. */
function lookup<T>(map: Record<string, T>, phrase: string): T | undefined {
  const key = phrase.replace(/\s+/g, '')
  for (const k of Object.keys(map)) if (k.replace(/\s+/g, '') === key) return map[k]
  return undefined
}

/**
 * Turkish month abbreviations collide with words (`ara` = call, `kasa` = box), so they
 * only take an apostrophe suffix and are never month-first (Turkish is day-first).
 */
const TR_MONTH_ABBR = new Set([
  'oca',
  'sub',
  'nis',
  'haz',
  'tem',
  'agu',
  'eyl',
  'eki',
  'kas',
  'ara',
])
const MONTH_FIRST_ALT = alternation(Object.keys(MONTHS).filter((m) => !TR_MONTH_ABBR.has(m)))
const TR_MONTH_ABBR_ALT = alternation([...TR_MONTH_ABBR])
const TR_CASE = '(?:da|de|ta|te|ya|ye|a|e)'

const RE = {
  durationPrefix: sticky('(?:in|after|within)\\s+'),
  durationItem: sticky(
    `(?:(\\d+(?:[.,]\\d+)?)(\\s+bucuk)?\\s*|(${WORDNUM_ALT})(\\s+bucuk)?\\s+)(${UNIT_ALT})` +
      `(?:'${TR_CASE}|(?<=saat|dakika|saniye|gun|hafta)${TR_CASE})?(?!\\p{L})`
  ),
  durationSeparator: sticky('\\s+(?:ve|and)\\s+|\\s*,\\s*|\\s*'),
  durationTrailingMinutes: sticky('(\\d{1,2})(?![\\p{L}\\p{N}])'),
  durationPostfix: sticky('\\s+(?:sonra|later|icinde|from\\s+now)'),
  timeColon: sticky(
    `(?:(?:at|saat)\\s+|@\\s*)?(\\d{1,2})[:.](\\d{2})(?![.:,]\\d)(?:\\s*${MERIDIEM})?${SFX}${B}`
  ),
  timeMeridiem: sticky(`(?:(?:at|saat)\\s+|@\\s*)?(\\d{1,2})\\s*${MERIDIEM}${SFX}${B}`),
  timeHour: sticky(`(?:(?:at|saat)\\s+(\\d{1,2})${SFX}|(\\d{1,2})'?(?:da|de|ta|te))${B}`),
  period: sticky(
    `(?:(?:bu|this|in\\s+the)\\s+)?(${alternation(Object.keys(PERIODS))})` +
      `(?:'?(?:leyin|yin|ki|da|de|ta|te|i))?` +
      `(?:\\s+(?:at\\s+|saat\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?${SFX})?${B}`
  ),
  relativeDay: sticky(
    `(${alternation(Object.keys(RELATIVE_DAYS))})(?:\\s*gun)?(?:'?(?:dan|den|ki|da|de|a|e))?${B}`
  ),
  weekday: sticky(
    `(?:(next|this|on|coming|gelecek|onumuzdeki|haftaya|bu)\\s+)?(${WEEKDAY_ALT})` +
      `(?:\\s+gun(?:u|une|unde))?${SFX}${B}`
  ),
  dayMonth: sticky(
    `(\\d{1,2})(?:st|nd|rd|th|\\.)?\\s*(?:(${MONTH_FIRST_ALT})${SFX}|(${TR_MONTH_ABBR_ALT})(?:'${TR_CASE})?)` +
      `(?:,?\\s+(\\d{4})${SFX})?${B}`
  ),
  monthDay: sticky(
    `(${MONTH_FIRST_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![:.]\\d)` +
      `(?!\\s*(?:${UNIT_ALT})(?:'|${TR_CASE})?(?!\\p{L}))(?:,?\\s+(\\d{4}))?${SFX}${B}`
  ),
  iso: sticky(`(\\d{4})-(\\d{1,2})-(\\d{1,2})(?:t(\\d{1,2}):(\\d{2}))?${B}`),
  numericDate: sticky(`(\\d{1,2})([./])(\\d{1,2})\\2(\\d{4}|\\d{2})(?![.:]\\d)${SFX}${B}`),
  separator: sticky('[\\s,]+'),
}

function execAt(re: RegExp, s: string, i: number): RegExpExecArray | null {
  re.lastIndex = i
  return re.exec(s)
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type DatePart =
  | { type: 'relative'; days: number }
  | { type: 'weekday'; weekday: number; mode: 'upcoming' | 'next' | 'nextWeek' }
  | { type: 'absolute'; y: number; m: number; d: number }
  | { type: 'yearless'; m: number; d: number }

interface TimePart {
  h: number
  min: number
  /** Hour-only form without am/pm (1–12). */
  ambiguous: boolean
  /** Bare day-part word without an hour (see `NaturalTimeMatch.vague`). */
  vague?: boolean
}

interface Component {
  start: number
  end: number
  date?: DatePart
  time?: TimePart
  durationMs?: number
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch)
}

function applyMeridiem(h: number, meridiem: string | undefined): number | null {
  if (!meridiem) return h <= 23 ? h : null
  if (h < 1 || h > 12) return null
  const pm = meridiem.startsWith('p')
  return (h % 12) + (pm ? 12 : 0)
}

function parseDurationAt(s: string, i: number): { end: number; ms: number } | null {
  let pos = i
  const prefix = execAt(RE.durationPrefix, s, pos)
  if (prefix) pos += prefix[0].length
  let total = 0
  let items = 0
  let lastUnit = 0
  for (;;) {
    const m = execAt(RE.durationItem, s, pos)
    if (!m) break
    const base =
      m[1] !== undefined ? parseFloat(m[1].replace(',', '.')) : (lookup(WORD_NUMBERS, m[3]) ?? 0)
    const half = (m[2] ?? m[4]) ? 0.5 : 0
    const unitWord = m[5]
    // Word numbers ("bir", "an") only pair with real unit words, not letters.
    if (m[1] === undefined && unitWord.length < 2) break
    total += (base + half) * UNITS[unitWord]
    lastUnit = UNITS[unitWord]
    items++
    pos = m.index + m[0].length
    const sep = execAt(RE.durationSeparator, s, pos)
    const next = sep ? pos + sep[0].length : pos
    if (!execAt(RE.durationItem, s, next)) break
    pos = next
  }
  if (items === 0) return null
  // "1h30" / "1s30": trailing bare minutes after an hour unit.
  if (lastUnit === HOUR) {
    const trailing = execAt(RE.durationTrailingMinutes, s, pos)
    if (trailing) {
      total += parseInt(trailing[1], 10) * MINUTE
      pos += trailing[0].length
    }
  }
  if (isWordChar(s[pos])) return null
  const postfix = execAt(RE.durationPostfix, s, pos)
  if (postfix && !isWordChar(s[pos + postfix[0].length])) pos += postfix[0].length
  const ms = Math.round(total)
  return ms > 0 ? { end: pos, ms } : null
}

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function expandYear(y: string): number {
  return y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)
}

/** All component matchers; the longest match at a position wins. */
const MATCHERS: ((s: string, i: number) => Component | null)[] = [
  (s, i) => {
    const r = parseDurationAt(s, i)
    return r ? { start: i, end: r.end, durationMs: r.ms } : null
  },
  (s, i) => {
    const m = execAt(RE.timeColon, s, i)
    if (!m) return null
    const h = applyMeridiem(parseInt(m[1], 10), m[3])
    const min = parseInt(m[2], 10)
    if (h === null || min > 59) return null
    return { start: i, end: i + m[0].length, time: { h, min, ambiguous: false } }
  },
  (s, i) => {
    const m = execAt(RE.timeMeridiem, s, i)
    if (!m) return null
    const h = applyMeridiem(parseInt(m[1], 10), m[2])
    if (h === null) return null
    return { start: i, end: i + m[0].length, time: { h, min: 0, ambiguous: false } }
  },
  (s, i) => {
    const m = execAt(RE.timeHour, s, i)
    if (!m) return null
    const h = parseInt(m[1] ?? m[2], 10)
    if (h > 23) return null
    return { start: i, end: i + m[0].length, time: { h, min: 0, ambiguous: h >= 1 && h <= 12 } }
  },
  (s, i) => {
    const m = execAt(RE.period, s, i)
    if (!m) return null
    const def = lookup(PERIODS, m[1])
    if (!def) return null
    let h = def.hour
    let min = 0
    if (m[2] !== undefined) {
      h = parseInt(m[2], 10)
      min = m[3] !== undefined ? parseInt(m[3], 10) : 0
      if (h > 23 || min > 59) return null
      if (def.shift === 'pm' && h >= 1 && h < 12) h += 12
      if (def.shift === 'night' && h >= 7 && h < 12) h += 12
      if (def.shift === 'night' && h === 12) h = 0
    }
    const vague = m[2] === undefined && !EXACT_PERIODS.has(foldPhrase(m[1]))
    return { start: i, end: i + m[0].length, time: { h, min, ambiguous: false, vague } }
  },
  (s, i) => {
    const m = execAt(RE.relativeDay, s, i)
    if (!m) return null
    const days = lookup(RELATIVE_DAYS, m[1])
    if (days === undefined) return null
    return { start: i, end: i + m[0].length, date: { type: 'relative', days } }
  },
  (s, i) => {
    const m = execAt(RE.weekday, s, i)
    if (!m) return null
    const mod = m[1]
    const mode =
      mod === 'haftaya'
        ? 'nextWeek'
        : mod === 'next' || mod === 'gelecek' || mod === 'onumuzdeki'
          ? 'next'
          : 'upcoming'
    return {
      start: i,
      end: i + m[0].length,
      date: { type: 'weekday', weekday: WEEKDAYS[m[2]], mode },
    }
  },
  (s, i) => {
    const m = execAt(RE.dayMonth, s, i)
    if (!m) return null
    return monthDate(i, i + m[0].length, MONTHS[m[2] ?? m[3]], parseInt(m[1], 10), m[4])
  },
  (s, i) => {
    const m = execAt(RE.monthDay, s, i)
    if (!m) return null
    return monthDate(i, i + m[0].length, MONTHS[m[1]], parseInt(m[2], 10), m[3])
  },
  (s, i) => {
    const m = execAt(RE.iso, s, i)
    if (!m) return null
    const [y, mo, d] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
    if (!validDate(y, mo, d)) return null
    const c: Component = {
      start: i,
      end: i + m[0].length,
      date: { type: 'absolute', y, m: mo, d },
    }
    if (m[4] !== undefined) {
      const h = parseInt(m[4], 10)
      const min = parseInt(m[5], 10)
      if (h > 23 || min > 59) return null
      c.time = { h, min, ambiguous: false }
    }
    return c
  },
  (s, i) => {
    const m = execAt(RE.numericDate, s, i)
    if (!m) return null
    const [d, mo, y] = [parseInt(m[1], 10), parseInt(m[3], 10), expandYear(m[4])]
    if (!validDate(y, mo, d)) return null
    return { start: i, end: i + m[0].length, date: { type: 'absolute', y, m: mo, d } }
  },
]

function monthDate(
  start: number,
  end: number,
  m: number,
  d: number,
  year: string | undefined
): Component | null {
  if (d < 1 || d > 31) return null
  if (year !== undefined) {
    const y = parseInt(year, 10)
    return validDate(y, m, d) ? { start, end, date: { type: 'absolute', y, m, d } } : null
  }
  return { start, end, date: { type: 'yearless', m, d } }
}

function componentAt(s: string, i: number): Component | null {
  let best: Component | null = null
  for (const matcher of MATCHERS) {
    const c = matcher(s, i)
    if (c && (!best || c.end > best.end)) best = c
  }
  return best
}

/** Scans left to right for components, then merges adjacent date + time pieces. */
function findExpressions(folded: string): Component[] {
  const comps: Component[] = []
  let i = 0
  while (i < folded.length) {
    if (!isWordChar(folded[i - 1]) && (isWordChar(folded[i]) || folded[i] === '@')) {
      const c = componentAt(folded, i)
      if (c) {
        comps.push(c)
        i = c.end
        continue
      }
    }
    i++
  }
  const groups: Component[] = []
  for (const c of comps) {
    const prev = groups[groups.length - 1]
    if (prev && canMerge(prev, c, folded)) {
      prev.end = c.end
      prev.date = prev.date ?? c.date
      prev.time = prev.time ?? c.time
    } else {
      groups.push({ ...c })
    }
  }
  return groups
}

function canMerge(a: Component, b: Component, s: string): boolean {
  if (a.durationMs !== undefined || b.durationMs !== undefined) return false
  if ((a.date && b.date) || (a.time && b.time)) return false
  const sep = execAt(RE.separator, s, a.end)
  return sep !== null && a.end + sep[0].length === b.start
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function addDays(base: Date, days: number, h = 0, min = 0): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, h, min, 0, 0)
}

function resolveDay(date: DatePart, now: Date, preferFuture: boolean): Date | null {
  switch (date.type) {
    case 'relative':
      return addDays(now, date.days)
    case 'weekday': {
      const today = now.getDay()
      let diff = (date.weekday - today + 7) % 7
      if (date.mode === 'next' && diff === 0) diff = 7
      if (date.mode === 'nextWeek') {
        const toNextMonday = (1 - today + 7) % 7 || 7
        diff = toNextMonday + ((date.weekday + 6) % 7)
      }
      return addDays(now, diff)
    }
    case 'absolute':
      return new Date(date.y, date.m - 1, date.d)
    case 'yearless': {
      let y = now.getFullYear()
      const todayStart = addDays(now, 0)
      if (preferFuture && validDate(y, date.m, date.d)) {
        if (new Date(y, date.m - 1, date.d) < todayStart) y++
      }
      return validDate(y, date.m, date.d) ? new Date(y, date.m - 1, date.d) : null
    }
  }
}

interface Resolved {
  kind: NaturalTimeKind
  at: Date
  durationMs?: number
}

function resolve(c: Component, now: Date, opts: NaturalTimeOptions): Resolved | null {
  const roll = opts.rollPastTimes !== false
  const nextPolicy = opts.ambiguousHours !== 'as-is'
  if (c.durationMs !== undefined) {
    return {
      kind: 'duration',
      at: new Date(now.getTime() + c.durationMs),
      durationMs: c.durationMs,
    }
  }
  const day = c.date ? resolveDay(c.date, now, opts.preferFutureDates !== false) : null
  if (c.date && !day) return null
  const t = c.time
  if (!t) return day ? { kind: 'date', at: day } : null

  if (day) {
    const h = t.ambiguous && nextPolicy && t.h <= 6 ? t.h + 12 : t.h
    let at = addDays(day, 0, h, t.min)
    if (roll && c.date?.type === 'weekday' && c.date.mode === 'upcoming' && at <= now) {
      at = addDays(day, 7, h, t.min)
    }
    return { kind: 'datetime', at }
  }

  const hours = t.ambiguous && nextPolicy ? [t.h % 12, (t.h % 12) + 12] : [t.h]
  for (const h of hours) {
    const at = addDays(now, 0, h, t.min)
    if (at > now) return { kind: 'datetime', at }
  }
  return {
    kind: 'datetime',
    at: roll ? addDays(now, 1, hours[0], t.min) : addDays(now, 0, t.h, t.min),
  }
}

function cleanRest(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:\-–—]+|[\s,;:\-–—]+$/g, '')
    .replace(/\s+([,;:])/g, '$1')
    .trim()
}

function removeSpans(text: string, spans: [number, number][]): string {
  let out = ''
  let pos = 0
  for (const [start, end] of spans) {
    out += text.slice(pos, start) + ' '
    pos = end
  }
  return cleanRest(out + text.slice(pos))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Finds every date/time/duration expression in `text`, left to right.
 *
 * Useful when a sentence carries both a start and a length, e.g. a calendar
 * entry `yarın 14:00 1s toplantı` → `[datetime, duration]`, rest `toplantı`.
 *
 * @returns The matches (each with its own `rest`) and the text with all of them removed.
 */
export function parseNaturalTimeAll(
  text: string,
  options: NaturalTimeOptions = {}
): { matches: NaturalTimeMatch[]; rest: string } {
  const now = new Date(options.now ?? Date.now())
  const folded = foldDiacritics(text)
  const matches: NaturalTimeMatch[] = []
  for (const c of findExpressions(folded)) {
    const r = resolve(c, now, options)
    if (!r) continue
    const consumed: [number, number] = [c.start, c.end]
    matches.push({
      kind: r.kind,
      at: r.at,
      allDay: r.kind === 'date',
      ...(r.durationMs !== undefined ? { durationMs: r.durationMs } : {}),
      matched: text.slice(c.start, c.end),
      consumed,
      rest: removeSpans(text, [consumed]),
      ...(c.time?.vague && !c.date ? { vague: true } : {}),
    })
  }
  return {
    matches,
    rest: removeSpans(
      text,
      matches.map((m) => m.consumed)
    ),
  }
}

/**
 * Parses the first (leftmost) date/time/duration expression in `text`.
 *
 * @example
 * parseNaturalTime("toplantı yarın 9'da", { now })
 * // → { kind: 'datetime', at: <tomorrow 09:00>, allDay: false,
 * //     matched: "yarın 9'da", consumed: [9, 19], rest: 'toplantı' }
 * parseNaturalTime('10dk çay', { now })
 * // → { kind: 'duration', durationMs: 600000, at: now + 10 min, rest: 'çay', … }
 *
 * @returns The match, or `null` when `text` holds no recognizable expression.
 */
export function parseNaturalTime(
  text: string,
  options: NaturalTimeOptions = {}
): NaturalTimeMatch | null {
  return parseNaturalTimeAll(text, options).matches[0] ?? null
}

/**
 * Parses a string that is *only* a duration (surrounding whitespace allowed),
 * e.g. an event length: `1s` → 3 600 000, `90dk`, `1s30dk`, `1.5h`, `yarım saat`.
 *
 * @returns Milliseconds, or `null` if the string is not a positive duration.
 */
export function parseDuration(text: string): number | null {
  const folded = foldDiacritics(text.trim())
  if (!folded) return null
  const r = parseDurationAt(folded, 0)
  return r && r.end === folded.length ? r.ms : null
}

interface DurationLabels {
  d: string
  h: string
  m: string
  s: string
  sep: string
  overdue: string
}

const DURATION_LABELS: Record<string, DurationLabels> = {
  en: { d: 'd', h: 'h', m: 'm', s: 's', sep: ' ', overdue: 'overdue' },
  tr: { d: 'g', h: 'sa', m: 'dk', s: 'sn', sep: ' ', overdue: 'geçti' },
  ja: { d: '日', h: '時間', m: '分', s: '秒', sep: '', overdue: '期限切れ' },
}

function labelsFor(locale: string): DurationLabels {
  return DURATION_LABELS[locale.toLowerCase().split(/[-_]/)[0]] ?? DURATION_LABELS.en
}

/**
 * Compact two-unit duration: `1d 2h`, `2h 5m`, `20m`, `1m 30s` (seconds only
 * shown under 5 minutes). Localized for `en` (default), `tr` (`1g 2sa`,
 * `1dk 30sn`) and `ja` (`1日2時間`); other locales fall back to English.
 */
export function formatDuration(ms: number, locale = 'en'): string {
  const L = labelsFor(locale)
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pair = (a: number, ua: string, b: number, ub: string): string =>
    b > 0 ? `${a}${ua}${L.sep}${b}${ub}` : `${a}${ua}`
  if (days > 0) return pair(days, L.d, hours, L.h)
  if (hours > 0) return pair(hours, L.h, minutes, L.m)
  if (minutes > 0) return pair(minutes, L.m, minutes < 5 ? seconds : 0, L.s)
  return `${seconds}${L.s}`
}

/**
 * Time left until a deadline, as {@link formatDuration}; non-positive deltas
 * give the locale's "overdue" word (`overdue` / `geçti` / `期限切れ`).
 */
export function formatRemaining(deltaMs: number, locale = 'en'): string {
  return deltaMs <= 0 ? labelsFor(locale).overdue : formatDuration(deltaMs, locale)
}
