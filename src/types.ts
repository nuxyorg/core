import type { QueryType } from './query-context.js'

/** Home-page grouping for tools (`manifest.category`). */
export type ExtensionCategory =
  | 'system'
  | 'productivity'
  | 'media'
  | 'ai'
  | 'developer'
  | 'search'
  | 'utilities'

export const EXTENSION_CATEGORIES: readonly ExtensionCategory[] = [
  'system',
  'productivity',
  'media',
  'ai',
  'developer',
  'search',
  'utilities',
]

/** Kind of an omnibar attachment (see `QueryAttachment`). */
export type QueryAttachmentKind = 'image'

/** A file attached to the omnibar query (e.g. a pasted image), stored under ~/.cache/nuxy/attachments. */
export interface QueryAttachment {
  kind: QueryAttachmentKind
  /** Absolute path of the stored file. */
  path: string
  mime: string
  width: number
  height: number
  /** Bytes. */
  size: number
  sha1: string
}

/** Payload the shell sends to a provider's `eval` channel. */
export interface ProviderEvalPayload {
  text: string
  /** Present only for providers that declare `providerAccepts`. */
  attachments?: QueryAttachment[]
  /** True when called for the home glance row (`providerGlance`). */
  glance?: boolean
}

export type ExtensionType =
  | 'tool'
  | 'provider'
  | 'orchestrator'
  | 'helper'
  | 'theme'
  | 'iconpack'
  | 'uikit'

export type ToolWindowDimension = 'auto' | number

export interface ToolWindowSize {
  width?: ToolWindowDimension
  height?: ToolWindowDimension
}

export type ExtensionPermission =
  | 'storage'
  | 'clipboard'
  | 'network'
  | 'notifications'
  | 'island'
  | 'media'
  | 'shell'
  | 'fs'
  | 'db'
  | 'settings.read'
  | 'settings.write'

export type ExtensionSettingType =
  | 'text'
  | 'select'
  | 'color'
  | 'location'
  | 'list'
  | 'toggle'
  | 'language-list'

export interface ExtensionSettingField {
  key: string
  label: string
  type: ExtensionSettingType
  default?: unknown
  options?: Array<{ value: unknown; label: string }>
  placeholder?: string
  description?: string
}

export interface ExtensionSettingsSchema {
  version?: number
  fields: ExtensionSettingField[]
}

export interface ExtensionSettingsInfo {
  extId: string
  name: string
  schema: ExtensionSettingsSchema
}

export interface ExtensionLocaleConfig {
  /** Default BCP 47 locale code used when no preferred language matches. */
  default: string
  /** All BCP 47 locale codes this extension ships translations for. */
  supported: string[]
  /**
   * Subdirectory containing locale JSON files, relative to the extension root.
   * Defaults to "locales" when omitted.
   */
  dir?: string
}

