# Frontend Review

## Scope

This project is presented as a frontend/mobile portfolio project. Backend and infrastructure pieces are documented for context, but the primary evaluation surface is the React Native experience.

## Frontend Strengths

- Clear app shell with authentication gating and nested providers.
- Bottom tab navigation plus stack routes for detail screens.
- Mini player and full player are available globally across the app.
- Queue actions support play next, add to queue, remove, and reorder.
- Shared theme context supports light and dark colors.
- Core screens now include consistent loading, error, and empty states.

## Recent Polish

- Spotify access tokens are no longer stored in Firestore.
- README includes frontend scope and UI preview images.
- Architecture notes document auth flow, playback flow, and Firebase collections.
- Firestore rules example is included for reviewer context.
- Shared Spotify types reduce unsafe `any` usage in core player and library flows.

## Remaining Frontend Work

- Split large screens into smaller hooks/components:
  - `PlaylistDetailScreen`
  - `StatsScreen`
  - `SearchScreen`
- Continue replacing screen-level `any` types with shared route and Spotify models.
- Replace remaining mojibake comments/logs in older files.
- Add automated UI checks once a stable Expo web/native test flow is available.

## Interview Talking Points

- Explain how `MusicContext` keeps queue state and refs in sync for async playback callbacks.
- Explain why token persistence is local-only while Firestore stores profile metadata.
- Explain how empty/error/loading states improve user trust during API and network failures.
