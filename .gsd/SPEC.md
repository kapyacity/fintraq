# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
FinTraQ is a client-side, zero-backend, offline-first Progressive Web Application (PWA) that empowers users to take control of their finances using the 50/30/20 budgeting rule (Needs, Wants, Savings), multi-stream income tracking, automated loan/EMI amortisation, and private P2P WebRTC data sync without central cloud storage.

## Goals
1. Provide an offline-first, mobile-optimised budgeting interface with 50/30/20 allocation rules and custom ratios.
2. Automate recurring loan and EMI schedule management, logging monthly payments directly into the Needs allocation.
3. Support multi-stream income tracking with auto-budget recalculations.
4. Enable seamless private multi-device and cross-tab data synchronization via WebRTC (PeerJS) and BroadcastChannel with Last-Write-Wins (LWW) resolution.
5. Provide data portability via JSON backup/restore and permanent device persistence via the StorageManager API.
6. Refactor the monolithic `index.html` structure into maintainable, tested modular components while maintaining zero server overhead.

## Non-Goals (Out of Scope)
- Centralized user database / cloud authentication backend (FinTraQ is strictly private, zero-backend).
- Direct bank account / SMS scraping or automated payment gateway integrations.
- Multi-currency conversions (focused on INR / Indian Rupee format).

## Users
Personal finance managers, salaried individuals, and budget-conscious individuals who want a private, lightning-fast expense tracking app that runs offline on mobile and desktop without exposing financial data to external servers.

## Constraints
- Zero external runtime server dependencies (static hosting via Netlify/GitHub Pages/Cloudflare Pages).
- Works 100% offline via Service Worker precaching.
- Storage limited by browser `localStorage` quotas (optimized data structures required).
- All P2P synchronization depends on WebRTC STUN/signaling servers with local reconciliation.

## Success Criteria
- [ ] Complete functional coverage: Expenses, Incomes, Loans/EMIs, Subcategories, and Visual Analytics working offline.
- [ ] Data integrity preserved across storage migrations (`moneymap_v1` -> `fintraq_v1`) and P2P sync.
- [ ] High Lighthouse PWA score with full offline navigation and cache-busting discipline.
- [ ] Automated verification test harness for core business logic (budgeting, EMI calculation, sync reconciliation).
