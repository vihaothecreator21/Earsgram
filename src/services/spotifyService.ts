import AsyncStorage from "@react-native-async-storage/async-storage";

import { SPOTIFY_CONFIG } from "../config/spotifyConfig";
import {
  SpotifyAlbumSummary,
  SpotifyProfile,
  SpotifyTokenResponse,
  SpotifyTrack,
} from "../types/spotify";

export class ApiResponseError extends Error {
  status: number;
  url: string;
  bodyPreview: string;

  constructor(response: Response, bodyPreview: string) {
    super(
      response.status === 403 && bodyPreview.includes("developer.spotify.com")
        ? "Spotify access denied. Add this Spotify account in the Spotify Developer Dashboard users list."
        : `Expected JSON from ${response.url || "request"} (${response.status}): ${bodyPreview}`
    );
    this.name = "ApiResponseError";
    this.status = response.status;
    this.url = response.url;
    this.bodyPreview = bodyPreview;
  }
}

export const isSpotifyDashboardAccessError = (error: unknown) =>
  error instanceof ApiResponseError &&
  error.status === 403 &&
  error.bodyPreview.includes("developer.spotify.com");

const readJsonResponse = async <T = any>(response: Response): Promise<T> => {
  const bodyText = await response.text();

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    const preview = bodyText.slice(0, 120).trim() || "Empty response";
    throw new ApiResponseError(response, preview);
  }
};

export const exchangeCodeForToken = async (
  code: string,
  codeVerifier: string
): Promise<SpotifyTokenResponse> => {
  const requestBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    client_id: SPOTIFY_CONFIG.clientId,
    code_verifier: codeVerifier,
  }).toString();

  const response = await fetch(SPOTIFY_CONFIG.discovery.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: requestBody,
  });

  const json = await readJsonResponse<
    SpotifyTokenResponse & { error?: string; error_description?: string }
  >(response);
  if (json.error) throw new Error(json.error_description || json.error);
  return json;
};

export const getUserProfile = async (token: string): Promise<SpotifyProfile> => {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await readJsonResponse<SpotifyProfile>(response);
};

export const getUserTopTracks = async (token: string) => {
  const response = await fetch(
    "https://api.spotify.com/v1/browse/new-releases?limit=10",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const json = await readJsonResponse<{
    albums?: { items?: SpotifyAlbumSummary[] };
  }>(response);

  if (json.albums?.items) {
    return {
      items: json.albums.items.map((album) => ({
        id: album.id,
        name: album.name,
        artists: album.artists.map((artist) => ({
          ...artist,
          id: artist.id ?? artist.name,
        })),
        album: { id: album.id, name: album.name, images: album.images },
        preview_url: null,
      })),
    };
  }

  return { items: [] };
};

export const searchSpotify = async (
  token: string,
  query: string,
  type = "track,artist"
) => {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodedQuery}&type=${type}&limit=10`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return await readJsonResponse(response);
};

export const getUserPlaylists = async (token: string) => {
  const response = await fetch(
    "https://api.spotify.com/v1/me/playlists?limit=20",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return await readJsonResponse(response);
};

export const getAlbumDetails = async (token: string, albumId: string) => {
  const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await readJsonResponse(response);
};

export const getAlbumTracks = async (
  token: string,
  albumId: string,
  market = "VN"
) => {
  const response = await fetch(
    `https://api.spotify.com/v1/albums/${albumId}/tracks?market=${market}&limit=50`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return await readJsonResponse(response);
};

export const checkUserSavedAlbums = async (token: string, albumId: string) => {
  const response = await fetch(
    `https://api.spotify.com/v1/me/albums/contains?ids=${albumId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await readJsonResponse<boolean[]>(response);
  return data[0];
};

export const getArtistDetails = async (token: string, artistId: string) => {
  const response = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return await readJsonResponse(response);
};

export const getArtistTopTracks = async (
  token: string,
  artistId: string,
  market = "VN"
) => {
  const response = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${market}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return await readJsonResponse(response);
};

export const getArtistAlbums = async (token: string, artistId: string) => {
  const response = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=10`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return await readJsonResponse(response);
};

export const saveToken = async (
  token: string,
  expiresIn: number,
  userId: string
) => {
  try {
    const expirationTime = Date.now() + expiresIn * 1000;
    await AsyncStorage.setItem(`spotify_token_${userId}`, token);
    await AsyncStorage.setItem(
      `spotify_expiration_${userId}`,
      expirationTime.toString()
    );
  } catch (e) {
    console.error("Error saving token", e);
  }
};

export const getSavedToken = async (userId: string) => {
  try {
    const tokenKey = `spotify_token_${userId}`;
    const expKey = `spotify_expiration_${userId}`;

    const token = await AsyncStorage.getItem(tokenKey);
    const expirationTime = await AsyncStorage.getItem(expKey);

    if (!token || !expirationTime) return null;

    if (Date.now() > parseInt(expirationTime)) {
      await AsyncStorage.multiRemove([tokenKey, expKey]);
      return null;
    }
    return token;
  } catch (e) {
    return null;
  }
};

export const clearToken = async (userId: string) => {
  await AsyncStorage.multiRemove([
    `spotify_token_${userId}`,
    `spotify_expiration_${userId}`,
  ]);
};

export const createPlaylist = async (
  token: string,
  userId: string,
  playlistName: string
) => {
  try {
    if (__DEV__) console.log(`Creating playlist: ${playlistName} for ${userId}`);

    const response = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playlistName,
          description: "Playlist created from Eargasm App (Demo)",
          public: false,
        }),
      }
    );

    const json = await readJsonResponse<{
      id: string;
      error?: { message: string };
    }>(response);
    if (json.error) throw new Error(json.error.message);
    return json;
  } catch (error) {
    if (__DEV__) console.error("Error creating playlist:", error);
    throw error;
  }
};

export const addTrackToPlaylist = async (
  token: string,
  playlistId: string,
  trackUri: string
) => {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [trackUri] }),
    }
  );
  return await readJsonResponse(response);
};

export const addItemToQueue = async (token: string, trackUri: string) => {
  await fetch(
    `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(
      trackUri
    )}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
};

export const getPlaylistTracks = async (token: string, playlistId: string) => {
  const timestamp = Date.now();
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?t=${timestamp}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return await readJsonResponse(response);
};

export const removeTrackFromPlaylist = async (
  token: string,
  playlistId: string,
  trackUri: string
) => {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tracks: [{ uri: trackUri }] }),
    }
  );
  return await readJsonResponse(response);
};

export const getPlayableUrl = async (
  spotifyTrack: Pick<SpotifyTrack, "name" | "artists" | "preview_url">
): Promise<string | null> => {
  if (spotifyTrack.preview_url) return spotifyTrack.preview_url;

  try {
    const artistName = spotifyTrack.artists?.[0]?.name || "";
    const trackName = spotifyTrack.name || "";
    const query = `${trackName} ${artistName}`;

    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        query
      )}&media=music&entity=song&limit=1`
    );
    const data = await readJsonResponse<{
      resultCount: number;
      results: { previewUrl: string }[];
    }>(response);

    if (data.resultCount > 0) return data.results[0].previewUrl;
  } catch (error) {
    if (__DEV__) console.warn("iTunes preview lookup failed:", error);
  }

  return "https://cdn.pixabay.com/audio/2022/10/18/audio_31c2730e64.mp3";
};