export interface ExtensionManifest {
  id: string
  name: string
  version: string
  type: ExtensionType
  /** When true, core loads this extension's frontend as the launcher shell. */
  bootstrap?: boolean
  /** Logical icon name from the active icon pack (e.g. "clipboard", "calendar"). */
  icon?: string
  permissions?: ExtensionPermission[]
  capabilities?: {
    callable?: boolean
    caller?: boolean
  }
  /**
   * Load order priority for uikit extensions. Lower numbers load first.
   * Only relevant when type is 'uikit'. Defaults to 100.
   */
  priority?: number
  /**
   * Query types this provider or tool handles best.
   * The shell boosts this extension's results and actions when the omnibar
   * input matches one of the declared types (e.g. ["color", "url"]).
   * Has no effect on uikit, theme, or iconpack extensions.
   */
  queryAffinity?: QueryType[]
  /** Custom omnibar placeholder shown when this extension is active. */
  placeholder?: string
  /**
   * Home-page category for tools. The shell groups tools by category on the
   * empty-query home page (collapsed rows). Omitted → `utilities`.
   */
  category?: ExtensionCategory
  /** Provider presentation: `list` rows (default), `result` cards (inline answers), `compare` cards. */
  providerType?: 'list' | 'result' | 'compare'
  /** Providers sharing a group id are merged into one omnibar section. */
  providerGroup?: string
  /** Section label for `providerGroup`. */
  providerGroupLabel?: string
  /**
   * When true, the shell calls this provider's `eval` with `{ text: '', glance: true }`
   * on the empty-query home page; it may return at most one short item that is
   * shown in the home "glance" row (e.g. clock, weather, next event).
   */
  providerGlance?: boolean
  /**
   * Attachment kinds this provider handles. When the omnibar holds an attachment,
   * only providers that accept its kind are evaluated, with
   * `{ text, attachments: QueryAttachment[] }`.
   */
  providerAccepts?: QueryAttachmentKind[]
  /**
   * Localisation configuration. Declare this when the extension ships translation
   * files. Omitting it means the extension is English-only and no locale loading
   * is attempted.
   */
  locales?: ExtensionLocaleConfig
  /**
   * Tool lifecycle behavior declared in the manifest.
   * Extensions read this themselves via `completeToolAction(manifest)`.
   */
  behavior?: {
    /** What happens after the tool's primary action completes (e.g. Enter on a result). */
    onComplete?: 'stay' | 'returnToShell' | 'hide' | 'returnToShellAndHide'
    /**
     * When true, the shell asks the kernel to ignore blurAction while this tool is active
     * (e.g. native file dialogs that steal focus).
     */
    suppressBlurHide?: boolean
    /**
     * Where the shell renders the omnibar input while this tool is active.
     * Useful for chat-style tools where the input should sit below the
     * conversation rather than above it. Defaults to "top".
     */
    omniBarPosition?: 'top' | 'bottom'
    /**
     * Shell size while this tool is active. `"auto"` fits the tool's content
     * (measured by the shell, animated, and kept centered); a number is a fixed
     * pixel size. Both are capped by `windowWidth` / `windowMaxHeight`.
     * Omitted dimensions use the default layout (windowWidth × windowMaxHeight).
     */
    windowSize?: ToolWindowSize
  }
  /**
   * Composition slots this extension may provide (shell) or claim (overlays).
   * Kernel validates claims against the bootstrap shell manifest.
   */
  composition?: {
    provides?: Array<{
      name: string
      description?: string
      maxMounts?: number
    }>
    claims?: string[]
  }
  entry?: {
    backend?: string
    frontend?: string
    preload?: string
    /** Custom element tag for tool UI, e.g. "nuxy-tool-clipboard". */
    element?: string
    /** Path to a ThemeDefinition JSON file within the extension folder. */
    theme?: string
    /** Path to an IconPackDefinition JSON file within the extension folder. */
    icons?: string
    /** Path to an ExtensionSettingsSchema JSON file within the extension folder. */
    settings?: string
  }
  /**
   * Deeplink paths this extension accepts as a `nuxy://<id>/<path>` target.
   * See `DeeplinkPayload` / `ExtensionDeeplinkConfig` in `deeplink.ts`.
   * Advisory: dispatch warns (does not block) on undeclared paths.
   */
  deeplinks?: {
    schemes: string[]
  }
  /**
   * Ctrl+K command palette shortcuts this extension surfaces while its tool
   * is active, each resolving to a
   * `nuxy://` deeplink — typically a jump to another extension's settings
   * panel, e.g.:
   * ```json
   * "caller": { "commands": [{ "label": "Nyaa settings", "deeplink": "nuxy://settings/extension/com.nuxy.nyaa" }] }
   * ```
   * See `ExtensionCallerConfig` in `deeplink.ts`.
   */
  caller?: import('./deeplink.js').ExtensionCallerConfig
  /**
   * Static, auditable IPC surface declaration. `public` lists channel names
   * this extension intends to expose to other extensions (renderer cross-tool
   * invoke and worker broker calls). Channels not listed here are private —
   * callable only by the extension's own frontend/worker.
   */
  ipc?: ExtensionIpcManifest
}

export interface ExtensionIpcManifest {
  /** Channels callable cross-extension. Backend must register them with `{ expose: 'public' }`. */
  public?: string[]
  /**
   * Example JSON payloads for public channels, keyed by channel name.
   * Used by IPC Explorer to pre-fill invoke payloads and to document the
   * cross-extension contract. Optional but strongly recommended for every
   * entry in `ipc.public`.
   */
  samples?: Record<string, unknown>
}

export interface RegistryEntry {
  kind: 'tool' | 'provider' | 'orchestrator'
  name?: string
  displayName?: string
}

export interface ExtensionRuntimeMeta {
  /** @deprecated alias for privateIpcChannels + publicIpcChannels combined — kept for backward compat */
  ipcChannels: string[]
  privateIpcChannels: string[]
  publicIpcChannels: string[]
  displayName?: string
  registeredEntries?: RegistryEntry[]
}

export interface LoadedExtension {
  /** Canonical extension id from manifest.id */
  id: string
  /** Directory name under ~/.nxy/extensions/ */
  folderName: string
  manifest: ExtensionManifest
  runtime?: ExtensionRuntimeMeta
  settingsSchema?: ExtensionSettingsSchema
  /** When true, extension is installed but its worker/frontend is not active. */
  disabled?: boolean
  /** Set when the extension's worker crashed or failed to register; cleared on a clean restart. */
  status?: 'failed'
  /** Human-readable reason for the last failure, set alongside `status`. */
  lastError?: string
}

export interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface ThemeDefinition {
  version: number
  name: string
  colors: Record<string, string>
  tokens?: Record<string, string>
  /** CSS class name overrides for shell UI elements (e.g. container, itemActive). */
  styles?: Record<string, string>
}

export interface IconPackMeta {
  defaultOpacity?: number
  defaultColor?: string
}

export interface IconPackDefinition {
  version: number
  name: string
  /**
   * Extension ID used to construct nuxy-ext:// URLs for file-based packs (v3+).
   * When present, icons are individual SVG files served via the protocol handler.
   */
  extId?: string
  /**
   * v2: map of icon name → inner SVG path string (no outer <svg> wrapper).
   * v3+: array of available icon names (kebab-case); files live at nuxy-ext://{extId}/icons/{name}.svg.
   */
  icons: Record<string, string> | string[]
  /** Per-icon rendering overrides (opacity, color). */
  meta?: Record<string, IconPackMeta>
}
