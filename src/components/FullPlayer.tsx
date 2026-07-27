import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  StatusBar,
  Easing,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMusic } from "../context/MusicContext";
import { QueueModal } from "./QueueModal";
import Slider from "@react-native-community/slider";
import { AudioVisualizer, CircularVisualizer } from "./AudioVisualizer";
import { SleepTimer } from "./SleepTimer";
import { db, auth } from "../config/firebaseConfig";
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const DISMISS_THRESHOLD = 150;

export default function FullPlayer() {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    collapsePlayer,
    playNext,
    playPrevious,
    position,
    duration,
    seekTo,
    queue,
    removeFromQueue,
  } = useMusic();

  const [queueVisible, setQueueVisible] = useState(false);

  const [sleepTimerVisible, setSleepTimerVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const playButtonScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<number>(0);

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        const isVerticalSwipe = Math.abs(gesture.dy) > Math.abs(gesture.dx);
        const isSignificantMove = Math.abs(gesture.dy) > 10;
        return isVerticalSwipe && isSignificantMove;
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        } else {
          translateY.setValue(gesture.dy / 3);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_THRESHOLD || gesture.vy > 0.6) {
          closeAnim();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 9,
            tension: 80,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const closeAnim = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: true,
    }).start(() => {
      collapsePlayer();
    });
  };

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      friction: 10,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(playButtonScale, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(playButtonScale, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isPlaying]);

  // Check liked status logic (giữ nguyên)
  useEffect(() => {
    const checkLikedStatus = async () => {
      if (!currentTrack || !auth.currentUser) {
        setIsLiked(false);
        return;
      }
      try {
        const likedRef = doc(
          db,
          "users",
          auth.currentUser.uid,
          "liked_songs",
          currentTrack.id
        );
        const likedDoc = await getDoc(likedRef);
        setIsLiked(likedDoc.exists());
      } catch (error) {
        setIsLiked(false);
      }
    };
    checkLikedStatus();
  }, [currentTrack]);

  // Handle Double Tap logic (giữ nguyên)
  const handleDoubleTap = async () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      lastTap.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const user = auth.currentUser;
        if (!user || !currentTrack) return;
        const likedRef = doc(
          db,
          "users",
          user.uid,
          "liked_songs",
          currentTrack.id
        );

        if (isLiked) {
          await deleteDoc(likedRef);
          setIsLiked(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          await setDoc(likedRef, {
            trackId: currentTrack.id,
            name: currentTrack.name,
            artists: currentTrack.artists,
            album: currentTrack.album,
            uri: currentTrack.uri,
            likedAt: new Date().toISOString(),
          });
          setIsLiked(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          setShowHeartAnim(true);
          Animated.parallel([
            Animated.sequence([
              Animated.timing(heartScale, {
                toValue: 1.2,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.spring(heartScale, {
                toValue: 1,
                friction: 3,
                tension: 100,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(heartOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.delay(500),
              Animated.timing(heartOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
            ]),
          ]).start(() => {
            setShowHeartAnim(false);
            heartScale.setValue(0);
            heartOpacity.setValue(0);
          });
        }
      } catch (error) {
        // error handling
      }
    } else {
      lastTap.current = now;
    }
  };

  if (!currentTrack) return null;

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.container, { transform: [{ translateY }] }]}
      >
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={closeAnim}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-down" size={28} color="white" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { marginLeft: 35 }]}>
              NOW PLAYING
            </Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => setSleepTimerVisible(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ marginRight: 16 }}
              >
                <Ionicons name="moon-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setQueueVisible(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="list" size={28} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Artwork */}
          <View style={styles.artworkContainer}>
            <CircularVisualizer isPlaying={isPlaying} size={280} />
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleDoubleTap}
              style={{ position: "relative" }}
            >
              <Image
                source={{
                  uri:
                    currentTrack.album?.images[0]?.url ||
                    "https://via.placeholder.com/300",
                }}
                style={styles.cover}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={300}
              />
              {showHeartAnim && (
                <Animated.View
                  style={[
                    styles.heartOverlay,
                    {
                      transform: [{ scale: heartScale }],
                      opacity: heartOpacity,
                    },
                  ]}
                >
                  <Ionicons name="heart" size={120} color="#E91E63" />
                </Animated.View>
              )}
              {isLiked && (
                <View style={styles.likedIndicator}>
                  <Ionicons name="heart" size={24} color="#E91E63" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Audio Visualizer */}
          <View style={styles.visualizerContainer}>
            <AudioVisualizer
              isPlaying={isPlaying}
              barCount={35}
              barWidth={3}
              barGap={3}
            />
          </View>

          {/* Info */}
          <View style={styles.trackInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.name}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artists.map((a: any) => a.name).join(", ")}
            </Text>
          </View>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              minimumTrackTintColor="#1DB954"
              maximumTrackTintColor="#555"
              thumbTintColor="#1DB954"
              onSlidingComplete={seekTo}
              onSlidingStart={() => {}}
            />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                playPrevious();
              }}
              activeOpacity={0.6}
            >
              <Ionicons name="play-skip-back" size={35} color="white" />
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: playButtonScale }] }}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  playTrack(currentTrack); // Toggle Play/Pause
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isPlaying ? "pause-circle" : "play-circle"}
                  size={80}
                  color="white"
                />
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                playNext();
              }}
              activeOpacity={0.6}
            >
              <Ionicons name="play-skip-forward" size={35} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Queue Modal - Kết nối với Global Queue */}
      <QueueModal
        visible={queueVisible}
        queue={queue}
        currentTrackId={currentTrack?.id}
        onClose={() => setQueueVisible(false)}
        onTrackSelect={(track) => {
          playTrack(track, queue);
          setQueueVisible(false);
        }}
        onRemoveTrack={(trackId) => {
          removeFromQueue(trackId);
        }}
      />

      <SleepTimer
        visible={sleepTimerVisible}
        onClose={() => setSleepTimerVisible(false)}
        onTimerEnd={() => {
          if (isPlaying) {
            playTrack(currentTrack);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#121212",
    zIndex: 99999,
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 25,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    opacity: 0.7,
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingBottom: 50,
  },
  artworkContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  visualizerContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  cover: {
    width: SCREEN_WIDTH - 60,
    height: SCREEN_WIDTH - 60,
    borderRadius: 12,
    backgroundColor: "#333",
  },
  heartOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
  },
  likedIndicator: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    padding: 8,
  },
  trackInfo: {
    alignItems: "center",
    paddingHorizontal: 30,
    width: "100%",
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  artist: {
    color: "#b3b3b3",
    fontSize: 16,
    textAlign: "center",
  },
  progressContainer: {
    width: "88%",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 5,
    marginTop: -5,
  },
  timeText: {
    color: "#b3b3b3",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "65%",
  },
});
