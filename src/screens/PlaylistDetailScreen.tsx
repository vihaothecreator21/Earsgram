// src/screens/PlaylistDetailScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
  Directions,
} from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";
import * as Animatable from "react-native-animatable";
import { LinearGradient } from "expo-linear-gradient";
import { AppStyles as styles } from "../styles/AppStyles";
import {
  getSavedToken,
  getPlaylistTracks,
  removeTrackFromPlaylist,
  searchSpotify,
  addTrackToPlaylist,
} from "../services/spotifyService";
import {
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  increment,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../config/firebaseConfig";
import { useMusic } from "../context/MusicContext";
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");
// Debounce Utility
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function PlaylistDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const {
    playlist: initialPlaylist,
    playlistIndex,
    allPlaylists,
  } = route.params;

  const [currentPlaylist, setCurrentPlaylist] = useState(initialPlaylist);
  const [addToPlaylistModalVisible, setAddToPlaylistModalVisible] =
    useState(false);
  const [currentIndex, setCurrentIndex] = useState(playlistIndex);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [animationType, setAnimationType] = useState("fadeIn");

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const debouncedSearch = useDebounce(searchQuery, 500);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedTrackForOptions, setSelectedTrackForOptions] =
    useState<any>(null);

  const { playTrack, currentTrack, isPlaying } = useMusic();
  const { colors, isDark } = useTheme();
  const rowRefs = useRef(new Map());

  useEffect(() => {
    fetchTracks();
  }, [currentPlaylist]);

  useEffect(() => {
    if (debouncedSearch.length > 2) searchSpotifyTracks(debouncedSearch);
    else setSearchResults([]);
  }, [debouncedSearch]);

  const fetchTracks = async () => {
    try {
      setLoading(true);
      let combinedTracks: any[] = []; // Máº£ng chá»©a tá»•ng há»£p nháº¡c

      // --- NGUá»’N 1: Láº¤Y Tá»ª SPOTIFY (Code cÅ©) ---
      if (auth.currentUser) {
        const token = await getSavedToken(auth.currentUser.uid);
        if (token) {
          try {
            const spotifyData = await getPlaylistTracks(
              token,
              currentPlaylist.id
            );
            if (spotifyData.items) {
              combinedTracks = [...spotifyData.items];
            }
          } catch (err) {
            console.log("Playlist nĂ y khĂ´ng pháº£i cá»§a Spotify hoáº·c lá»—i token");
          }
        }
      }

      // --- NGUá»’N 2: Láº¤Y Tá»ª FIRESTORE (Code má»›i thĂªm) ---
      // Láº¥y cĂ¡c bĂ i hĂ¡t náº±m trong sub-collection "tracks" cá»§a playlist nĂ y trĂªn Firebase
      try {
        const tracksRef = collection(
          db,
          "playlists",
          currentPlaylist.id,
          "tracks"
        );
        // (Optional) Báº¡n cĂ³ thá»ƒ thĂªm orderBy('added_at') náº¿u muá»‘n sáº¯p xáº¿p
        const snapshot = await getDocs(tracksRef);

        const firestoreTracks = snapshot.docs.map((doc) => {
          // Firestore lÆ°u data dáº¡ng { track: {...}, added_at: ... }
          // Cáº¥u trĂºc nĂ y khá»›p vá»›i cáº¥u trĂºc items cá»§a Spotify nĂªn merge Ä‘Æ°á»£c luĂ´n
          return doc.data();
        });

        // Gá»™p vĂ o danh sĂ¡ch chung
        combinedTracks = [...combinedTracks, ...firestoreTracks];

        // (NĂ¢ng cao) Lá»c trĂ¹ng láº·p: Náº¿u 1 bĂ i vá»«a cĂ³ trĂªn Spotify vá»«a cĂ³ trĂªn Firebase
        // DĂ¹ng Map Ä‘á»ƒ lá»c theo ID bĂ i hĂ¡t
        const uniqueTracksMap = new Map();
        combinedTracks.forEach((item) => {
          if (item.track && item.track.id) {
            uniqueTracksMap.set(item.track.id, item);
          }
        });
        combinedTracks = Array.from(uniqueTracksMap.values());
      } catch (err) {
        console.log("Lá»—i Ä‘á»c Firebase:", err);
      }

      // Cáº­p nháº­t State
      setTracks(combinedTracks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  const handleAddTrackToTargetPlaylist = async (targetPlaylist: any) => {
    if (!selectedTrackForOptions || !auth.currentUser) return;

    try {
      // 1. đŸ‘‡ KIá»‚M TRA BĂ€I HĂT ÄĂƒ CĂ“ CHÆ¯A
      const trackRef = doc(
        db,
        "playlists",
        targetPlaylist.id,
        "tracks",
        selectedTrackForOptions.id
      );
      const trackSnap = await getDoc(trackRef);

      if (trackSnap.exists()) {
        // Náº¿u cĂ³ rá»“i thĂ¬ bĂ¡o vĂ  dá»«ng luĂ´n, khĂ´ng lĂ m gĂ¬ ná»¯a
        Alert.alert(
          "ÄĂ£ tá»“n táº¡i",
          `BĂ i hĂ¡t nĂ y Ä‘Ă£ cĂ³ trong playlist ${targetPlaylist.name}`
        );
        setAddToPlaylistModalVisible(false); // ÄĂ³ng modal chá»n
        return;
      }

      // 2. Náº¿u chÆ°a cĂ³ -> Tiáº¿n hĂ nh thĂªm vĂ o sub-collection
      await setDoc(trackRef, {
        track: selectedTrackForOptions,
        added_at: new Date().toISOString(),
        addedBy: auth.currentUser.uid,
      });

      // 3. đŸ‘‡ FIX Lá»–I "No document to update"
      // Thay vĂ¬ dĂ¹ng updateDoc (báº¯t buá»™c doc pháº£i cĂ³ trÆ°á»›c), ta dĂ¹ng setDoc vá»›i { merge: true }
      // NghÄ©a lĂ : Náº¿u Playlist chÆ°a cĂ³ trong Firestore -> Táº¡o má»›i luĂ´n. Náº¿u cĂ³ rá»“i -> Chá»‰ update trÆ°á»ng trackCount.
      const playlistRef = doc(db, "playlists", targetPlaylist.id);
      await setDoc(
        playlistRef,
        {
          // Chá»‰ cáº­p nháº­t/táº¡o cĂ¡c trÆ°á»ng nĂ y, giá»¯ nguyĂªn cĂ¡c trÆ°á»ng khĂ¡c (tĂªn, áº£nh...)
          trackCount: increment(1),
          updatedAt: new Date().toISOString(),
          // LÆ°u thĂªm máº¥y cĂ¡i nĂ y phĂ²ng há» trÆ°á»ng há»£p táº¡o má»›i playlist tá»« Spotify
          id: targetPlaylist.id,
          name: targetPlaylist.name || "Playlist",
          ownerId: auth.currentUser.uid,
        },
        { merge: true }
      );

      // 4. ThĂ´ng bĂ¡o thĂ nh cĂ´ng
      setAddToPlaylistModalVisible(false);
      showToast(`ÄĂ£ thĂªm vĂ o ${targetPlaylist.name}`, "success");
      setTimeout(
        () =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        150
      );
    } catch (error: any) {
      console.error("Lá»—i thĂªm playlist:", error);
      Alert.alert("Lá»—i", "CĂ³ lá»—i xáº£y ra, vui lĂ²ng thá»­ láº¡i sau.");
    }
  };

  const openOptionsMenu = (track: any) => {
    setSelectedTrackForOptions(track);
    setOptionsModalVisible(true);
  };

  const switchPlaylist = (direction: "next" | "prev") => {
    if (!allPlaylists) return;
    let newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < allPlaylists.length) {
      if (direction === "next") {
        setAnimationType("fadeInRight");
      } else {
        setAnimationType("fadeInLeft");
      }
      setCurrentIndex(newIndex);
      setCurrentPlaylist(allPlaylists[newIndex]);
    }
  };

  const onSwipeLeft = () => switchPlaylist("next");
  const onSwipeRight = () => switchPlaylist("prev");

  const composedGesture = Gesture.Simultaneous(
    Gesture.Fling().direction(Directions.LEFT).runOnJS(true).onEnd(onSwipeLeft),
    Gesture.Fling()
      .direction(Directions.RIGHT)
      .runOnJS(true)
      .onEnd(onSwipeRight)
  );

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToastMessage(message);
    setToastType(type);
    // Tá»± táº¯t sau 2 giĂ¢y
    setTimeout(() => setToastMessage(null), 2000);
  };

  const searchSpotifyTracks = async (query: string) => {
    if (!auth.currentUser) return;
    const token = await getSavedToken(auth.currentUser.uid);
    if (!token) return;
    const res = await searchSpotify(token, query, "track");
    setSearchResults(res.tracks?.items || []);
  };

  const handleToggleTrack = async (track: any) => {
    if (!auth.currentUser) return;
    const isAdded = tracks.some((t) => t.track.id === track.id);
    const token = await getSavedToken(auth.currentUser.uid);
    if (!token) return;

    try {
      if (isAdded) {
        await removeTrackFromPlaylist(token, currentPlaylist.id, track.uri);
        setTracks((prev) => prev.filter((t) => t.track.id !== track.id));
      } else {
        await addTrackToPlaylist(token, currentPlaylist.id, track.uri);
        setTracks((prev) => [
          ...prev,
          { track, added_at: new Date().toISOString() },
        ]);
      }
    } catch (e: any) {
      Alert.alert("Lá»—i", e.message);
    }
  };
  // Handle Liked Function
  const handleLikeTrack = async (track: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!auth.currentUser) return;

    try {
      // Táº¡o Ä‘Æ°á»ng dáº«n Ä‘áº¿n collection "liked_songs" cá»§a user
      // ID cá»§a document chĂ­nh lĂ  ID bĂ i hĂ¡t Ä‘á»ƒ trĂ¡nh trĂ¹ng láº·p
      const likedRef = doc(
        db,
        "users",
        auth.currentUser.uid,
        "liked_songs",
        track.id
      );

      // LÆ°u Ä‘áº§y Ä‘á»§ thĂ´ng tin bĂ i hĂ¡t vĂ o Firestore
      await setDoc(likedRef, {
        trackId: track.id,
        name: track.name,
        artists: track.artists,
        album: track.album,
        uri: track.uri,
        preview_url: track.preview_url || null,
        likedAt: new Date().toISOString(), // LÆ°u thá»i gian Ä‘á»ƒ sáº¯p xáº¿p bĂ i má»›i lĂªn Ä‘áº§u
      });
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 150);

      showToast("ÄĂ£ thĂªm vĂ o bĂ i hĂ¡t Æ°a thĂ­ch", "success");
    } catch (error) {
      console.error("Lá»—i khi like:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Lá»—i", "KhĂ´ng thá»ƒ lÆ°u bĂ i hĂ¡t nĂ y");
    }
  };

  const handleDelete = async (track: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!auth.currentUser) return;
    const token = await getSavedToken(auth.currentUser.uid);
    if (!token) return;

    try {
      // Animate removal
      await removeTrackFromPlaylist(token, currentPlaylist.id, track.uri);

      const trackRef = doc(
        db,
        "playlists",
        currentPlaylist.id,
        "tracks",
        track.id
      );
      await deleteDoc(trackRef);

      // Update state with smooth transition
      const newTracks = tracks.filter((t) => t.track.id !== track.id);
      setTracks(newTracks);

      const playlistRef = doc(db, "playlists", currentPlaylist.id);
      updateDoc(playlistRef, { trackCount: newTracks.length });

      // Success haptic
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 150);
      showToast("ÄĂ£ xĂ³a khá»i playlist", "success");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Lá»—i", "KhĂ´ng thá»ƒ xĂ³a bĂ i hĂ¡t");
    }
  };

  const renderLeftActions = (progress: any, dragX: any, track: any) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1.2],
      extrapolate: "clamp",
    });

    const opacity = dragX.interpolate({
      inputRange: [0, 40, 80],
      outputRange: [0, 0.5, 1],
      extrapolate: "clamp",
    });

    return (
      <View style={{ width: 80, height: "100%", justifyContent: "center" }}>
        <Animated.View
          style={{
            flex: 1,
            marginLeft: 15,
            marginRight: 0,
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
            overflow: "hidden",
            opacity,
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              const ref = rowRefs.current.get(track.id);
              ref?.close();
              handleLikeTrack(track);
            }}
          >
            {/* đŸ‘‡ GRADIENT CYAN - BLUE */}
            <LinearGradient
              colors={["#00E5FF", "#2979FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Animated.View style={{ transform: [{ scale }] }}>
                <Ionicons name="heart" size={28} color="white" />
              </Animated.View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const renderRightActions = (progress: any, dragX: any, track: any) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1.2, 0.5],
      extrapolate: "clamp",
    });

    const opacity = dragX.interpolate({
      inputRange: [-80, -40, 0],
      outputRange: [1, 0.5, 0],
      extrapolate: "clamp",
    });

    return (
      <View style={{ width: 80, height: "100%", justifyContent: "center" }}>
        <Animated.View
          style={{
            flex: 1,
            marginRight: 15, // CÄƒn lá» pháº£i cho Ä‘áº¹p
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            overflow: "hidden",
            opacity,
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              const ref = rowRefs.current.get(track.id);
              ref?.close();
              handleDelete(track);
            }}
          >
            {/* đŸ‘‡ GRADIENT RED - ORANGE */}
            <LinearGradient
              colors={["#FF1744", "#FF9100"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Animated.View style={{ transform: [{ scale }] }}>
                <Ionicons name="trash-outline" size={28} color="white" />
              </Animated.View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const shuffleArray = (array: any[]) => {
    let currentIndex = array.length,
      randomIndex;

    // Clone máº£ng Ä‘á»ƒ khĂ´ng áº£nh hÆ°á»Ÿng dá»¯ liá»‡u gá»‘c
    const newArray = [...array];

    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [newArray[currentIndex], newArray[randomIndex]] = [
        newArray[randomIndex],
        newArray[currentIndex],
      ];
    }

    return newArray;
  };

  const handleShufflePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (tracks.length === 0) return;
    const pureTracks = tracks.map((t) => t.track);
    const shuffledTracks = shuffleArray(pureTracks);

    playTrack(shuffledTracks[0], shuffledTracks);
  };

  const renderHeader = React.useCallback(
    () => (
      <View style={styles.headerContainer}>
        <Animatable.View
          animation="zoomIn"
          duration={1000}
          useNativeDriver
          style={[
            styles.coverShadow,
            {
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.2)",
              borderRadius: 12,
            },
          ]}
        >
          <Image
            source={{
              uri:
                currentPlaylist.images?.[0]?.url ||
                "https://via.placeholder.com/300",
            }}
            style={styles.coverImage}
          />
        </Animatable.View>

        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={100}
          useNativeDriver
          style={{ alignItems: "center" }}
        >
          <Text style={styles.headerTitle} numberOfLines={2}>
            {currentPlaylist.name}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentPlaylist.owner?.display_name || "Earsgram"} â€¢ {tracks.length}{" "}
            tracks
          </Text>
        </Animatable.View>

        <Animatable.View
          animation="fadeInUp"
          duration={600}
          delay={200}
          style={styles.buttonRow}
          useNativeDriver
        >
          <TouchableOpacity
            style={{ flex: 1, marginRight: 15 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (tracks.length > 0)
                playTrack(
                  tracks[0].track,
                  tracks.map((t) => t.track)
                );
            }}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={["#E91E63", "#9C27B0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Ionicons name="play" size={24} color="white" />
              <Text style={styles.gradientButtonText}>PHĂT NGAY</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.circleButton}
            activeOpacity={0.7}
            onPress={handleShufflePlay} // <--- Gáº¯n hĂ m vĂ o Ä‘Ă¢y
          >
            <Ionicons name="shuffle" size={24} color="#E91E63" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.circleButton}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("LikedSongs");
            }}
          >
            <Ionicons name="heart-outline" size={24} color="#E91E63" />
          </TouchableOpacity>
        </Animatable.View>
      </View>
    ),
    [currentPlaylist, tracks.length]
  );

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Image
        source={{
          uri:
            currentPlaylist.images?.[0]?.url ||
            "https://via.placeholder.com/300",
        }}
        style={StyleSheet.absoluteFillObject}
        blurRadius={40}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: isDark
              ? "rgba(0,0,0,0.6)"
              : "rgba(255,255,255,0.6)",
          },
        ]}
      />

      <GestureDetector gesture={composedGesture}>
        <Animatable.View
          style={{ flex: 1 }}
          key={currentPlaylist.id}
          animation={animationType}
          duration={400}
          useNativeDriver
        >
          <View style={{ flex: 1 }}>
            <View style={styles.navBar}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backBtn}
              >
                <Ionicons name="chevron-back" size={30} color={colors.text} />
                <Text style={[styles.backText, { color: colors.text }]}>
                  ThÆ° viá»‡n
                </Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Ionicons
                  name="ellipsis-horizontal-circle"
                  size={30}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator
                size="large"
                color="#E91E63"
                style={{ marginTop: 100 }}
              />
            ) : (
              <FlatList
                data={tracks}
                keyExtractor={(item, i) =>
                  `${item.track?.id || i}-${currentPlaylist.id}`
                }
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                ListHeaderComponent={renderHeader}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={8}
                updateCellsBatchingPeriod={50}
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setAddModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={24} color="#E91E63" />
                    <Text style={[styles.addText, { color: colors.text }]}>
                      ThĂªm nháº¡c
                    </Text>
                  </TouchableOpacity>
                }
                renderItem={({ item, index }) => {
                  const track = item.track;
                  if (!track) return null;
                  const active = currentTrack?.id === track.id && isPlaying;
                  return (
                    <Swipeable
                      ref={(ref) => {
                        if (ref) rowRefs.current.set(track.id, ref);
                      }}
                      renderRightActions={(p, d) =>
                        renderRightActions(p, d, track)
                      }
                      renderLeftActions={(p, d) =>
                        renderLeftActions(p, d, track)
                      }
                      overshootRight={false}
                      overshootLeft={false}
                    >
                      <Animatable.View
                        animation="fadeInRight"
                        duration={300}
                        delay={index * 30}
                        useNativeDriver
                      >
                        <TouchableOpacity
                          style={[
                            styles.rowCard,
                            { backgroundColor: colors.surface },
                            active && {
                              borderColor: "#E91E63",
                              borderWidth: 1,
                              backgroundColor: "rgba(233, 30, 99, 0.1)",
                            },
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light
                            );
                            playTrack(
                              track,
                              tracks.map((t) => t.track)
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={{
                              color: colors.textSecondary,
                              marginRight: 10,
                              width: 20,
                              textAlign: "center",
                            }}
                          >
                            {index + 1}
                          </Text>
                          <Image
                            source={{ uri: track.album.images[0]?.url }}
                            style={styles.thumb}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.tName,
                                { color: colors.text },
                                active && { color: "#E91E63" },
                              ]}
                              numberOfLines={1}
                            >
                              {track.name}
                            </Text>
                            <Text
                              style={[
                                styles.tArtist,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {track.artists[0].name}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={{ padding: 10 }} // TÄƒng padding cho dá»… báº¥m
                            activeOpacity={0.7}
                            onPress={() => openOptionsMenu(track)} // <--- Gáº®N HĂ€M Má» MENU
                          >
                            <Ionicons
                              name="ellipsis-vertical"
                              size={20}
                              color={colors.textSecondary}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      </Animatable.View>
                    </Swipeable>
                  );
                }}
              />
            )}
            <Modal
              visible={addModalVisible}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setAddModalVisible(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>ThĂªm bĂ i hĂ¡t</Text>
                  <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                    <Text style={{ color: "#E91E63" }}>ÄĂ³ng</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="TĂ¬m kiáº¿m..."
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isAdded = tracks.some((t) => t.track.id === item.id);
                    return (
                      <View style={styles.searchRow}>
                        <Image
                          source={{ uri: item.album.images?.[0]?.url }}
                          style={styles.thumb}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tName}>{item.name}</Text>
                          <Text style={styles.tArtist}>
                            {item.artists[0].name}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleToggleTrack(item)}
                        >
                          <Ionicons
                            name={
                              isAdded
                                ? "checkmark-circle"
                                : "add-circle-outline"
                            }
                            size={28}
                            color={isAdded ? "#1DB954" : "#E91E63"}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              </View>
            </Modal>
            <Modal
              visible={optionsModalVisible}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setOptionsModalVisible(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setOptionsModalVisible(false)} // Báº¥m ra ngoĂ i Ä‘á»ƒ Ä‘Ă³ng
              >
                <View
                  style={[
                    styles.modalView,
                    {
                      width: "100%",
                      borderBottomLeftRadius: 0,
                      borderBottomRightRadius: 0,
                      paddingBottom: 40,
                      marginTop: "auto",
                    },
                  ]}
                >
                  {/* Header cá»§a Modal (ThĂ´ng tin bĂ i hĂ¡t) */}
                  {selectedTrackForOptions && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 20,
                        borderBottomWidth: 0.5,
                        borderBottomColor: "#444",
                        paddingBottom: 15,
                        width: "100%",
                      }}
                    >
                      <Image
                        source={{
                          uri: selectedTrackForOptions.album.images[0]?.url,
                        }}
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 8,
                          marginRight: 15,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: "white",
                            fontWeight: "bold",
                            fontSize: 16,
                          }}
                        >
                          {selectedTrackForOptions.name}
                        </Text>
                        <Text style={{ color: "#ccc", fontSize: 14 }}>
                          {selectedTrackForOptions.artists[0].name}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* NĂºt 1: ThĂªm vĂ o Playlist (Má»Ÿ logic add giá»‘ng áº£nh Apple Music) */}
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      setOptionsModalVisible(false); // ÄĂ³ng menu 3 cháº¥m
                      setTimeout(() => {
                        setAddToPlaylistModalVisible(true); // Má»Ÿ menu chá»n playlist
                      }, 300); // Delay xĂ­u cho mÆ°á»£t
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color="white"
                      style={{ marginRight: 15 }}
                    />
                    <Text style={styles.name}>ThĂªm vĂ o Playlist</Text>
                  </TouchableOpacity>

                  {/* NĂºt 3: Like nhanh */}
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      handleLikeTrack(selectedTrackForOptions);
                      setOptionsModalVisible(false);
                    }}
                  >
                    <Ionicons
                      name="heart-outline"
                      size={24}
                      color="white"
                      style={{ marginRight: 15 }}
                    />
                    <Text style={styles.name}>YĂªu thĂ­ch</Text>
                  </TouchableOpacity>

                  {/* NĂºt 4: XĂ³a (Chá»‰ hiá»‡n náº¿u Ä‘ang trong playlist cá»§a mĂ¬nh) */}
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      setOptionsModalVisible(false);
                      Alert.alert(
                        "XĂ³a bĂ i hĂ¡t",
                        "Báº¡n cĂ³ cháº¯c muá»‘n xĂ³a bĂ i nĂ y khá»i playlist?",
                        [
                          { text: "Há»§y", style: "cancel" },
                          {
                            text: "XĂ³a",
                            style: "destructive",
                            onPress: () =>
                              handleDelete(selectedTrackForOptions),
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={24}
                      color="#FF1744"
                      style={{ marginRight: 15 }}
                    />
                    <Text style={[styles.name, { color: "#FF1744" }]}>
                      XĂ³a khá»i Playlist
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
            <Modal
              visible={addToPlaylistModalVisible}
              animationType="slide"
              presentationStyle="pageSheet" // Kiá»ƒu trÆ°á»£t giá»‘ng iOS
              onRequestClose={() => setAddToPlaylistModalVisible(false)}
            >
              <View style={[styles.modalContainer, { paddingTop: 20 }]}>
                {/* Header Modal */}
                <View style={[styles.modalHeader, { borderBottomWidth: 0 }]}>
                  <Text style={styles.modalTitle}>Chá»n Playlist</Text>
                  <TouchableOpacity
                    onPress={() => setAddToPlaylistModalVisible(false)}
                  >
                    <Text
                      style={{
                        color: "#E91E63",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Há»§y
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Danh sĂ¡ch Playlist */}
                <FlatList
                  data={allPlaylists} // Láº¥y tá»« route.params
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                  ListEmptyComponent={
                    <Text
                      style={{
                        color: "#888",
                        textAlign: "center",
                        marginTop: 50,
                      }}
                    >
                      Báº¡n chÆ°a cĂ³ playlist nĂ o khĂ¡c.
                    </Text>
                  }
                  renderItem={({ item }) => {
                    // Logic hiá»ƒn thá»‹ sá»‘ bĂ i hĂ¡t an toĂ n hÆ¡n
                    // Æ¯u tiĂªn trackCount (Firestore), náº¿u khĂ´ng cĂ³ thĂ¬ check tracks.total (Spotify), cuá»‘i cĂ¹ng lĂ  0
                    const count = item.trackCount ?? item.tracks?.total ?? 0;

                    return (
                      <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => handleAddTrackToTargetPlaylist(item)}
                      >
                        <Image
                          source={{
                            uri:
                              item.images?.[0]?.url ||
                              "https://via.placeholder.com/150",
                          }}
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 4,
                            marginRight: 15,
                          }}
                        />

                        <View style={{ flex: 1, justifyContent: "center" }}>
                          <Text style={[styles.name, { fontSize: 16 }]}>
                            {item.name}
                          </Text>
                          <Text style={styles.count}>{count} bĂ i hĂ¡t</Text>
                        </View>

                        <Ionicons name="add" size={24} color="#666" />
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </Modal>
          </View>
        </Animatable.View>
      </GestureDetector>
      {toastMessage && (
        <Animatable.View
          animation="fadeInUp"
          duration={300}
          style={{
            position: "absolute",
            bottom: 100, // Cao hÆ¡n player bar má»™t chĂºt
            alignSelf: "center",
            backgroundColor: toastType === "success" ? "#1DB954" : "#E91E63",
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 25,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
            zIndex: 999,
          }}
        >
          <Ionicons
            name={toastType === "success" ? "checkmark-circle" : "alert-circle"}
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={{ color: "white", fontWeight: "bold" }}>
            {toastMessage}
          </Text>
        </Animatable.View>
      )}
    </GestureHandlerRootView>
  );
}

