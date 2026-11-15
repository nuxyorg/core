/**
 * Deeplink IPC contract.
 *
 * URL shape: `nuxy://<extension-id>/<path>?<query>`
 *   - `nuxy://settings/extension/nyaa` → extensionId="settings", path="extension/nyaa"
 *   - `nuxy://download-manager/add?url=https://example.com/file.iso`
 *       → extensionId="download-manager", path="add", query={ url: "..." }
 *
 * Main process parses the URL (`src/electron/deeplink/parse.ts`) and dispatches
 * a `deeplink:open` IPC event to the renderer (`src/electron/deeplink/dispatch.ts`)
 * carrying this payload. The renderer shell (`extensions/shell`) listens for it,
 * activates/mounts the target tool if needed, then forwards `path`/`query` to it.
 */
/**
 * Where a deeplink came from.
 *  - `external`: outside Nuxy — OS argv / `second-instance`, macOS `open-url`,
 *    the control socket's `open:` command (a browser, `xdg-open`, a script).
 *    Treat its contents as untrusted input.
 *  - `internal`: Nuxy itself — the renderer's `deeplink:dispatch` (Ctrl+K
 *    commands, extension handoffs), notification and island clicks.
 */
export type DeeplinkSource = 'external' | 'internal'

export interface DeeplinkPayload {
  /** Resolved extension id (manifest.id), already validated against the live registry. */
  extensionId: string
  /** Path segment(s) after the extension id, without leading slash, e.g. "extension/nyaa". */
  path: string
  /** Parsed query-string parameters, e.g. { url: "https://..." }. */
  query: Record<string, string>
  /** Origin of the deeplink; tools must ask before side effects for `external`. */
  source: DeeplinkSource
}

/** Result of attempting to parse a raw `nuxy://...` URL string, before registry resolution. */
export interface ParsedDeeplink {
  /** Extension id as written in the URL host segment (not yet validated against the registry). */
  extensionId: string
  path: string
  query: Record<string, string>
}

/**
 * Manifest field declaring which deeplink paths an extension accepts as a target,
 * e.g.:
 * ```json
 * "deeplinks": { "schemes": ["add", "extension/:extId"] }
 * ```
 * Path segments prefixed with `:` are named parameters and match any single
 * non-empty path segment. The list is enforced: dispatch rejects any deeplink
 * whose non-empty path matches no declared scheme (error `scheme-not-allowed`).
 * A deeplink with an empty path (`nuxy://<id>`) only opens the tool and is
 * always allowed; its query is dropped.
 */
export interface ExtensionDeeplinkConfig {
  schemes: string[]
  /**
   * Schemes delivered in the **background**: the window is not shown and the
   * renderer is not involved; the payload goes to the extension's worker via
   * `core.deeplinks.onBackground`. Every entry must also be in `schemes`.
   * Use for machine-to-machine traffic (e.g. a browser extension pushing data);
   * a background handler must never start a side effect on its own.
   */
  background?: string[]
}

/**
 * One Ctrl+K command palette entry an extension declares to jump straight to
 * another extension's deeplink target, e.g. a "Nyaa settings" entry that
 * resolves to `nuxy://settings/extension/com.nuxy.nyaa`. Surfaced in the
 * Ctrl+K palette only while this extension's tool is active via
 * `manifest.caller.commands`.
 */
export interface ExtensionCallerCommand {
  /** Palette row label, e.g. "Nyaa settings". */
  label: string
  /** Target `nuxy://...` URL, dispatched through the same path as any other deeplink. */
  deeplink: string
  /** Optional Ctrl+K section id; a divider is shown when the section changes. */
  section?: string
  /** Optional logical icon name from the active icon pack. */
  icon?: string
}

/**
 * Manifest field declaring Ctrl+K palette shortcuts this extension wants to
 * surface, each resolving to a `nuxy://` deeplink (typically targeting
 * another extension, e.g. Settings). See `ExtensionCallerCommand`.
 */
export interface ExtensionCallerConfig {
  commands: ExtensionCallerCommand[]
}

/** IPC channel name the main process uses to push a resolved deeplink to the renderer. */
export const DEEPLINK_OPEN_CHANNEL = 'deeplink:open' as const

/** IPC channel the renderer invokes to self-trigger `handleDeeplinkUrl` (see ipc/deeplink-channels.ts). */
export const DEEPLINK_DISPATCH_CHANNEL = 'deeplink:dispatch' as const
