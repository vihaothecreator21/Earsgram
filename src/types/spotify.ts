export interface SpotifyImage {
  url: string;
  height?: number | null;
  width?: number | null;
}

export interface SpotifyArtist {
  id?: string;
  name: string;
  uri?: string;
  images?: SpotifyImage[];
}

export interface SpotifyAlbum {
  id?: string;
  name?: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri?: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  preview_url?: string | null;
}

export interface SpotifyProfile {
  id: string;
  email?: string;
  display_name?: string;
  images?: SpotifyImage[];
}

export interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export interface SpotifyAlbumSummary {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  images: SpotifyImage[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  tracks?: {
    total: number;
  };
}

export interface LikedSong {
  id: string;
  trackId: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  uri?: string;
  likedAt: string;
}
