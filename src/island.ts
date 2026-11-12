/**
 * Dynamic-island contract shared by the worker proxy (`core.island`) and the
 * main-process island service (`src/electron/island/`).
 *
 * The island is a small kernel-owned surface that grows out of a panel anchor
 * (the `nuxy-island` GNOME Shell extension's dot). Any extension can ask for it;
 * the kernel shows one activity at a time by priority, hides everything while
 * the anchor's monitor is fullscreen and replays deferred activities after.
 *
 * Requires the `island` manifest permission.
 */

export type IslandPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface IslandAction {
  /** Stable id reported back in `IslandEvent.action`. `[A-Za-z0-9_.:-]`. */
  id: string
  /** Button label (already localized by the extension). */
  label: string
}

export interface IslandOptions {
  /** Main line. */
  title: string
  /** Secondary line. */
  body?: string
  /** Icon name from the active icon pack, e.g. `'alarm'`. */
  icon?: string
  /**
   * Higher priority interrupts what is on screen; equal priority — the newest
   * wins; lower priority waits its turn. Default `'normal'`.
   */
  priority?: IslandPriority
  /** How long the island stays open, in ms. Default 6000, clamped to 1500–60000. */
  duration?: number
  /** Up to 2 buttons. Pressing one does NOT open the tool. */
  actions?: IslandAction[]
  /** Replace key: same tag from the same extension replaces the previous activity. */
  tag?: string
  /**
   * What a click on the island does. Default `true`: open the calling
   * extension's tool. A string opens the tool with that deeplink path/query.
   * `false` only reports the click to the backend.
   */
  openTool?: boolean | string
  /**
   * Sound played (unless GNOME Do Not Disturb is on): a GNOME alarm sound
   * (`'glass-bell'`, `'sparkling'`, … from GNOME Clocks) or a freedesktop
   * sound theme name. Played when the activity appears, e.g.
   * `'alarm-clock-elapsed'`. Played once, when it is actually shown.
   */
  sound?: string
}

export interface IslandShowResult {
  /** Kernel-assigned id; matches `IslandEvent.id` and `core.island.dismiss(id)`. */
  id: string
  /**
   * `false` when no island anchor is connected (e.g. the GNOME extension is not
   * installed). Nothing is shown then — fall back to `core.notifications`.
   */
  available: boolean
}

/**
 * Persistent, glanceable state an extension keeps on the island (one per
 * extension), e.g. the next reminder. Shown in the overview that opens when the
 * user clicks the panel dot while nothing else is on screen.
 */
export interface IslandStatus {
  title: string
  body?: string
  /** Icon name from the active icon pack. */
  icon?: string
  /** Epoch ms; the overview shows a live countdown to it. */
  endsAt?: number
  /** What clicking the row opens (like `IslandOptions.openTool`). Default `true`. */
  openTool?: boolean | string
}

/** Delivered to `core.island.onAction` listeners when the user interacts. */
export interface IslandEvent {
  id: string
  tag?: string
  /** Island body clicked. */
  clicked?: true
  /** Id of the pressed action button. */
  action?: string
}

/** Host → worker event message type carrying an `IslandEvent`. */
export const ISLAND_EVENT_TYPE = 'island:event' as const
