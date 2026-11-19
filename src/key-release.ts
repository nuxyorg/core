/** Keys currently held down, per tracked target. */
const heldKeys = new WeakMap<EventTarget, Set<string>>()

/**
 * Starts tracking which keys are held down on `target` (idempotent). The window is
 * tracked from module load, so a keydown is seen before any hold action fires.
 * A blur forgets everything: the keyup then lands in another window.
 */
export function trackHeldKeys(target: EventTarget): void {
  if (heldKeys.has(target)) return
  const held = new Set<string>()
  heldKeys.set(target, held)
  target.addEventListener('keydown', (e) => held.add((e as KeyboardEvent).key), true)
  target.addEventListener('keyup', (e) => held.delete((e as KeyboardEvent).key), true)
  target.addEventListener('blur', () => held.clear())
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  trackHeldKeys(window)
}

/**
 * Resolves once `key` is released (or after `timeoutMs`, if the keyup is never seen).
 * Resolves at once when `key` is not held — the action came from the Ctrl+K palette
 * or a footer chip click, so there is no release to wait for.
 *
 * Used before acting on a hold action: a still-held key would keep auto-repeating
 * into what comes next — the next row, or a new terminal's sudo password prompt.
 *
 * @param key - `KeyboardEvent.key` to wait for (e.g. `'Delete'`).
 * @param timeoutMs - Resolve anyway after this long (the keyup may have been missed).
 * @param target - Where to listen (capture phase). Defaults to `window`; renderer-only.
 */
export function waitForKeyRelease(
  key: string,
  timeoutMs: number,
  target: EventTarget = window
): Promise<void> {
  const held = heldKeys.get(target)
  if (held && !held.has(key)) return Promise.resolve()
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (): void => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      target.removeEventListener('keyup', onKeyUp, true)
      resolve()
    }
    const onKeyUp = (event: Event): void => {
      if ((event as KeyboardEvent).key === key) finish()
    }
    target.addEventListener('keyup', onKeyUp, true)
    timer = setTimeout(finish, timeoutMs)
  })
}
