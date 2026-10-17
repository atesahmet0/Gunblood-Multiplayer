# Hosted analytics

Service: GoatCounter’s free hosted service. Dashboard: https://gunblood-multiplayer.goatcounter.com/ . No payment method, PostHog billing changes or maintained server is involved. The public account name is in `docs/analytics-config.mjs`.

Open the dashboard to see visitor/session counts and the Games played, Games completed and Rematches played events. Use total event hits for games (not unique visitors). Tracking begins with deployment; historical visits cannot be recovered.

## What is counted

- Visitors: GoatCounter’s cookie-free visitor/session estimate. This is an estimate, not a count of identified people.
- Page views: the fixed `/Gunblood-Multiplayer/` page path. GoatCounter may group repeat views into sessions.
- Games played: `game_started`, emitted once by the host when a round first reaches `playing` (FIRE). Guests do not emit game events.
- Games completed: `game_completed`, emitted once by the host when that started round finishes. Disconnects before a result are not completed games.
- Rematches: `rematch_started` in addition to `game_started`. Games played already includes rematches; do not add these two totals. Pause/resume never creates another game event for the same round.

## Data and reliability

The integration sends a fixed page path/title or an allowlisted event name. It sends no room codes, peer IDs, form contents, aim/fire input, health, snapshots, player names, full referrer, query strings or fragments. No replay, autocapture, persistent browser ID, cookie or persistent analytics identifier is used. The bundled library reads its optional local opt-out flag. It honors Do Not Track and Global Privacy Control. GoatCounter processes network/browser information to estimate visitors; see its [privacy policy](https://www.goatcounter.com/privacy).

Localhost, test documents and production `?test=` sessions are excluded. Analytics failures never block gameplay. Blockers, privacy preferences, host disconnects can cause undercounting or inflate unique-browser estimates. Browser-side reporting is suitable for casual usage statistics, not billing or tamper-proof competitive records.

Only the public GoatCounter account subdomain is needed. Never place a password or API key in Git or Pages.

## Tests

`node --test tests/*.test.mjs` covers round deduplication, rematches, test/local filtering, privacy preferences, blocked loader/network, and safe query handling, alongside the existing authority, firing and connection tests.

The official small counting script is pinned in `docs/runtime/goatcounter.js`; its provenance notice records the original checksum. A one-line privacy patch blanks the library’s separate query-string field in addition to the fixed page path.
