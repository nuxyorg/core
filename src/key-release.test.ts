import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitForKeyRelease } from './key-release.ts'

function keyup(target: EventTarget, key: string): void {
  const event = new Event('keyup') as Event & { key: string }
  event.key = key
  target.dispatchEvent(event)
}

describe('waitForKeyRelease', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('resolves when the key is released, ignoring other keys', async () => {
    const target = new EventTarget()
    let done = false
    void waitForKeyRelease('Delete', 2000, target).then(() => (done = true))
    keyup(target, 'a')
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    keyup(target, 'Delete')
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('resolves after the timeout if the release is never seen', async () => {
    const target = new EventTarget()
    let done = false
    void waitForKeyRelease('Delete', 2000, target).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(1999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })

  it('stops listening once resolved', async () => {
    const target = new EventTarget()
    const remove = vi.spyOn(target, 'removeEventListener')
    const p = waitForKeyRelease('Delete', 2000, target)
    keyup(target, 'Delete')
    await p
    expect(remove).toHaveBeenCalledWith('keyup', expect.any(Function), true)
  })
})
