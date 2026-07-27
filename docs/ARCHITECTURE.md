# Architecture

Earsgram is an Expo React Native app with Firebase-backed identity/data and Spotify-backed music discovery.

## Runtime Flow

```text
App.tsx
  ThemeProvider
  UserProvider
  SafeAreaProvider
  Root
    LoginScreen when Firebase user is missing
    SpotifyAuthProvider + AppNavigator when Firebase user exists
```

## Core Modules

- `src/context/UserContext.tsx` owns Firebase auth state and the Firestore user profile listener.
- `src/context/SpotifyAuthContext.tsx` owns Spotify OAuth state and local access-token persistence.
- `src/context/MusicContext.tsx` owns playback state, queue state, current track, progress, and listening-history writes.
- `src/services/spotifyService.ts` centralizes Spotify Web API calls and preview URL lookup.
- `src/navigation/AppNavigator.tsx` wires stack navigation, tabs, mini player, and full player.

## Data Model

```text
users/{userId}
  email
  displayName
  avatarUrl
  spotify
    isConnected
    email
    id
    connectedAt

users/{userId}/liked_songs/{trackId}
users/{userId}/listening_history/{historyId}

playlists/{playlistId}
playlists/{playlistId}/tracks/{trackId}
```

Spotify access tokens are intentionally not stored in Firestore. They are stored locally per Firebase user and cleared when expired or disconnected.

## Playback

The player uses Expo AV for preview playback. `MusicContext` keeps both React state and refs for the queue/current index so async playback callbacks can always read the latest queue.

## Security Notes

- Firebase client config is public by design, but Firestore rules must restrict user-owned data.
- Spotify token exchange currently happens in the client for demo simplicity.
- A production version should move token exchange/refresh behind a backend service.
