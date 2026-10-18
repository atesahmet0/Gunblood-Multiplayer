# Gunblood Multiplayer

Unofficial browser-hosted duels using the recovered Gunblood Flash game and Ruffle. Original game by Andrew Wolf / Wolf Games.

## Play

[Open the multiplayer site](https://atesahmet0.github.io/Gunblood-Multiplayer/).

Open the same site on two desktop browsers. The host chooses **Host Game** and shares the six-digit room code. The guest chooses **Join Game**, enters those six digits (including leading zeros), and clicks **Connect**. Both browsers connect automatically. Unused rooms expire after ten minutes; invitations close once two players connect. Retry creates a fresh room.

Host controls the left character; guest controls the right. Both see the same orientation. Move onto your chamber and hold through the countdown. Leaving the chamber resets the countdown. Aim and click after FIRE. Each player has six shots and the same eight-tick firing cooldown. Both must request a rematch to play another duel.

Keep the host tab visible. Hiding it pauses the duel; both players must leave their chambers and ready again after the host returns. Leaving ends the session. Retry always creates a fresh session; there are no persistent rooms or host migration.

## Connection limits

There is no game server, TURN relay, login or local installation. GitHub Pages serves static files. **PeerJS operators host the free public signaling service** at `0.peerjs.com`; neither player maintains a backend. Joining depends on its availability and public-service limits. Google public STUN discovers connection routes. Some NAT/firewall combinations need a relay and cannot connect here. Try another network when direct connectivity fails. Neither player needs to configure a router, but universal connectivity is impossible without a relay.

Share the room code privately: it is a short, guessable invitation, not authentication. The first compatible guest occupies the room. PeerJS exchanges temporary connection metadata; browsers then exchange validated session/SDP descriptions over a temporary direct PeerJS data connection. Once the native gameplay channels open, that bootstrap connection and public signaling registration close. No game state or match history is sent to PeerJS. No TURN fallback is configured, including for the bootstrap connection.

The host browser is authoritative and can cheat. It also has a latency advantage. This is casual play between trusted friends, not competitive matchmaking.

## Local setup

Serve `docs/` over localhost (Python is only a developer convenience, not required for players):

```sh
python3 -m http.server 8780 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:8780/`. HTTPS is required for public hosting. Ruffle 0.7.1 and PeerJS 1.5.5 are bundled in `docs/runtime/` with license texts. PeerJS comes from its official npm package; its archive integrity and client SHA-256 are recorded in `evidence/peerjs-package.json`. Even local six-digit pairing uses the public signaling service and needs Internet access.

## Rebuild the multiplayer SWF

Install Java 21+ and JPEXS FFDec 26.3 from their official distributions, then:

```sh
JAVA_BIN=/path/to/java FFDEC_JAR=/path/to/ffdec.jar python3 tools/build.py
node --test tests/*.test.mjs
```

`archive/gunblood.swf` is the unmodified Internet Archive input. `src/recovered-gameplay.as` is the readable recovered simulation. `tools/build.py` disables AI/campaign results and native mouse handling, applies equal cooldowns, then adds `src/bootstrap.as` and `src/bridge.as`. Original assets, outgoing links and ad hooks remain in the derivative SWF. The original archive and the existing single-player repository/site are untouched. This is not the original authoring project or FLA.

The bootstrap explicitly prepares the scene and sound library after the complete SWF has loaded. The guest has no simulation interval. Original timeline and clip-event scripts are guarded in guest mode; only the controlled multiplayer bridge can apply render snapshots. Script access is enabled for this bundled SWF only. No user-selected SWF loading is provided.

The host runs physics, randomness, collisions, damage and the post-tick winner decision. Guest messages are constrained inputs for the right player; claimed hits/damage are ignored. A reliable ordered channel carries fire/session/round/rematch events. An unordered channel with no retransmission carries aim and gzip render updates, with sequence checks and backpressure. New clients negotiate reference-frame encoding: the reliable channel delivers a complete reference snapshot, acknowledged before use. Every replaceable update independently describes the complete current state relative to that reference; it never depends on another unreliable packet. References refresh every five seconds and on rematches. Clients without the capability keep receiving full snapshots. Reconstructed snapshots contain nested display transforms/animation frames, dynamic effects, health, ammunition and round state.

Each receiver keeps one decode in flight and one replaceable waiting packet, then renders the newest state once per animation frame. A local bridge patch skips unchanged display branches. The sender skips replaceable updates while data is queued, avoiding a backlog of stale frames. Host snapshots and guest aim updates are sampled every 40 ms. `perf-test.html` compares moving gameplay on normal and synthetically constrained links. Guests can open **Connection details** to inspect round-trip delay, incoming update rate and synchronous update work. Measurements stay local; they are not uploaded to analytics.

`docs/build.json` records the compiled SWF checksum. The browser checks and their precise coverage are documented in [VERIFICATION.md](VERIFICATION.md). Developer harnesses are `bridge-test.html`, `simulation-test.html`, `control-test.html` and `test-runner.html`.

See [NOTICE.md](NOTICE.md) for ownership, provenance and hosting terms. No open-source license grant for the original game is asserted.

## Quick Match

Choose **Quick Match** to find another waiting player without sharing a code. Keep the tab visible; Cancel returns to the lobby, and a two-minute search limit offers retry. The current waiting-slot owner hosts and plays left. Host Game and Join Game still support private six-digit pairing.

Matchmaking uses a build-versioned waiting ID on the existing free public PeerJS service. A pair reserves each other, acknowledges the reservation and releases that ID with `disconnect()` while its existing signaling channel stays alive; later pairs can form independently. The game then uses the original native WebRTC control/state channels. No additional account, persistent queue server or TURN relay is added.

This is best-effort casual matchmaking. It provides no accounts, ranking, strict FIFO, fairness guarantees or protection against someone occupying the public slot. Directly connecting peers run the same trusted-host game model as code pairing. Some networks require a relay and cannot connect.

Use `quick-test.html` for simultaneous-client and cancellation checks, or the Quick Match option in `test-runner.html` for the full gameplay suite. Test URLs suppress analytics and use a separate PeerJS rendezvous slot, so verification clients do not enter the public Quick Match pool.
