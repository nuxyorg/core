/* cspell:disable -- Turkish/English date vocabulary and fixtures. */
import { describe, it, expect } from 'vitest'
import {
  parseNaturalTime,
  parseNaturalTimeAll,
  parseDuration,
  formatDuration,
  formatRemaining,
  foldDiacritics,
  type NaturalTimeKind,
} from './natural-time.ts'

/** Tuesday, 10 November 2026, 10:00 local time. */
const NOW = new Date(2026, 10, 10, 10, 0, 0, 0)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** Local wall-clock date (month is 1-based), DST-agnostic. */
const local = (y: number, mo: number, d: number, h = 0, mi = 0): number =>
  new Date(y, mo - 1, d, h, mi, 0, 0).getTime()

function parse(text: string, opts = {}) {
  return parseNaturalTime(text, { now: NOW, ...opts })
}

describe('foldDiacritics', () => {
  it('folds Turkish letters and case, keeping length', () => {
    const s = 'İĞÜŞÖÇ ığüşöç Iİ’'
    expect(foldDiacritics(s)).toBe("igusoc igusoc ii'")
    expect(foldDiacritics(s)).toHaveLength(s.length)
    expect(foldDiacritics('Café 🎉')).toBe('cafe 🎉')
  })
})

describe('parseNaturalTime: durations', () => {
  const cases: [string, number][] = [
    ['10dk', 10 * MIN],
    ['10 dk', 10 * MIN],
    ['10m', 10 * MIN],
    ['10 min', 10 * MIN],
    ['10 mins', 10 * MIN],
    ['10 minutes', 10 * MIN],
    ['10 dakika', 10 * MIN],
    ['10 dak', 10 * MIN],
    ['10 DK', 10 * MIN],
    ['1 minute', MIN],
    ['1s30dk', 90 * MIN],
    ['1h30m', 90 * MIN],
    ['1h 30m', 90 * MIN],
    ['1 saat 30 dakika', 90 * MIN],
    ['1 saat ve 30 dakika', 90 * MIN],
    ['1 hour and 30 minutes', 90 * MIN],
    ['1h30', 90 * MIN],
    ['1s30', 90 * MIN],
    ['1.5 saat', 90 * MIN],
    ['1,5 saat', 90 * MIN],
    ['1.5h', 90 * MIN],
    ['2h', 2 * HOUR],
    ['2 hours', 2 * HOUR],
    ['2 hrs', 2 * HOUR],
    ['2 sa', 2 * HOUR],
    ['2saat', 2 * HOUR],
    ['2 s', 2 * HOUR],
    ['in 2 hours', 2 * HOUR],
    ['after 5 minutes', 5 * MIN],
    ['2 saat sonra', 2 * HOUR],
    ['2 hours later', 2 * HOUR],
    ['2 hours from now', 2 * HOUR],
    ['10 dakika içinde', 10 * MIN],
    ['5 dakikada', 5 * MIN],
    ['2 saatte', 2 * HOUR],
    ["10dk'da", 10 * MIN],
    ['45sn', 45 * 1000],
    ['30 sec', 30 * 1000],
    ['30 seconds', 30 * 1000],
    ['30 saniye', 30 * 1000],
    ['3g', 3 * DAY],
    ['3 gün', 3 * DAY],
    ['3 gun', 3 * DAY],
    ['2 days', 2 * DAY],
    ['1d', DAY],
    ['1w', 7 * DAY],
    ['2 hafta', 14 * DAY],
    ['2 weeks', 14 * DAY],
    ['yarım saat', 30 * MIN],
    ['half an hour', 30 * MIN],
    ['an hour', HOUR],
    ['a minute', MIN],
    ['bir saat', HOUR],
    ['1 buçuk saat', 90 * MIN],
    ['1 sa 20 dk', 80 * MIN],
    ['2.5 hafta', 17.5 * DAY],
    ['bir buçuk saat', 90 * MIN],
  ]
  it.each(cases)('%s', (input, ms) => {
    const r = parse(input)
    expect(r).not.toBeNull()
    expect(r!.kind).toBe('duration')
    expect(r!.durationMs).toBe(ms)
    expect(r!.at.getTime()).toBe(NOW.getTime() + ms)
    expect(r!.allDay).toBe(false)
    expect(r!.rest).toBe('')
  })
})

