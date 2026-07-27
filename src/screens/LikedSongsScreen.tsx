// src/screens/LikedSongsScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { db, auth } from "../config/firebaseConfig";
import {
  collection,
  getDocs,
  orderBy,
  query,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useMusic } from "../context/MusicContext";
import { useTheme } from "../context/ThemeContext";
import { NowPlayingIndicator } from "../components/NowPlayingIndicator";
import { LikedSong, SpotifyTrack } from "../types/spotify";

export default function LikedSongsScreen() {
  const navigation = useNavigation();
  const { playTrack, currentTrack, isPlaying } = useMusic();
  const { colors, isDark } = useTheme();

  const [likedSongs, setLikedSongs] = useState<LikedSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLikedSongs();
  }, []);

  const fetchLikedSongs = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      const likedRef = collection(db, "users", user.uid, "liked_songs");
      const q = query(likedRef, orderBy("likedAt", "desc"));
      const snapshot = await getDocs(q);

      const songs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LikedSong[];

      setLikedSongs(songs);
    } catch (error) {
      if (__DEV__) console.error("Error fetching liked songs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlike = async (trackId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const likedRef = doc(db, "users", user.uid, "liked_songs", trackId);
      await deleteDoc(likedRef);

      setLikedSongs(likedSongs.filter((song) => song.id !== trackId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      if (__DEV__) console.error("Error unliking song:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <LinearGradient
        colors={["#E91E63", "#9C27B0", "#121212"]}
        style={styles.headerGradient}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="heart" size={60} color="white" />
          </View>
          <Text style={styles.headerTitle}>Liked Songs</Text>
          <Text style={styles.headerSubtitle}>{likedSongs.length} songs</Text>
        </View>
      </LinearGradient>

      {likedSongs.length > 0 && (
        <TouchableOpacity
          style={styles.playAllButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const tracks: SpotifyTrack[] = likedSongs.map((song) => ({
              id: song.trackId,
              name: song.name,
              artists: song.artists,
              album: song.album,
              uri: song.uri,
              preview_url: song.uri,
            }));
            playTrack(tracks[0], tracks);
            setTimeout(() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
            }, 150);
          }}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={["#E91E63", "#9C27B0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.playAllGradient}
          >
            <Ionicons name="play" size={24} color="white" />
            <Text style={styles.playAllText}>PLAY ALL</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color="#E91E63" />
      </View>
    );
  }

  if (likedSongs.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <Ionicons
            name="heart-outline"
            size={80}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No liked songs yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Double tap on album art to like songs
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={likedSongs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item, index }) => {
          const isTrackPlaying = currentTrack?.id === item.trackId && isPlaying;

          return (
            <TouchableOpacity
              style={[
                styles.songItem,
                { backgroundColor: colors.surface },
                isTrackPlaying && styles.songItemActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const track: SpotifyTrack = {
                  id: item.trackId,
                  name: item.name,
                  artists: item.artists,
                  album: item.album,
                  uri: item.uri,
                  preview_url: item.uri,
                };
                const allTracks: SpotifyTrack[] = likedSongs.map((song) => ({
                  id: song.trackId,
                  name: song.name,
                  artists: song.artists,
                  album: song.album,
                  uri: song.uri,
                  preview_url: song.uri,
                }));
                playTrack(track, allTracks);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.indexText, { color: colors.textSecondary }]}>
                {index + 1}
              </Text>

              <Image
                source={{ uri: item.album?.images?.[0]?.url }}
                style={styles.albumImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />

              <View style={styles.songInfo}>
                <Text
                  style={[
                    styles.songName,
                    { color: colors.text },
                    isTrackPlaying && styles.songNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.artistName, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.artists?.[0]?.name || "Unknown Artist"}
                </Text>
                <Text
                  style={[styles.dateText, { color: colors.textSecondary }]}
                >
                  {formatDate(item.likedAt)}
                </Text>
              </View>

              {isTrackPlaying && <NowPlayingIndicator isPlaying={isPlaying} />}

              <TouchableOpacity
                onPress={() => handleUnlike(item.trackId)}
                style={styles.unlikeButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="heart" size={24} color="#E91E63" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  header: {
    marginBottom: 20,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  headerContent: {
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  playAllButton: {
    marginHorizontal: 20,
    marginTop: -20,
    marginBottom: 10,
  },
  playAllGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 25,
    gap: 10,
  },
  playAllText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    color: "#777",
    fontSize: 14,
    textAlign: "center",
  },
  songItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  songItemActive: {
    backgroundColor: "rgba(233, 30, 99, 0.1)",
  },
  indexText: {
    color: "#888",
    fontSize: 14,
    width: 25,
    textAlign: "center",
  },
  albumImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  songInfo: {
    flex: 1,
  },
  songName: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  songNameActive: {
    color: "#E91E63",
  },
  artistName: {
    color: "#b3b3b3",
    fontSize: 13,
    marginBottom: 2,
  },
  dateText: {
    color: "#666",
    fontSize: 11,
  },
  unlikeButton: {
    padding: 5,
  },
});
