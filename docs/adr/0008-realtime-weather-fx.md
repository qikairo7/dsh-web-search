# ADR-0008: Live weather and FX routing

Status: Accepted.

## Context

General web search returns stale articles for weather and currency-rate queries. Dates on those articles describe publication, not the forecast or rate itself, so recency ranking alone cannot make them reliable.

## Decision

- Add `lib/realtime.js` with free, keyless Open-Meteo (weather) and ExchangeRate-API/Frankfurter (FX) clients.
- `AutoSearchProvider.search()` checks recognized weather/FX queries before normal provider routing and returns one dated synthetic source with the live values.
- If a realtime API fails or the query cannot be parsed, the normal search pipeline continues unchanged.
- Do not add new provider ids or model-facing tools for these two data types.

## Consequences

- Weather and FX queries get current values and a real update time instead of old news articles.
- No API key or quota configuration is needed for these sources.
- The realtime response is a single source; users who need broader context can still use ordinary search for other queries.