describe('parseNaturalTime: times of day', () => {
  // NOW is 10:00. Passed times roll to tomorrow; bare 1–12 hours pick the next occurrence.
  const cases: [string, number][] = [
    ['15:30', local(2026, 11, 10, 15, 30)],
    ['15.30', local(2026, 11, 10, 15, 30)],
    ['09:30', local(2026, 11, 11, 9, 30)],
    ['9:30', local(2026, 11, 11, 9, 30)],
    ['10:00', local(2026, 11, 11, 10, 0)],
    ['10:01', local(2026, 11, 10, 10, 1)],
    ['23:59', local(2026, 11, 10, 23, 59)],
    ['0:30', local(2026, 11, 11, 0, 30)],
    ['21:00', local(2026, 11, 10, 21, 0)],
    ["15:30'da", local(2026, 11, 10, 15, 30)],
    ['at 15:30', local(2026, 11, 10, 15, 30)],
    ['3pm', local(2026, 11, 10, 15, 0)],
    ['3 pm', local(2026, 11, 10, 15, 0)],
    ['3PM', local(2026, 11, 10, 15, 0)],
    ['3 p.m.', local(2026, 11, 10, 15, 0)],
    ['3:30 pm', local(2026, 11, 10, 15, 30)],
    ['3:30pm', local(2026, 11, 10, 15, 30)],
    ['11am', local(2026, 11, 10, 11, 0)],
    ['9am', local(2026, 11, 11, 9, 0)],
    ['12am', local(2026, 11, 11, 0, 0)],
    ['12pm', local(2026, 11, 10, 12, 0)],
    ["9'da", local(2026, 11, 10, 21, 0)],
    ['9da', local(2026, 11, 10, 21, 0)],
    ["11'de", local(2026, 11, 10, 11, 0)],
    ["3'te", local(2026, 11, 10, 15, 0)],
    ['5te', local(2026, 11, 10, 17, 0)],
    ["12'de", local(2026, 11, 10, 12, 0)],
    ['saat 9', local(2026, 11, 10, 21, 0)],
    ["saat 9'da", local(2026, 11, 10, 21, 0)],
    ['saat 14', local(2026, 11, 10, 14, 0)],
    ['saat 9:30', local(2026, 11, 11, 9, 30)],
    ['at 5', local(2026, 11, 10, 17, 0)],
    ['sabah 9', local(2026, 11, 11, 9, 0)],
    ['sabah', local(2026, 11, 11, 9, 0)],
    ['akşam 7', local(2026, 11, 10, 19, 0)],
    ["akşam 7'de", local(2026, 11, 10, 19, 0)],
    ['akşam', local(2026, 11, 10, 18, 0)],
    ['bu akşam', local(2026, 11, 10, 18, 0)],
    ['tonight', local(2026, 11, 10, 20, 0)],
    ['noon', local(2026, 11, 10, 12, 0)],
    ['öğlen', local(2026, 11, 10, 12, 0)],
    ['midnight', local(2026, 11, 11, 0, 0)],
    ['gece 2', local(2026, 11, 11, 2, 0)],
    ['gece 11', local(2026, 11, 10, 23, 0)],
    ['evening 8', local(2026, 11, 10, 20, 0)],
    ['gece yarısı', local(2026, 11, 11, 0, 0)],
    ['öğleden sonra 3', local(2026, 11, 10, 15, 0)],
    ['in the morning', local(2026, 11, 11, 9, 0)],
  ]
  it.each(cases)('%s', (input, at) => {
    const r = parse(input)
    expect(r).not.toBeNull()
    expect(r!.kind).toBe('datetime')
    expect(r!.allDay).toBe(false)
    expect(new Date(r!.at).toString()).toBe(new Date(at).toString())
    expect(r!.rest).toBe('')
  })

  it('does not roll passed times when rollPastTimes is false', () => {
    expect(parse('09:30', { rollPastTimes: false })!.at.getTime()).toBe(local(2026, 11, 10, 9, 30))
  })

  it("takes bare hours as written with ambiguousHours: 'as-is'", () => {
    expect(parse("9'da", { ambiguousHours: 'as-is' })!.at.getTime()).toBe(local(2026, 11, 11, 9, 0))
    expect(parse("3'te", { ambiguousHours: 'as-is' })!.at.getTime()).toBe(local(2026, 11, 11, 3, 0))
  })

  it('rolls a bare hour to tomorrow morning when both readings passed', () => {
    const late = new Date(2026, 10, 10, 22, 0)
    expect(parseNaturalTime("9'da", { now: late })!.at.getTime()).toBe(local(2026, 11, 11, 9, 0))
  })

  it('accepts a numeric now', () => {
    expect(parseNaturalTime('15:30', { now: NOW.getTime() })!.at.getTime()).toBe(
      local(2026, 11, 10, 15, 30)
    )
  })
})

