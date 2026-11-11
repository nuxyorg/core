/**
 * Resolves once `key` is released (or after `timeoutMs`, if the keyup is never seen).
 *
 * Used before opening a terminal from a hold action: a still-held key would keep
 * auto-repeating into the new terminal window — e.g. into sudo's password prompt.
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
