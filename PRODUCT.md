# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Friends playing casual Gunblood duels in desktop browsers with a mouse.

## Product Purpose
Play the recovered Flash game against a friend online without installing software or maintaining a backend.

## Operating Context
GitHub Pages serves the separate Gunblood-Multiplayer repository. One player hosts the simulation; their friend joins with a six-digit code. The user explicitly approved free public PeerJS signaling.

## Capabilities and Constraints
Preserve the recovered SWF, Ruffle, attribution, original links and ad hooks. Host controls left, guest right. Six shots, host-authoritative damage and physics, mutual rematches, no campaign or rankings. No TURN relay; some networks cannot connect. Keep the existing single-player repository unchanged.

## Brand Commitments
Gunblood name and original game imagery. The user requests a Western theme and rejects the previous plain cream website. Keep the actual game screenshot in the lobby. Do not restore the removed introductory text, initial “Choose a side to begin” message, or public-service promotional sentence.

## Evidence on Hand
`docs/game-preview.png` is a screenshot of the actual rebuilt game. Gameplay, six-digit joining, Firefox/Chromium interoperability, and impaired transport have been tested on one physical machine/network; no separate-network claim is supported.

## Product Principles
- Let two friends start a duel with few steps.
- Keep game state authoritative in the host browser.
- Preserve original creator attribution.
- Explain connection errors with a usable recovery action.