describe('parseNaturalTime: dates', () => {
  const cases: [string, number][] = [
    ['bugün', local(2026, 11, 10)],
    ['today', local(2026, 11, 10)],
    ['yarın', local(2026, 11, 11)],
    ['yarin', local(2026, 11, 11)],
    ['YARIN', local(2026, 11, 11)],
    ['Yarın', local(2026, 11, 11)],
    ['tomorrow', local(2026, 11, 11)],
    ['öbür gün', local(2026, 11, 12)],
    ['obur gun', local(2026, 11, 12)],
    ['öbürgün', local(2026, 11, 12)],
    ['yarından sonra', local(2026, 11, 12)],
    ['day after tomorrow', local(2026, 11, 12)],
    ['dün', local(2026, 11, 9)],
    ['yesterday', local(2026, 11, 9)],
    ['pazartesi', local(2026, 11, 16)],
    ['salı', local(2026, 11, 10)],
    ['çarşamba', local(2026, 11, 11)],
    ['carsamba', local(2026, 11, 11)],
    ['perşembe', local(2026, 11, 12)],
    ['cuma', local(2026, 11, 13)],
    ['cumartesi', local(2026, 11, 14)],
    ['pazar', local(2026, 11, 15)],
    ['monday', local(2026, 11, 16)],
    ['Friday', local(2026, 11, 13)],
    ['fri', local(2026, 11, 13)],
    ['next friday', local(2026, 11, 13)],
    ['next tuesday', local(2026, 11, 17)],
    ['this friday', local(2026, 11, 13)],
    ['on friday', local(2026, 11, 13)],
    ['gelecek cuma', local(2026, 11, 13)],
    ['önümüzdeki salı', local(2026, 11, 17)],
    ['haftaya cuma', local(2026, 11, 20)],
    ['haftaya salı', local(2026, 11, 17)],
    ['bu cuma', local(2026, 11, 13)],
    ['cuma günü', local(2026, 11, 13)],
    ['cumaya', local(2026, 11, 13)],
    ['12 kasım', local(2026, 11, 12)],
    ['12 Kasım', local(2026, 11, 12)],
    ['12 kasim', local(2026, 11, 12)],
    ['12 kasımda', local(2026, 11, 12)],
    ["12 kasım'da", local(2026, 11, 12)],
    ['12. kasım', local(2026, 11, 12)],
    ['12 Nov', local(2026, 11, 12)],
    ['12 november', local(2026, 11, 12)],
    ['nov 12', local(2026, 11, 12)],
    ['Nov. 12', local(2026, 11, 12)],
    ['November 12th', local(2026, 11, 12)],
    ['12th nov', local(2026, 11, 12)],
    ['1 ocak', local(2027, 1, 1)],
    ['9 kasım', local(2027, 11, 9)],
    ['10 kasım', local(2026, 11, 10)],
    ['25 aralık', local(2026, 12, 25)],
    ['3 mart', local(2027, 3, 3)],
    ['15 mayıs', local(2027, 5, 15)],
    ['12 kasım 2027', local(2027, 11, 12)],
    ['nov 12, 2027', local(2027, 11, 12)],
    ['2026-11-12', local(2026, 11, 12)],
    ['2026-1-5', local(2026, 1, 5)],
    ['12.11.2026', local(2026, 11, 12)],
    ['5 kas', local(2027, 11, 5)],
    ["12 Ara'da", local(2026, 12, 12)],
    ['12/11/2026', local(2026, 11, 12)],
    ['12.11.26', local(2026, 11, 12)],
    ['1.2.2027', local(2027, 2, 1)],
  ]
  it.each(cases)('%s', (input, at) => {
    const r = parse(input)
    expect(r).not.toBeNull()
    expect(r!.kind).toBe('date')
    expect(r!.allDay).toBe(true)
    expect(new Date(r!.at).toString()).toBe(new Date(at).toString())
    expect(r!.rest).toBe('')
  })

  it('keeps yearless past dates in this year when preferFutureDates is false', () => {
    expect(parse('1 ocak', { preferFutureDates: false })!.at.getTime()).toBe(local(2026, 1, 1))
  })

  it.each(['31 şubat', '2026-02-30', '29 şubat', '32.01.2026', '12.13.2026'])(
    'rejects invalid date %s',
    (input) => {
      expect(parse(input)).toBeNull()
    }
  )
})

