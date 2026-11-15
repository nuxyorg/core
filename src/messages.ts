/** Messages sent from the extension worker to the host (main process). */
export type WorkerToHostMessage =
  | {
      kind: 'event'
      type: 'registry:sync'
      ipcChannels: string[]
      privateIpcChannels: string[]
      publicIpcChannels: string[]
      displayName?: string
      registeredEntries?: import('./types.js').RegistryEntry[]
    }
  | { kind: 'event'; type: 'registry:error'; error: string }
  | { kind: 'call'; type: 'host:call'; id: string; channel: string; payload?: unknown }
  | { kind: 'reply'; type?: undefined; id: string; result?: unknown; error?: string }

/** Messages sent from the host to the extension worker. */
export type HostToWorkerMessage =
  | { kind: 'reply'; type: 'host:reply'; id: string; result?: unknown; error?: string }
  | {
      kind: 'call'
      type?: undefined
      id: string
      channel: string
      payload?: unknown
      callerExtId?: string
    }
  | {
      kind: 'event'
      type: typeof import('./notifications.js').NOTIFICATION_EVENT_TYPE
      event: import('./notifications.js').NotificationEvent
    }
  | {
      kind: 'event'
      type: typeof import('./deeplink.js').DEEPLINK_BACKGROUND_EVENT_TYPE
      payload: import('./deeplink.js').DeeplinkPayload
    }
  | {
      kind: 'event'
      type: typeof import('./island.js').ISLAND_EVENT_TYPE
      event: import('./island.js').IslandEvent
    }
