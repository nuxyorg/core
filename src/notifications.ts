/**
 * Desktop notification contract shared by the worker proxy (`core.notifications`)
 * and the main-process notifier (`src/electron/notifications/`).
 *
 * Requires the `notifications` manifest permission.
 */

export type NotificationUrgency = 'low' | 'normal' | 'critical'

export interface NotificationAction {
  /** Stable id reported back in `NotificationEvent.action`. `[A-Za-z0-9_.:-]`, not "default". */
  id: string
  /** Button label shown to the user (already localized by the extension). */
  label: string
}

export interface NotificationOptions {
  title: string
  body?: string
  urgency?: NotificationUrgency
  /** Icon file path or freedesktop icon name. */
  icon?: string
  /** Up to 3 buttons. Pressing one does NOT open the tool. */
  actions?: NotificationAction[]
  /**
   * Replace key: showing a notification with the same tag (from the same
   * extension) replaces the previous one instead of stacking.
   */
  tag?: string
  /**
   * What a click on the notification body does. Default `true`: show the Nuxy
   * window and open the calling extension's tool (via the `nuxy://<extId>`
   * deeplink path). A string opens the tool with that deeplink path/query,
   * e.g. `'reminder/42'` → `nuxy://<extId>/reminder/42`. `false` only reports
   * the click to the backend.
   */
  openTool?: boolean | string
}

export interface NotificationShowResult {
  /** Kernel-assigned id; matches `NotificationEvent.id` and `core.notifications.close(id)`. */
  id: string
}

/** Delivered to `core.notifications.onAction` listeners when the user interacts. */
export interface NotificationEvent {
  id: string
  tag?: string
  /** Body clicked (the default action). */
  clicked?: true
  /** Id of the pressed action button. */
  action?: string
}

/** Host → worker event message type carrying a `NotificationEvent`. */
export const NOTIFICATION_EVENT_TYPE = 'notification:event' as const