describe('parseNaturalTime: date + time combos', () => {
  const cases: [string, number][] = [
    ["yarın 9'da", local(2026, 11, 11, 9, 0)],
    ['yarın 9da', local(2026, 11, 11, 9, 0)],
    ["yarın 3'te", local(2026, 11, 11, 15, 0)],
    ['yarın 15:30', local(2026, 11, 11, 15, 30)],
    ['yarın saat 9', local(2026, 11, 11, 9, 0)],
    ['yarın sabah', local(2026, 11, 11, 9, 0)],
    ["yarın sabah 8'de", local(2026, 11, 11, 8, 0)],
    ['yarın akşam', local(2026, 11, 11, 18, 0)],
    ['tomorrow morning', local(2026, 11, 11, 9, 0)],
    ['tomorrow at 3pm', local(2026, 11, 11, 15, 0)],
    ['3pm tomorrow', local(2026, 11, 11, 15, 0)],
    ['15:30 yarın', local(2026, 11, 11, 15, 30)],
    ['cuma 14:00', local(2026, 11, 13, 14, 0)],
    ['cuma, 14:00', local(2026, 11, 13, 14, 0)],
    ['pazartesi 14:00', local(2026, 11, 16, 14, 0)],
    ['salı 9:00', local(2026, 11, 17, 9, 0)],
    ['salı 11:00', local(2026, 11, 10, 11, 0)],
    ['friday at 2pm', local(2026, 11, 13, 14, 0)],
    ['next friday 10am', local(2026, 11, 13, 10, 0)],
    ['12 kasım 10:30', local(2026, 11, 12, 10, 30)],
    ["12 kasım saat 10'da", local(2026, 11, 12, 10, 0)],
    ['12 Nov 10:30', local(2026, 11, 12, 10, 30)],
    ['nov 12 at 9am', local(2026, 11, 12, 9, 0)],
    ['2026-11-12 10:30', local(2026, 11, 12, 10, 30)],
    ['2026-11-12T10:30', local(2026, 11, 12, 10, 30)],
    ['12.11.2026 14:00', local(2026, 11, 12, 14, 0)],
    ["bugün 9'da", local(2026, 11, 10, 9, 0)],
    ['today 18:00', local(2026, 11, 10, 18, 0)],
  ]
  it.each(cases)('%s', (input, at) => {
    const r = parse(input)
    expect(r).not.toBeNull()
    expect(r!.kind).toBe('datetime')
    expect(r!.allDay).toBe(false)
    expect(new Date(r!.at).toString()).toBe(new Date(at).toString())
    expect(r!.rest).toBe('')
  })
})

describe('parseNaturalTime: label text', () => {
  const cases: [string, NaturalTimeKind, string][] = [
    ['10dk çay demle', 'duration', 'çay demle'],
    ['çay demle 10dk', 'duration', 'çay demle'],
    ['10 dakika sonra ara', 'duration', 'ara'],
    ['remind me in 2 hours to stretch', 'duration', 'remind me to stretch'],
    ["toplantı yarın 9'da", 'datetime', 'toplantı'],
    ["yarın 9'da toplantı", 'datetime', 'toplantı'],
    ['call mom tomorrow at 3pm', 'datetime', 'call mom'],
    ['15:30 ilaç', 'datetime', 'ilaç'],
    ['ilaç iç, 15:30', 'datetime', 'ilaç iç'],
    ['doğum günü 12 kasım', 'date', 'doğum günü'],
    ['Dentist on Friday', 'date', 'Dentist'],
    ['  10dk   çay  ', 'duration', 'çay'],
    ["Ahmet'i ara 5 dakika sonra", 'duration', "Ahmet'i ara"],
    ['Pazar günü 10:00 kahvaltı', 'datetime', 'kahvaltı'],
  ]
  it.each(cases)('%s', (input, kind, rest) => {
    const r = parse(input)
    expect(r).not.toBeNull()
    expect(r!.kind).toBe(kind)
    expect(r!.rest).toBe(rest)
  })

  it('reports the matched text (original case) and its span', () => {
    const text = "Toplantı Yarın 9'da"
    const r = parse(text)!
    expect(r.matched).toBe("Yarın 9'da")
    expect(r.consumed).toEqual([9, text.length])
    expect(text.slice(...r.consumed)).toBe(r.matched)
  })

  it('takes the leftmost expression', () => {
    expect(parse('10dk sonra, sonra 15:30')!.kind).toBe('duration')
  })
})

