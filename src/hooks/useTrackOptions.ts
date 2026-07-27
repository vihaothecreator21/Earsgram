import { useState } from "react";
import * as Haptics from "expo-haptics";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import {
  getSavedToken,
  addItemToQueue,
  addTrackToPlaylist,
} from "../services/spotifyService";
import { useMusic } from "../context/MusicContext";
import { SpotifyPlaylist, SpotifyTrack } from "../types/spotify";

export function useTrackOptions() {
  const { addToQueue, insertNext } = useMusic();

  const [visible, setVisible] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);
  const [myPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistsContainingTrack, setPlaylistsContainingTrack] = useState<
    Set<string>
  >(new Set());
  const [adding, setAdding] = useState(false);

  const openOptions = async (track: SpotifyTrack, playlists: SpotifyPlaylist[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTrack(track);
    setVisible(true);

    const checked = new Set<string>();

    await Promise.all(
      playlists.map(async (pl) => {
        const ref = doc(db, "playlists", pl.id, "tracks", track.id);
        const snap = await getDoc(ref);
        if (snap.exists()) checked.add(pl.id);
      })
    );

    setPlaylistsContainingTrack(checked);
  };

  const playNext = (track: SpotifyTrack) => {
    insertNext(track);
    setVisible(false);
  };

  const addQueue = async (track: SpotifyTrack) => {
    if (!track.uri) return;
    addToQueue(track);

    if (auth.currentUser) {
      const token = await getSavedToken(auth.currentUser.uid);
      if (token) await addItemToQueue(token, track.uri);
    }
    setVisible(false);
  };

  const addPlaylist = async (playlistId: string, track: SpotifyTrack) => {
    if (!auth.currentUser) return;
    if (!track.uri) return;
    setAdding(true);

    const token = await getSavedToken(auth.currentUser.uid);
    if (!token) return;

    await addTrackToPlaylist(token, playlistId, track.uri);

    await setDoc(doc(db, "playlists", playlistId, "tracks", track.id), {
      spotifyId: track.id,
      name: track.name,
      uri: track.uri,
      artist: track.artists[0]?.name,
      imageUrl: track.album.images[0]?.url,
      addedAt: new Date().toISOString(),
    });

    setAdding(false);
    setVisible(false);
  };

  return {
    visible,
    selectedTrack,
    myPlaylists,
    playlistsContainingTrack,
    adding,
    openOptions,
    playNext,
    addQueue,
    addPlaylist,
    close: () => setVisible(false),
  };
}
