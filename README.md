# Gunblood Multiplayer

Unofficial browser-hosted duels using the recovered Gunblood Flash game and Ruffle. Original game by Andrew Wolf / Wolf Games.

## Play

[Open the multiplayer site](https://atesahmet0.github.io/Gunblood-Multiplayer/).

Open the same site on two desktop browsers. The host chooses **Host Game** and privately sends the offer code. The guest chooses **Join Game**, pastes the offer, and returns the answer code. The host pastes the answer to connect. Codes expire after ten minutes.

Host controls the left character; guest controls the right. Both see the same orientation. Move onto your chamber and hold through the countdown. Leaving the chamber resets the countdown. Aim and click after FIRE. Each player has six shots and the same eight-tick firing cooldown. Both must request a rematch to play another duel.

Keep the host tab visible. Hiding it pauses the duel; both players must leave their chambers and ready again after the host returns. Leaving ends the session. Retry always creates a fresh session; there are no persistent rooms or host migration.

## Connection limits

There is no game server, signaling service, TURN relay, login or local installation. GitHub Pages serves static files. Google public STUN discovers connection routes. Some NAT/firewall combinations need a relay and cannot connect here. Try another network when direct connectivity fails. Neither player needs to configure a router, but universal connectivity is impossible without a relay.

Share connection codes only with your intended opponent: SDP contains connection addresses and credentials for this temporary peer session. No connection codes or match history are uploaded to an application backend.

The host browser is authoritative and can cheat. It also has a latency advantage. This is casual play between trusted friends, not competitive matchmaking.

## Local setup

Serve `docs/` over localhost (Python is only a developer convenience, not required for players):

```sh
python3 -m http.server 8780 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:8780/`. HTTPS is required for public hosting. Ruffle 0.7.1 and its license texts are bundled in `docs/runtime/`.

## Rebuild the multiplayer SWF

Install Java 21+ and JPEXS FFDec 26.3 from their official distributions, then:

```sh
JAVA_BIN=/path/to/java FFDEC_JAR=/path/to/ffdec.jar python3 tools/build.py
node --test tests/*.test.mjs
```

`archive/gunblood.swf` is the unmodified Internet Archive input. `src/recovered-gameplay.as` is the readable recovered simulation. `tools/build.py` disables AI/campaign results and native mouse handling, applies equal cooldowns, then adds `src/bootstrap.as` and `src/bridge.as`. Original assets, outgoing links and ad hooks remain in the derivative SWF. The original archive and the existing single-player repository/site are untouched. This is not the original authoring project or FLA.

The bootstrap explicitly prepares the scene and sound library after the complete SWF has loaded. The guest has no simulation interval. Original timeline and clip-event scripts are guarded in guest mode; only the controlled multiplayer bridge can apply render snapshots. Script access is enabled for this bundled SWF only. No user-selected SWF loading is provided.

The host runs physics, randomness, collisions, damage and the post-tick winner decision. Guest messages are constrained inputs for the right player; claimed hits/damage are ignored. A reliable ordered channel carries fire/session/round/rematch events. An unordered channel with no retransmission carries aim and complete gzip render snapshots, with sequence checks and backpressure. Snapshots contain nested display transforms/animation frames, dynamic effects, health, ammunition and round state. Missing replaceable updates are superseded by later complete snapshots.

`docs/build.json` records the compiled SWF checksum. The browser checks and their precise coverage are documented in [VERIFICATION.md](VERIFICATION.md). Developer harnesses are `bridge-test.html`, `simulation-test.html`, `control-test.html` and `test-runner.html`.

See [NOTICE.md](NOTICE.md) for ownership, provenance and hosting terms. No open-source license grant for the original game is asserted.
