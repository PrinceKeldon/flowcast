/**
 * Discovery Engine — plugin registry.
 *
 * A plain in-memory map from DiscoverySource -> DiscoveryPlugin.
 * Nothing else in the engine (mission.ts, the admin UI) ever imports
 * a plugin module directly — they go through this registry, so
 * adding a new source is "write a plugin file + one line here",
 * exactly the plan from the original design doc.
 */

import type { DiscoveryPlugin, DiscoverySource } from "./types";

const plugins = new Map<DiscoverySource, DiscoveryPlugin>();

/** Called once per plugin, typically from registry-init.ts (see bottom of this file's sibling). */
export function registerPlugin(plugin: DiscoveryPlugin): void {
  if (plugins.has(plugin.source)) {
    throw new Error(`Discovery plugin for source "${plugin.source}" is already registered.`);
  }
  plugins.set(plugin.source, plugin);
}

export function getPlugin(source: DiscoverySource): DiscoveryPlugin {
  const plugin = plugins.get(source);
  if (!plugin) {
    throw new Error(
      `No discovery plugin registered for source "${source}". Registered sources: ${listSources().join(", ") || "(none)"}`
    );
  }
  return plugin;
}

export function hasPlugin(source: DiscoverySource): boolean {
  return plugins.has(source);
}

/** Find whichever registered plugin claims to handle this URL, if any. */
export function findPluginForUrl(url: string): DiscoveryPlugin | undefined {
  for (const plugin of plugins.values()) {
    if (plugin.supports(url)) return plugin;
  }
  return undefined;
}

export function listSources(): DiscoverySource[] {
  return Array.from(plugins.keys());
}

/** Test-only escape hatch — production code should never need to unregister a plugin. */
export function _clearRegistryForTests(): void {
  plugins.clear();
}
