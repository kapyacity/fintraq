# DECISIONS.md — Architecture Decision Records

> **Purpose**: Log significant technical decisions and their rationale.

---

## Decisions

### [DECISION-001] Client-Side Only Offline-First Architecture
**Date**: 2026-11-23
**Status**: Accepted

#### Context
Users require complete privacy for personal financial data without ongoing cloud hosting costs or vulnerability to central database breaches.

#### Decision
All state is stored solely in the client browser's `localStorage` (`fintraq_v1`) with zero central backend server.

#### Rationale
Guarantees absolute privacy, instant response times, and uninterrupted offline access.

#### Consequences
Data loss can occur if browser storage is cleared without backup; mitigated by persistent storage API prompt and JSON import/export.

---

### [DECISION-002] P2P WebRTC Sync with PeerJS
**Date**: 2026-11-23
**Status**: Accepted

#### Context
Users desire cross-device synchronization (e.g., between phone and laptop) without sending data to an application database.

#### Decision
Utilize direct peer-to-peer WebRTC data channels brokered by ephemeral STUN/signaling with a 6-digit session code and Last-Write-Wins (LWW) conflict resolution.

#### Rationale
Enables encrypted direct data transfer directly between user devices.

---

*Last updated: 2026-11-23*
