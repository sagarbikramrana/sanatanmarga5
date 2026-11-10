# SanatanMarga 5.0 — Phase 4A: Public News & Publishing Core

## Overview
Phase 4A finalizes the public journalism and newsroom reading experience into a robust, reliable, and zero-leakage production product.

## Canonical Architecture
- **Canonical Article Contract (`PublicArticleDto`)**: Enforces strict separation between internal editorial metadata (AI prompts, QA audits, staff notes, moderation scores) and public delivery data.
- **Publication Visibility Gates**: Explicitly suppresses drafts, future scheduled items, retracted records, and soft-deleted articles from public rendering.
- **Canonical Routing**: One canonical URL per article (`/article/:id`) with robust fallbacks and 404 handling.
- **Search & Discovery**: Bounded searches over published records only, ensuring zero leakage of internal state.
- **SEO & Structured Data**: Clean OpenGraph, Twitter cards, and truthful JSON-LD article schema.
