# Verification

Verified locally on macOS / Apple Silicon, 2026-10-18. This is casual peer-hosted play; these checks are not an anti-cheat certification or proof of connectivity on arbitrary networks.

## UI refinement

2026-10-18: preserved the existing parchment/oxblood palette and Georgia display type while restructuring the lobby into an introduction and focused pairing panel. Host/join have Back navigation, grouped code/actions, inline validation, loading and clipboard feedback. On narrow screens, selecting a role hides the introduction. The game HUD is aligned to the 720-pixel arena, labels the local side, displays separate health/ammunition groups, retains requested-rematch feedback and removes unavailable actions after departure.

The production client was inspected at desktop size and in real iframe viewports of 320, 390, 560 and 768 CSS pixels. No horizontal overflow occurred; visible buttons were at least 48 CSS pixels tall. The 560-pixel check exercises a width equivalent to a 1120-pixel layout at 200% zoom; it is not a browser zoom test. See `evidence/ui-responsive.json` and `evidence/ui-mobile-error.png`. `ui-check.html` reproduces those viewport checks.

The Impeccable detector found only the existing cream/beige palette. This is intentional preservation of the incumbent Gunblood treatment, not a new palette selection. The normal full gameplay suite passed after restructuring. The final enhanced suite also passed with 100 ms delay in each direction and 20% replaceable-state loss: both HUDs matched authoritative health/ammunition, rematch-request labels persisted and unavailable actions were hidden after departure. Copy confirmation and Back-to-choice navigation passed manually. See `evidence/ui-integration.txt` and `evidence/ui-desktop.png`.

## Six-digit joining update

2026-10-18: six-digit rooms use the real public PeerJS service (`0.peerjs.com`) with bundled PeerJS 1.5.5. The original native gameplay channels and SWF are unchanged. Both normal and impaired production-client suites passed automatic joining and the full gameplay/rematch/draw/departure sequence. The impaired run is recorded in `evidence/six-digit-local-impaired.txt`.

Independent **in-app Chromium host ↔ Firefox 158.0 guest** passed automatic six-digit joining and a rendered duel. Both showed Left wins, left health 78, right health -4 (displayed as 0), ammunition [3,3], and identical settled head transforms (61.9,180.25) and (661.9,267.05). Screenshots: `evidence/six-digit-firefox-duel.jpg` and `evidence/six-digit-chromium-host.jpg`. Joining that closed invitation showed “No host has that code” without affecting the existing game. Invalid short codes remained editable in the production UI.

Six added source tests cover exact six-digit format and leading zeros, random code format, reservation collisions, STUN-only bootstrap configuration, incompatible/extra guests, attempt-bound handshake responses, missing rooms, expiry, signaling unavailability and cleanup after a game connects. Collision, expiry and outage tests use a fake broker and clock; they do not deliberately disrupt the public service. No new separate-network coverage was available.

The deployed six-digit Pages site also passed the full impaired suite. Its SWF checksum matched `ee80106d3001fc0c76859dbf4495ae9dca857c86b6a89c4a94ed462849ee826b`, and deployed `lobby.mjs` matched the tested local file byte for byte. See `evidence/six-digit-deployment.json`, `evidence/six-digit-live-integration.txt`, and `evidence/six-digit-live-join.jpg`.

The browser checks below document the original manual-pairing release; its Chrome/Firefox pairing coverage predates the six-digit update.

## Automated source checks

`node --test tests/*.test.mjs`: **18 tests pass**. They cover version/type/session/expiry validation, malformed codes, incompatible builds, finite constrained inputs, guest authority rejection, countdown resets, premature fire, latched fire, both inputs before post-tick results, simultaneous-death draw, wins, empty-ammunition draw, pause readiness reset, equal eight-tick cooldowns, and the six-shot cap. ActionScript bridge functions are also exercised in a JavaScript VM with mocked Flash rendering/physics. Those source tests do not establish rendered-game compatibility by themselves.

## Compiled SWF and browser checks

The bridge gate was completed before networking: two Ruffle players initialized the archived arena and transferred a full nested render snapshot. The separate guest runs no simulation interval. Timeline actions and clip events are guarded in guest mode. Later full-game checks confirmed matching damage, ammunition, head transforms, death poses and round results without guest-side duplicate damage.

The production-client integration runner uses two isolated browser documents and real WebRTC data channels. Test controls dispatch pointer events through the production input handlers; they do not inject health, ammunition, hits or damage into the game.

Passed cases:

- Manual complete-ICE offer/answer pairing and fresh session startup.
- Guest fire before readiness consumes no ammunition.
- Leaving a chamber resets the countdown; both-ready countdown reaches FIRE.
- Guest shots control the right player and damage the left player through the host.
- Host and guest health and final head transforms converge. Under latency, frames arrive later rather than at identical wall-clock instants; the settled-pose check uses a 0.1 stage-pixel tolerance.
- One-sided rematch request does not restart the game; mutual acceptance creates fresh scenes.
- Both players firing six misses produces an ammunition draw; additional fire is rejected.
- Host departure ends the guest session.
- The same gameplay/rematch/draw/departure sequence with **100 ms added delay in each direction and 20% random loss on the replaceable state channel**. Impairment was applied to channel sends in the test harness, not at the network interface. Reliable control messages were delayed but not deliberately dropped.

An independent-browser duel also passed with **Chrome 155.0.8059.80** as guest and the in-app Chromium browser as host. The guest won, with matching final health, ammunition and head transforms.

