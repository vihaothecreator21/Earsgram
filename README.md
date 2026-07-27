# Earsgram

A React Native music app built with Expo, Spotify OAuth, Firebase, and a custom preview-audio player.


## Highlights

- Email/password authentication with Firebase Auth
- Spotify OAuth PKCE login flow
- Spotify search, playlists, albums, artists, and profile data
- Custom mini player and full-screen player with playback queue controls
- Playlist management, liked songs, listening history, and stats dashboard
- Dark/light theme support with persisted preferences
- Cloudinary avatar upload support
- Consistent loading, error, and empty states for key frontend flows

## Tech Stack

- Expo 54
- React Native 0.81
- React 19
- TypeScript
- Firebase Auth, Firestore, Storage
- Spotify Web API
- Expo AV, Auth Session, Secure Store, Haptics
- React Navigation

## Project Structure

```text
App.tsx                 App providers and auth gate
docs                    Architecture and Firebase rules notes
src/components          Shared UI and player components
src/context             Auth, user, theme, and music state
src/navigation          Stack and tab navigation
src/screens             App screens
src/services            Spotify and media services
src/config              Firebase and Spotify configuration
src/utils               Shared utilities
```

## Getting Started

```bash
npm install
npm run typecheck
npm start
```

For native builds:

```bash
npm run android
npm run ios
```

## Configuration

The app currently uses Expo's custom URL scheme. Keep this value in sync with the Spotify Developer Dashboard redirect URI:

```text
eargasm://redirect
```

The scheme remains `eargasm://redirect` for compatibility with the existing Spotify OAuth setup.

Register this redirect URI in the Spotify Developer Dashboard for the app client ID.

Firebase and Spotify client configuration live in `src/config`. Firebase web config and Spotify client IDs are public client identifiers, but production Firestore rules must restrict access per authenticated user.

Spotify access tokens are persisted locally per authenticated Firebase user and are not stored in Firestore. Firestore only stores connection metadata such as Spotify profile ID, email, and connection state.


This project demonstrates:

- Mobile app architecture with provider-based state management
- OAuth PKCE integration in an Expo app
- Firestore data modeling for user profiles, playlists, liked songs, and listening history
- Audio playback state coordination with a persistent queue
- Practical UI work across navigation, modals, gestures, haptics, and theming

## Quality Checks

```bash
npm run typecheck
```

Formatting conventions are documented in `.prettierrc`.

## Security Notes

Do not commit `.env` files or private service credentials. If this project is deployed beyond demo usage, move Spotify token exchange/refresh behind a backend service and audit Firestore rules.


