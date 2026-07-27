import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";

import {
  searchSpotify,
  getSavedToken,
  getUserPlaylists,
  addTrackToPlaylist,
  addItemToQueue,
  isSpotifyDashboardAccessError,
} from "../services/spotifyService";
import { db, auth } from "../config/firebaseConfig";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

import { useMusic } from "../context/MusicContext";
import { useTheme } from "../context/ThemeContext";
import { NowPlayingIndicator } from "../components/NowPlayingIndicator";
import EmptyState from "../components/EmptyState";
import { ErrorState } from "../components/ScreenState";
import { ShimmerEffect } from "../components/VisualEffects";

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { playTrack, currentTrack, isPlaying, addToQueue, insertNext } =
    useMusic();
  const { colors, isDark } = useTheme();

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [adding, setAdding] = useState(false);

  const [playlistsContainingTrack, setPlaylistsContainingTrack] = useState<
    Set<string>
  >(new Set());
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());

  const rowRefs = useRef(new Map());

  useEffect(() => {
    const initData = async () => {
      await loadMyPlaylists();
    };
    initData();
  }, []);

  useEffect(() => {
    if (myPlaylists.length > 0) scanAllUserTracks();
  }, [myPlaylists]);

  const loadMyPlaylists = async () => {
    if (!auth.currentUser) return;
    const token = await getSavedToken(auth.currentUser.uid);
    if (token) {
      const data = await getUserPlaylists(token);
      setMyPlaylists(data.items || []);
    }
  };

  const scanAllUserTracks = async () => {
    const allTrackIds = new Set<string>();
    await Promise.all(
      myPlaylists.map(async (playlist) => {
        try {
          const tracksRef = collection(db, "playlists", playlist.id, "tracks");
          const snapshot = await getDocs(tracksRef);
          snapshot.forEach((doc) => allTrackIds.add(doc.id));
        } catch (e) {
          // Ignore errors loading individual playlist tracks
        }
      })
    );
    setAddedTrackIds(allTrackIds);
  };

  useEffect(() => {
    if (query.trim() === "") {
      setTracks([]);
      setArtists([]);
      setErrorMessage(null);
      return;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      await executeSearch(query);
    }, 800);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const executeSearch = async (searchTerm: string) => {
    try {
      setErrorMessage(null);
      if (!auth.currentUser) return;
      const token = await getSavedToken(auth.currentUser.uid);
      if (!token) return;
      const data = await searchSpotify(token, searchTerm);
      setTracks(data.tracks?.items || []);
      setArtists(data.artists?.items || []);
    } catch (error) {
      if (isSpotifyDashboardAccessError(error)) {
        setErrorMessage(
          "This Spotify account is not registered as a test user for the app. Add it in the Spotify Developer Dashboard, then reconnect."
        );
      } else {
        if (__DEV__) console.error(error);
        setErrorMessage("Search is temporarily unavailable. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = async (trackUri: string, trackId: string) => {
    if (!auth.currentUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ref = rowRefs.current.get(trackId);
    if (ref) ref.close();

    // Find the track object
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;

    // Add to local queue
    addToQueue(track);

    // Also try to add to Spotify queue if possible
    const token = await getSavedToken(auth.currentUser.uid);
    if (token) {
      try {
        await addItemToQueue(token, trackUri);
      } catch (e) {
        if (__DEV__)
          console.log("Spotify queue add failed (normal for preview URLs)");
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Added", "Added to playback queue");
  };

  const openRowId = useRef<string | null>(null);

  const onSwipeableWillOpen = (currentId: string) => {
    if (openRowId.current && openRowId.current !== currentId) {
      const prevRow = rowRefs.current.get(openRowId.current);
      if (prevRow) {
        prevRow.close();
      }
    }
    openRowId.current = currentId;
  };

  const handleOpenPlaylistModal = async (track: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ref = rowRefs.current.get(track.id);
    if (ref) ref.close();
    setSelectedTrack(track);
    if (myPlaylists.length === 0) await loadMyPlaylists();
    setModalVisible(true);
    setPlaylistsContainingTrack(new Set());
    const checkedSet = new Set<string>();
    await Promise.all(
      myPlaylists.map(async (playlist) => {
        try {
          const docRef = doc(db, "playlists", playlist.id, "tracks", track.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) checkedSet.add(playlist.id);
        } catch (e) {}
      })
    );
    setPlaylistsContainingTrack(checkedSet);
  };

  const handleAddToPlaylist = async (
    playlistId: string,
    playlistName: string
  ) => {
    if (!selectedTrack) return;
    setAdding(true);
    try {
      if (!auth.currentUser) return;
      const token = await getSavedToken(auth.currentUser.uid);
      if (!token) return;
      const result = await addTrackToPlaylist(
        token,
        playlistId,
        selectedTrack.uri
      );
      if (result.snapshot_id) {
        try {
          const trackRef = doc(
            db,
            "playlists",
            playlistId,
            "tracks",
            selectedTrack.id
          );
          await setDoc(trackRef, {
            spotifyId: selectedTrack.id,
            name: selectedTrack.name,
            uri: selectedTrack.uri,
            artist: selectedTrack.artists[0]?.name || "Unknown",
            imageUrl: selectedTrack.album.images[0]?.url || null,
            addedAt: new Date().toISOString(),
            addedBy: auth.currentUser?.uid || "unknown",
          });
          setAddedTrackIds((prev) => new Set(prev).add(selectedTrack.id));
        } catch (err) {}
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", `Added to playlist ${playlistName}`);
      } else {
        Alert.alert("Notice", "Spotify did not respond.");
      }
      setModalVisible(false);
      setSelectedTrack(null);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Could not add to playlist.");
    } finally {
      setAdding(false);
    }
  };

  const renderRightActions = (progress: any, dragX: any, track: any) => {
    const scale = dragX.interpolate({
      inputRange: [-160, -80, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: "clamp",
    });

    const opacity = dragX.interpolate({
      inputRange: [-160, -100, 0],
      outputRange: [1, 1, 0],
      extrapolate: "clamp",
    });

    const isAdded = addedTrackIds.has(track.id);

    return (
      <View style={styles.rightActionsContainer}>
        {/* --- Nút PLAY NEXT --- */}
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#E91E63" }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

              insertNext(track);

              const ref = rowRefs.current.get(track.id);
              if (ref) ref.close();

              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              Alert.alert("Đã thêm", "Sẽ phát ngay sau bài hiện tại.");
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="return-down-forward" size={26} color="white" />
            <Text style={styles.actionText}>Play Next</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* --- Nút ADD --- */}
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: isAdded ? "#404040" : "#1DB954" }, // Xám nếu đã add, Xanh nếu chưa
            ]}
            onPress={() => !isAdded && handleOpenPlaylistModal(track)}
            disabled={isAdded}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isAdded ? "checkmark-circle" : "heart-circle-outline"}
              size={26}
              color={isAdded ? "#AAA" : "white"}
            />
            <Text style={[styles.actionText, isAdded && { color: "#AAA" }]}>
              {isAdded ? "Saved" : "Save"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const renderHeader = () => {
    if (artists.length === 0) return null;
    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Artists
        </Text>
        <FlatList
          horizontal
          data={artists}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.artistItem}
              onPress={() =>
                navigation.navigate("ArtistDetails", { artistId: item.id })
              }
            >
              <Image
                source={{
                  uri: item.images[0]?.url || "https://via.placeholder.com/100",
                }}
                style={styles.artistImg}
              />
              <Text
                style={[styles.artistName, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
        {tracks.length > 0 && (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Songs
          </Text>
        )}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Search</Text>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={24} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Songs, artists..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={20} color="gray" />
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <ActivityIndicator
            size="small"
            color="#1DB954"
            style={{ marginVertical: 10 }}
          />
        )}

        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            errorMessage && !loading ? (
              <ErrorState
                title="Search failed"
                message={errorMessage}
                actionText="Retry"
                onAction={() => executeSearch(query)}
              />
            ) : !loading && query.trim() !== "" ? (
              <EmptyState
                icon="search-outline"
                title="No results found"
                message={`We couldn't find anything for "${query}". Try different keywords.`}
              />
            ) : query.trim() === "" ? (
              <EmptyState
                icon="musical-notes-outline"
                title="Search Music"
                message="Find your favorite songs, albums, and artists"
              />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 150, flexGrow: 1 }}
          extraData={addedTrackIds}
          renderItem={({ item }) => {
            const isTrackPlaying = currentTrack?.id === item.id && isPlaying;

            return (
              <Swipeable
                ref={(ref) => {
                  if (ref && item.id) rowRefs.current.set(item.id, ref);
                }}
                renderRightActions={(p, d) => renderRightActions(p, d, item)}
                overshootRight={false}
                friction={1}
                rightThreshold={40}
                onSwipeableWillOpen={() => onSwipeableWillOpen(item.id)}
              >
                <TouchableOpacity
                  style={[
                    styles.trackItem,
                    { backgroundColor: colors.surface },
                    isTrackPlaying && {
                      backgroundColor: isDark ? "#333" : "#e0e0e0",
                    },
                  ]}
                  onPress={() => {
                    if (openRowId.current) {
                      const prevRow = rowRefs.current.get(openRowId.current);
                      prevRow?.close();
                      openRowId.current = null;
                    }

                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    playTrack(item);
                  }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: item.album.images[0]?.url }}
                    style={styles.trackImg}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.trackName,
                        { color: colors.text },
                        isTrackPlaying && { color: "#1DB954" },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.sub, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.artists[0].name}
                    </Text>
                  </View>
                  {isTrackPlaying && (
                    <NowPlayingIndicator isPlaying={isPlaying} />
                  )}
                  {!isTrackPlaying && (
                    <Ionicons
                      name="play"
                      size={20}
                      color={colors.textSecondary}
                    />
                  )}
                </TouchableOpacity>
              </Swipeable>
            );
          }}
        />

        {/* Modal Playlist */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalView, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add to Playlist
              </Text>
              {adding ? (
                <ActivityIndicator
                  size="large"
                  color="#1DB954"
                  style={{ margin: 20 }}
                />
              ) : myPlaylists.length === 0 ? (
                <Text style={{ color: colors.textSecondary, margin: 20 }}>
                  You don't have any playlists.
                </Text>
              ) : (
                <FlatList
                  data={myPlaylists}
                  keyExtractor={(item) => item.id}
                  style={{ width: "100%", maxHeight: 300 }}
                  renderItem={({ item }) => {
                    const hasSong = playlistsContainingTrack.has(item.id);
                    return (
                      <TouchableOpacity
                        style={[
                          styles.playlistOption,
                          { backgroundColor: colors.background },
                          hasSong && {
                            opacity: 0.5,
                            backgroundColor: isDark ? "#2a2a2a" : "#d0d0d0",
                          },
                        ]}
                        onPress={() =>
                          !hasSong && handleAddToPlaylist(item.id, item.name)
                        }
                        disabled={hasSong}
                      >
                        <Image
                          source={{ uri: item.images?.[0]?.url }}
                          style={styles.playlistThumb}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.playlistName,
                              { color: colors.text },
                              hasSong && { color: colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          {hasSong && (
                            <Text
                              style={{
                                color: "#1DB954",
                                fontSize: 12,
                                fontWeight: "bold",
                              }}
                            >
                              Already added
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => !adding && setModalVisible(false)}
              >
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    paddingTop: 50,
  },
  title: { color: "white", fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  searchBox: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    marginTop: 10,
  },
  artistItem: { alignItems: "center", marginRight: 20, width: 90 },
  artistImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  artistName: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#121212",
    height: 75,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },
  trackImg: { width: 55, height: 55, borderRadius: 4, marginRight: 15 },
  trackName: { color: "white", fontWeight: "bold", fontSize: 16 },
  sub: { color: "#b3b3b3", fontSize: 14, marginTop: 2 },
  rectBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  rectBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 2,
  },
  rightActionsContainer: {
    width: 160,
    flexDirection: "row",
    height: "100%",
  },
  actionBtn: {
    width: 80,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalView: {
    width: "85%",
    backgroundColor: "#282828",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 15,
  },
  playlistOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    width: "100%",
    borderBottomWidth: 0.5,
    borderBottomColor: "#444",
  },
  playlistThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 10,
    backgroundColor: "#444",
  },
  playlistName: { color: "white", fontSize: 15 },
  closeBtn: {
    marginTop: 15,
    padding: 12,
    width: "100%",
    alignItems: "center",
    backgroundColor: "#444",
    borderRadius: 8,
  },
});
