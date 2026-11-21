/** Shared provider eligibility, circuit breaker, and ordered fallback execution. */

import { FAILURE_CLASSES, classifyFailure, errorMessage, isRecoverable, webError } from './errors.js';
import { providerSettings } from './settings.js';

/** Failure classes allowed to trigger fallback under these settings. */
function allowedFailureClasses(settings) {
  return new Set(settings.fallbackFailureClasses ?? FAILURE_CLASSES);
}

/** Per-Provider consecutive-failure breaker. */
export class ProviderHealth {
  constructor() {
    this.state = new Map();
  }

  blocked(name) {
    const state = this.state.get(name);
    if (state?.blockedUntil === undefined) return false;
    if (Date.now() >= state.blockedUntil) {
      this.state.delete(name);
      return false;
    }
    return true;
  }

  failure(name, settings) {
    const state = this.state.get(name) ?? { failures: 0 };
    state.failures += 1;
    const threshold = settings.breakerFailureThreshold ?? 3;
    if (state.failures >= threshold) {
      state.blockedUntil = Date.now() + (settings.breakerCooldownMs ?? 300_000);
      state.failures = 0;
    }
    this.state.set(name, state);
  }

  success(name) {
    this.state.delete(name);
  }
}

/** Internal signal that a provider was skipped before any call was made. */
class ProviderSkipError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'ProviderSkipError';
    this.reason = reason;
  }
}

/**
 * Run ordered provider attempts with one eligibility and breaker policy.
 *
 * Search and fetch share this module; their only difference is the capability
 * name used to select a method on each provider.
 */
export class ProviderRunner {
  constructor({ settings, providers, debug }) {
    this.settings = settings;
    this.providers = providers;
    this.health = new ProviderHealth();
    this.debug = typeof debug === 'function' ? debug : undefined;
  }

  /** Emit one debug-level provider trail (tried names + answerer); a no-op without a sink. */
  recordTrail(capability, tried, answered) {
    this.debug?.('provider trail', { capability, tried, answered });
  }

  /** Names that can serve a capability, in the supplied or registry order. */
  candidates(capability, order) {
    const settings = this.settings();
    const names = order ?? Object.keys(this.providers);
    return names.filter((name) => {
      const provider = this.providers[name];
      return (
        provider !== undefined &&
        typeof provider[capability] === 'function' &&
        providerSettings(settings, name)?.enabled !== false
      );
    });
  }

  available(capability, order) {
    return this.candidates(capability, order).some((name) => this.providers[name].available());
  }

  async ready(capability, order) {
    for (const name of this.candidates(capability, order)) {
      try {
        if (await this.providers[name].ready()) return true;
      } catch {
        // Keep checking.
      }
    }
    return false;
  }

  /** Return the provider for a call, or the reason it must be skipped. */
  async inspect(name, capability) {
    const settings = this.settings();
    const provider = this.providers[name];
    if (provider === undefined || typeof provider[capability] !== 'function') {
      return { reason: `${name}: unavailable` };
    }
    if (providerSettings(settings, name)?.enabled === false) {
      return { reason: `${name}: disabled` };
    }
    if (this.health.blocked(name)) return { reason: `${name}: cooling down` };
    if (!provider.available()) return { reason: `${name}: unavailable` };
    try {
      if (!(await provider.ready())) return { reason: `${name}: credential missing` };
    } catch {
      return { reason: `${name}: readiness check failed` };
    }
    return { provider };
  }

  /**
   * Attempt one provider. Throws a ProviderSkipError before any call when the
   * provider is not eligible, and records fallback-eligible call failures in
   * the breaker before rethrowing.
   */
  async attempt(name, capability, request, signal) {
    const settings = this.settings();
    const allowed = allowedFailureClasses(settings);
    const { provider, reason } = await this.inspect(name, capability);
    if (provider === undefined) throw new ProviderSkipError(reason);
    try {
      const result = await provider[capability](request, signal);
      this.health.success(name);
      return result;
    } catch (error) {
      if (!isRecoverable(error) || !allowed.has(classifyFailure(error))) throw error;
      this.health.failure(name, settings);
      throw error;
    }
  }

  /** Try providers in order and return the first success. */
  async run({ capability, order, request, signal }) {
    const allowed = allowedFailureClasses(this.settings());
    const attempts = [];
    const tried = [];
    let eligible = 0;
    for (const name of order) {
      tried.push(name);
      try {
        const result = await this.attempt(name, capability, request, signal);
        this.recordTrail(capability, tried, [name]);
        return result;
      } catch (error) {
        if (error instanceof ProviderSkipError) {
          attempts.push(error.reason);
          continue;
        }
        if (!isRecoverable(error) || !allowed.has(classifyFailure(error))) throw error;
        eligible += 1;
        attempts.push(`${name}: ${errorMessage(error)}`);
      }
    }
    throw webError(
      `All ${capability} providers failed (${attempts.length > 0 ? attempts.join('; ') : 'no providers configured'})`,
      eligible === 0 ? 'WEB_PROVIDER_UNAVAILABLE' : 'WEB_PROVIDER_ERROR',
    );
  }
}
