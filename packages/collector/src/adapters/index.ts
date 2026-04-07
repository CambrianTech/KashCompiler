import { BaseAdapter } from "./base";
import { GrokAdapter } from "./grok";
import { TwitterAdapter } from "./twitter";
import { RedditAdapter } from "./reddit";

export { BaseAdapter } from "./base";
export type { AdapterConfig, CollectionResult } from "./base";
export { GrokAdapter } from "./grok";
export { TwitterAdapter } from "./twitter";
export { RedditAdapter } from "./reddit";

/** All built-in adapters, keyed by name */
const BUILT_IN_ADAPTERS: readonly BaseAdapter[] = [
  new GrokAdapter(),
  new TwitterAdapter(),
  new RedditAdapter(),
] as const;

/**
 * Registry of adapters, allowing lookup by name and registration of custom adapters.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, BaseAdapter>();

  constructor(adapters: readonly BaseAdapter[] = BUILT_IN_ADAPTERS) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  /** Register a new adapter or overwrite an existing one */
  register(adapter: BaseAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  /** Retrieve an adapter by name; throws if not found */
  get(name: string): BaseAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(
        `Adapter "${name}" not found. Available adapters: ${[...this.adapters.keys()].join(", ")}`
      );
    }
    return adapter;
  }

  /** List all registered adapter names */
  list(): string[] {
    return [...this.adapters.keys()];
  }
}

/** Default singleton registry containing all built-in adapters */
export const defaultRegistry = new AdapterRegistry();
