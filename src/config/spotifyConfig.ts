export const REDIRECT_URI = "eargasm://redirect";

export const SPOTIFY_CONFIG = {
  clientId: "386adf56801a4072a0242c1ea184d7b6",
  discovery: {
    authorizationEndpoint: "https://accounts.spotify.com/authorize",
    tokenEndpoint: "https://accounts.spotify.com/api/token",
  },
  redirectUri: REDIRECT_URI,
  scopes: [
    "user-read-email",
    "user-library-read",
    "streaming",
    "user-read-private",
    "user-top-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-public",
    "playlist-modify-private",
  ],
};
