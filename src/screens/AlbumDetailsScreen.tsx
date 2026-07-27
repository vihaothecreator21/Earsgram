import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { BlurView } from "expo-blur";

// Contexts & Services
import { useMusic } from "../context/MusicContext";
import { useSpotifyAuth } from "../context/SpotifyAuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  getAlbumDetails,
  checkUserSavedAlbums,
  getAlbumTracks,
} from "../services/spotifyService";
import { NowPlayingIndicator } from "../components/NowPlayingIndicator";
import { SkeletonTrackItem } from "../components/SkeletonLoader";
import { SpotifyAlbum, SpotifyArtist, SpotifyTrack } from "../types/spotify";

const { width, height } = Dimensions.get("window");
const HEADER_HEIGHT = 350;

interface AlbumDetails extends SpotifyAlbum {
  artists: SpotifyArtist[];
  release_date?: string;
  type?: string;
}

interface AlbumTrack extends SpotifyTrack {
  duration_ms: number;
  explicit?: boolean;
}

type AlbumDetailsRoute = RouteProp<
  {
    AlbumDetails: {
      albumId: string;
      albumData?: AlbumDetails;
    };
  },
  "AlbumDetails"
>;

export default function AlbumDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<AlbumDetailsRoute>();

  const { albumId, albumData: initialData } = route.params;

  const { token } = useSpotifyAuth();
  const { playTrack, currentTrack, isPlaying } = useMusic();
  const { colors } = useTheme();

  const [album, setAlbum] = useState<AlbumDetails | null>(initialData || null);
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);

  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (token && albumId) {
      fetchAlbumData();
    }
  }, [token, albumId]);

  const fetchAlbumData = async () => {
    try {
      if (!albumId || !token) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const [albumDetails, tracksRes, savedStatus] = await Promise.all([
        getAlbumDetails(token, albumId),
        getAlbumTracks(token, albumId),
        checkUserSavedAlbums(token, albumId),
      ]);

      setAlbum(albumDetails);

      const mappedTracks: AlbumTrack[] = tracksRes.items.map((track: AlbumTrack) => ({
        id: track.id,
        name: track.name,
        duration_ms: track.duration_ms,
        explicit: track.explicit,
        artists: track.artists || [],
        album: {
          images: albumDetails.images || [],
          name: albumDetails.name,
        },
      }));

      setTracks(mappedTracks);
      setIsSaved(savedStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAlbum = () => {
    if (tracks.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playTrack(tracks[0], tracks);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return minutes + ":" + (Number(seconds) < 10 ? "0" : "") + seconds;
  };

  const formatYear = (dateString: string) => {
    return dateString ? dateString.split("-")[0] : "";
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - 100],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: "clamp",
  });

  const navBarOpacity = scrollY.interpolate({
    inputRange: [HEADER_HEIGHT - 120, HEADER_HEIGHT - 80],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // --- Render Items ---
  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
      <Animated.View
        style={[
          styles.albumCoverContainer,
          { transform: [{ scale: imageScale }] },
        ]}
      >
        <Image
          source={{ uri: album?.images?.[0]?.url }}
          style={styles.albumCover}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.2)", "#121212"]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <View style={styles.infoContainer}>
        <Text style={styles.albumTitle} numberOfLines={2}>
          {album?.name}
        </Text>

        <View style={styles.metaRow}>
          {album?.artists?.[0] && (
            <>
              <Image
                source={{
                  uri:
                    album?.artists?.[0]?.images?.[0]?.url ||
                    album?.images?.[0]?.url,
                }}
                style={styles.artistAvatar}
              />
              <Text style={styles.artistName}>{album?.artists?.[0]?.name}</Text>
            </>
          )}
        </View>

        <Text style={styles.metaText}>
          {album?.type?.toUpperCase()}
          {album?.release_date ? ` • ${formatYear(album.release_date)}` : ""}
        </Text>

        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <TouchableOpacity onPress={() => setIsSaved(!isSaved)}>
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={28}
                color={isSaved ? "#1DB954" : "#B3B3B3"}
                style={{ marginRight: 20 }}
              />
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons
                name="arrow-down-circle-outline"
                size={28}
                color="#B3B3B3"
                style={{ marginRight: 20 }}
              />
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={28} color="#B3B3B3" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePlayAlbum}
            disabled={loading}
            style={[styles.playButton, loading && { opacity: 0.7 }]}
          >
            <Ionicons
              name="play"
              size={32}
              color="black"
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const renderTrackItem = ({ item }: { item: AlbumTrack }) => {
    const isTrackPlaying = currentTrack?.id === item.id && isPlaying;
    const isCurrentTrack = currentTrack?.id === item.id;
    return (
      <TouchableOpacity
        style={styles.trackRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          playTrack(item, tracks);
        }}
      >
        <View style={styles.trackInfo}>
          <Text
            style={[styles.trackTitle, isCurrentTrack && { color: "#1DB954" }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {item.explicit && (
              <View style={styles.explicitBadge}>
                <Text style={styles.explicitText}>E</Text>
              </View>
            )}
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artists?.length
                ? item.artists.map((a) => a.name).join(", ")
                : "Unknown Artist"}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {isCurrentTrack && <NowPlayingIndicator isPlaying={isPlaying} />}
          <Text style={styles.trackDuration}>
            {formatTime(item.duration_ms)}
          </Text>
          <TouchableOpacity style={{ marginLeft: 15 }}>
            <Ionicons name="ellipsis-vertical" size={16} color="#B3B3B3" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLoadingState = () => (
    <View style={{ paddingHorizontal: 16 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonTrackItem key={i} />
      ))}
    </View>
  );

  if (!token) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <Animated.View
        style={[
          styles.stickyHeader,
          { opacity: navBarOpacity, backgroundColor: "#121212" },
        ]}
      >
        <Text style={styles.stickyHeaderTitle} numberOfLines={1}>
          {album?.name}
        </Text>
      </Animated.View>

      <TouchableOpacity
        style={[
          styles.backButton,
          { marginTop: Platform.OS === "android" ? 40 : 50 },
        ]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <BlurView intensity={30} tint="dark" style={styles.backButtonBlur}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </BlurView>
      </TouchableOpacity>

      <Animated.FlatList
        data={loading ? [] : tracks}
        keyExtractor={(item) => item.id}
        renderItem={renderTrackItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={loading ? renderLoadingState : null}
        contentContainerStyle={{ paddingBottom: 120 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // --- Header ---
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  albumCoverContainer: {
    width: width,
    height: 300,
    justifyContent: "flex-end",
  },
  albumCover: {
    width: "100%",
    height: "100%",
  },
  infoContainer: {
    width: "100%",
    paddingHorizontal: 16,
    marginTop: -40, // Đẩy lên đè vào phần gradient
    paddingBottom: 10,
  },
  albumTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "left",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  artistAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  artistName: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  metaText: {
    color: "#B3B3B3",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 16,
  },
  // --- Actions ---
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
  },
  // --- Sticky Navbar ---
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 100, // Safe area + height
    justifyContent: "flex-end",
    paddingBottom: 15,
    alignItems: "center",
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  stickyHeaderTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    opacity: 1,
  },
  backButton: {
    position: "absolute",
    left: 15,
    zIndex: 20,
  },
  backButtonBlur: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // --- Track List ---
  trackRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  trackInfo: {
    flex: 1,
    marginRight: 15,
  },
  trackTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  explicitBadge: {
    backgroundColor: "#333",
    paddingHorizontal: 4,
    borderRadius: 2,
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
    height: 14,
  },
  explicitText: {
    color: "#999",
    fontSize: 9,
    fontWeight: "bold",
  },
  trackArtist: {
    color: "#B3B3B3",
    fontSize: 14,
  },
  trackDuration: {
    color: "#B3B3B3",
    fontSize: 13,
  },
});
