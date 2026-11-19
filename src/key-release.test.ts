// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackHeldKeys, waitForKeyRelease } from './key-release.ts'

function key(target: EventTarget, type: 'keydown' | 'keyup', name: string): void {
  const event = new Event(type) as Event & { key: string }
  event.key = name
  target.dispatchEvent(event)
}

/** A tracked target with `name` currently held down. */
function holding(name: string): EventTarget {
  const target = new EventTarget()
  trackHeldKeys(target)
  key(target, 'keydown', name)
  return target
}

describe('waitForKeyRelease', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('resolves when the held key is released, ignoring other keys', async () => {
    const target = holding('Delete')
    let done = false
    void waitForKeyRelease('Delete', 2000, target).then(() => (done = true))
    key(target, 'keyup', 'a')
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    key(target, 'keyup', 'Delete')
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('resolves after the timeout if the release is never seen', async () => {
    const target = holding('Delete')
    let done = false
    void waitForKeyRelease('Delete', 2000, target).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(1999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })

  it('resolves at once when the key is not held (Ctrl+K palette, chip click)', async () => {
    const target = new EventTarget()
    trackHeldKeys(target)
    let done = false
    void waitForKeyRelease('Delete', 2000, target).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('resolves at once once the key was already released', async () => {
    const target = holding('Delete')
    key(target, 'keyup', 'Delete')
    let done = false
    void waitForKeyRelease('Delete', 2000, target).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('forgets held keys on blur (the keyup lands in another window)', async () => {
    const target = holding('Delete')
    target.dispatchEvent(new Event('blur'))
    let done = false
    void waitForKeyRelease('Delete', 2000, target).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('tracks the window by default', async () => {
    key(window, 'keydown', 'Delete')
    let done = false
    void waitForKeyRelease('Delete', 2000).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    key(window, 'keyup', 'Delete')
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('stops listening once resolved', async () => {
    const target = holding('Delete')
    const remove = vi.spyOn(target, 'removeEventListener')
    const p = waitForKeyRelease('Delete', 2000, target)
    key(target, 'keyup', 'Delete')
    await p
    expect(remove).toHaveBeenCalledWith('keyup', expect.any(Function), true)
  })
})