describe('parseNaturalTime: non-matches', () => {
  it.each([
    '',
    '   ',
    '10',
    '2026',
    '5',
    'hello',
    'merhaba dünya',
    '10 kişi',
    '3 elma',
    '25:00',
    '24:61',
    '10:75',
    '13pm',
    '1.5',
    'v1.2.3',
    'abc10dk',
    '10dkx',
    'saat',
    'version 2',
    'room 101',
    'mart',
    'pazartesiler',
    'iPhone 15',
    '0dk',
    '12/2026',
    'at',
    'in 2',
    'samsung',
    'cumhuriyet',
    'sabahattin',
    '5 kasa',
    'ara 5',
    '12:30:45',
    'saat 25',
  ])('%j → null', (input) => {
    expect(parse(input)).toBeNull()
  })
})

describe('parseNaturalTimeAll', () => {
  it('returns every expression and the label without them', () => {
    const { matches, rest } = parseNaturalTimeAll('yarın 14:00 1s toplantı', { now: NOW })
    expect(matches.map((m) => m.kind)).toEqual(['datetime', 'duration'])
    expect(matches[0].at.getTime()).toBe(local(2026, 11, 11, 14, 0))
    expect(matches[1].durationMs).toBe(HOUR)
    expect(rest).toBe('toplantı')
  })

  it('returns an empty list and the trimmed text when nothing matches', () => {
    expect(parseNaturalTimeAll('  hello ', { now: NOW })).toEqual({ matches: [], rest: 'hello' })
  })
})

describe('parseDuration', () => {
  it.each([
    ['1s', HOUR],
    ['90dk', 90 * MIN],
    ['1s30dk', 90 * MIN],
    ['1h30m', 90 * MIN],
    ['2 saat', 2 * HOUR],
    ['45 min', 45 * MIN],
    ['1.5h', 90 * MIN],
    ['yarım saat', 30 * MIN],
    ['  15dk  ', 15 * MIN],
    ['2 Gün', 2 * DAY],
  ] as [string, number][])('%s → %d', (input, ms) => {
    expect(parseDuration(input)).toBe(ms)
  })

  it.each(['10', '', 'yarın', '10dk çay', '0dk', '15:30', 'abc'])('%j → null', (input) => {
    expect(parseDuration(input)).toBeNull()
  })
})

describe('formatDuration / formatRemaining', () => {
  it.each([
    [90_000, 'en', '1m 30s'],
    [20 * MIN, 'en', '20m'],
    [2 * HOUR, 'en', '2h'],
    [2 * HOUR + 5 * MIN, 'en', '2h 5m'],
    [DAY + 2 * HOUR, 'en', '1d 2h'],
    [3 * DAY, 'en', '3d'],
    [45_000, 'en', '45s'],
    [12 * MIN + 30_000, 'en', '12m'],
    [90_000, 'tr', '1dk 30sn'],
    [2 * HOUR + 5 * MIN, 'tr', '2sa 5dk'],
    [DAY + 2 * HOUR, 'tr-TR', '1g 2sa'],
    [90_000, 'ja', '1分30秒'],
    [2 * HOUR + 5 * MIN, 'ja', '2時間5分'],
    [DAY + 2 * HOUR, 'ja-JP', '1日2時間'],
    [20 * MIN, 'de', '20m'],
  ] as [number, string, string][])('%d ms in %s → %s', (ms, locale, out) => {
    expect(formatRemaining(ms, locale)).toBe(out)
    expect(formatDuration(ms, locale)).toBe(out)
  })

  it('formatRemaining reports overdue for non-positive deltas', () => {
    expect(formatRemaining(0)).toBe('overdue')
    expect(formatRemaining(-5000, 'tr')).toBe('geçti')
    expect(formatRemaining(-1, 'ja')).toBe('期限切れ')
  })

  it('formatDuration renders zero as 0s', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(400, 'tr')).toBe('0sn')
  })
})

describe('parseNaturalTime: vague day-part words', () => {
  it.each([
    'sabah',
    'akşam',
    'bu akşam',
    'gece',
    'in the morning',
    'gece ışığı',
    'akşam çöpü çıkar',
  ])('%j is flagged vague (bare period word, no hour or day)', (input) => {
    expect(parse(input)?.vague).toBe(true)
  })
  it.each([
    'akşam 7',
    "akşam 7'de",
    'yarın akşam',
    'cuma sabah',
    'tonight',
    'noon',
    'midnight',
    'gece yarısı',
    'gece 2',
    '15:30',
    '10dk',
    'yarın',
  ])('%j is not vague', (input) => {
    expect(parse(input)?.vague).toBeFalsy()
  })
})