**Firefox 158.0 host ↔ Chrome 155.0.8059.80 guest** passed manual pairing, full duel, matching result/health/ammunition/poses, and a mutually accepted rematch. In that rematch, opening a new Firefox tab paused the host and guest. Returning the host kept health and ammunition intact and required both players to ready again. Screenshots are in `evidence/`.

## Limits of this coverage

- All tests used one physical machine and one physical network. No separate physical networks or mobile browsers were available for this run. Same-machine success does not establish NAT traversal across networks.
- Real ICE-gathering timeouts occurred during retries and produced the retry error. Later fresh pairings succeeded. No TURN server is configured; networks requiring a relay remain unsupported.
- Invalid/stale/incompatible codes are covered by source tests and were also rejected with the expected messages on the live Pages UI. Simultaneous-death draw is covered by source tests; a deterministic simultaneous lethal hit was not forced in a rendered duel.
- The host is trusted and has a latency advantage. The guest renders delayed authoritative snapshots; this release does not add prediction, rollback, lag compensation or host migration.
- Original game assets, links and ad hooks remain in the SWF. Availability of externally hosted developer ads is outside this repository's control.

## Reproduce

Serve `docs/` locally and open `test-runner.html` for the production-client integration suite. `control-test.html` supports manual pairing between independent browsers with pointer-event test controls. `simulation-test.html` isolates the compiled SWF; `bridge-test.html` isolates bridge startup and snapshot transfer. Keep the host document visible while gameplay checks run.

The final compiled SWF checksum is recorded in `docs/build.json`. The deployed checksum matches the tested local SWF. The live Pages pairing/gameplay/rematch/draw/departure suite also passed with 100 ms delay each way and 20% replaceable-state loss. See `evidence/deployment.json` and `evidence/live-integration.txt`.

## Centered Western cabinet redesign (2026-10-18)

Implemented the user-selected centered mockup using an authentic Ruffle arena capture, generated material artwork, semantic controls and self-hosted OFL fonts. Verified desktop captures at 1280, 1440 and 1505 CSS pixels, and a 390-pixel mobile layout. The mobile join form rejects a short code and has no horizontal overflow.

All 18 Node source tests passed. The production-client two-document suite passed with public PeerJS six-digit pairing, 100 ms delay each direction and 20% replaceable-state loss; see `evidence/western-integration.txt`. Gameplay SWF unchanged. This remains same-machine/network coverage.

Independent visual review resolved its masthead-font finding. Automated comp fidelity scoring remains failed/open: fixed regions misalign after preserving the original arena aspect ratio, and its text detector incorrectly reads the reference masthead as small dark two-line lettering. The failed scores and review remain local under `.impeccable/`; this is not recorded as an automated visual pass.

## Fullscreen and attribution (2026-10-18)

Verified native fullscreen entry and exit for both host and guest in the in-app Chromium browser with real paired Ruffle players. At 1280×720, the arena retained 720:425 proportions, HUD and exit controls remained visible, and fullscreen content fit without vertical scrolling. All 18 source tests passed. Footer adaptation credit now links the user-requested `atesahmet0` name to their GitHub profile; original creator credit remains. Unsupported fullscreen environments hide the control; rejected requests show a recovery message.

## Hosted analytics (2026-10-18)

Added separate free hosted GoatCounter account and nonblocking page/game event integration. Only the host reports games on first FIRE and completion; rematches are counted separately as a subset. All 23 source tests pass, including repeated snapshots, pause/resume, rematches, privacy controls, safe URLs and blocked analytics. Localhost and production test sessions are excluded. No PostHog organization or billing settings changed.

Live verification: reloaded the deployed root page, paired two normal production clients through six-digit PeerJS joining, readied both chambers, and completed a right-player win using real pointer clicks. GoatCounter showed one `game_started` and one `game_completed`, alongside the visitor row. These initial counts include this setup duel. Dashboard events are included in its overall total; use the named page row for visits and the Games played event row for duel totals. Final source deployment: `623855a`.

## Quick Match (2026-10-18)

Added a separate build-versioned public PeerJS waiting slot and reservation/accept/commit handshake. A committed pair releases the slot through PeerJS disconnect while retaining its signaling channel, then uses the original validated native WebRTC handshake. Searching has a two-minute deadline, cancellation and visibility cleanup; failed startup retries within that deadline. Test URLs and localhost use a separate rendezvous slot and suppress analytics.

Verification: 32 Node tests cover simultaneous arrivals, five clients/two disjoint pairs, slot cleanup, reservation cancellation, stale data, version rejection, signaling failure, timeout, adopted signaling and test-pool isolation, alongside existing authority/ammunition/analytics tests. Real public PeerJS/WebRTC checks on one Mac/in-app Chromium formed two independent pairs; the fifth player later matched with a sixth, and terminating one pair left the other intact. Cancellation released the slot. Visibility cancellation passed with a synthetic document visibility event; this is not a physical background-tab test.

The complete Quick Match gameplay suite passed countdown resets, guest input restrictions, matching HUD/poses/results, wins, mutual rematches, six-shot draw, extra-fire rejection and departure. Fullscreen entry/exit also passed. Six-digit pairing passed the full gameplay suite with 100 ms per-direction delay and 20% replaceable-state loss. One earlier impaired rematch run timed out initializing the guest Ruffle scene; a fresh full rerun passed. No SWF changes were made; this intermittent renderer-startup failure remains a known limitation.

Evidence: `evidence/quick-concurrency.txt`, `quick-cancellation.txt`, `quick-visibility.txt`, `quick-gameplay.txt`, and `quick-code-regression.txt`. Browser/network coverage remains one machine and one physical network. No cross-network traversal, strict FIFO, abuse resistance, ranking or trusted-server fairness is claimed.
