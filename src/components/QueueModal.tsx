import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useMusic } from "../context/MusicContext";
import { SpotifyTrack } from "../types/spotify";

const { height } = Dimensions.get("window");

interface QueueModalProps {
  visible: boolean;
  queue: SpotifyTrack[];
  currentTrackId?: string;
  onClose: () => void;
  onTrackSelect: (track: SpotifyTrack) => void;
  onRemoveTrack: (trackId: string) => void;
}

export const QueueModal = ({
  visible,
  queue,
  currentTrackId,
  onClose,
  onTrackSelect,
  onRemoveTrack,
}: QueueModalProps) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const { reorderQueue } = useMusic();
  const flatListRef = useRef<FlatList>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const queueRef = useRef(queue);

  const [localQueue, setLocalQueue] = useState(queue);

  useEffect(() => {
    setLocalQueue(queue);
    queueRef.current = queue;
  }, [queue]);

  const stopMoving = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startMoving = (trackId: string, direction: "up" | "down") => {
    handleMoveByTrackId(trackId, direction);

    timerRef.current = setInterval(() => {
      handleMoveByTrackId(trackId, direction);
    }, 120);
  };

  const handleMoveByTrackId = (trackId: string, direction: "up" | "down") => {
    const currentQueue = [...queueRef.current];
    const index = currentQueue.findIndex((t) => t.id === trackId);

    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= currentQueue.length) {
      stopMoving();
      return;
    }

    flatListRef.current?.scrollToIndex({
      index: targetIndex,
      animated: true,
      viewPosition: 0.5,
    });

    [currentQueue[index], currentQueue[targetIndex]] = [
      currentQueue[targetIndex],
      currentQueue[index],
    ];

    queueRef.current = currentQueue;

    setLocalQueue(currentQueue);
    reorderQueue?.(currentQueue);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 10,
        tension: 60,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const renderQueueItem = ({
    item,
    index,
  }: {
    item: SpotifyTrack;
    index: number;
  }) => {
    const isCurrentTrack = item.id === currentTrackId;
    const currentTrackIndex = queue.findIndex((t) => t.id === currentTrackId);
    const isPlayed = index < currentTrackIndex;

    return (
      <View
        style={[
          styles.queueItem,
          isCurrentTrack && styles.queueItemActive,
          isPlayed && { opacity: 0.5 },
        ]}
      >
        <Image
          source={{ uri: item.album.images[0]?.url || "" }}
          style={styles.queueItemImage}
        />

        <TouchableOpacity
          style={styles.queueItemInfo}
          onPress={() => onTrackSelect(item)}
        >
          <Text
            style={[
              styles.queueItemName,
              isCurrentTrack && styles.queueItemNameActive,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.queueItemArtist} numberOfLines={1}>
            {item.artists[0]?.name || "Unknown"}
          </Text>
        </TouchableOpacity>

        {/* Cụm nút di chuyển bài hát */}
        <View style={styles.moveControls}>
          <TouchableOpacity
            onPressIn={() => startMoving(item.id, "up")}
            onPressOut={stopMoving}
            disabled={index === 0}
            style={[styles.moveBtn, index === 0 && { opacity: 0.1 }]}
          >
            <Ionicons name="chevron-up" size={24} color="#1DB954" />
          </TouchableOpacity>

          <TouchableOpacity
            onPressIn={() => startMoving(item.id, "down")}
            onPressOut={stopMoving}
            disabled={index === queue.length - 1}
            style={[
              styles.moveBtn,
              index === queue.length - 1 && { opacity: 0.1 },
            ]}
          >
            <Ionicons name="chevron-down" size={24} color="#1DB954" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => onRemoveTrack(item.id)}
          style={styles.removeButton}
        >
          <Ionicons name="close-circle" size={22} color="#ff5252" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="chevron-down" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.title}>Queue ({queue.length})</Text>
            <View style={{ width: 32 }} />
          </View>

          <FlatList
            ref={flatListRef}
            data={localQueue}
            keyExtractor={(item) => item.id}
            renderItem={renderQueueItem}
            contentContainerStyle={styles.listContent}
            extraData={localQueue}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Queue is empty</Text>
              </View>
            }
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: height * 0.85,
    backgroundColor: "#121212",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#282828",
  },
  closeButton: { padding: 4 },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  listContent: { paddingBottom: 40 },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
  },
  queueItemActive: {
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#1DB954",
  },
  queueItemImage: { width: 45, height: 45, borderRadius: 4, marginRight: 12 },
  queueItemInfo: { flex: 1 },
  queueItemName: { fontSize: 14, fontWeight: "600", color: "white" },
  queueItemNameActive: { color: "#1DB954" },
  queueItemArtist: { fontSize: 12, color: "#b3b3b3", marginTop: 2 },
  moveControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#282828",
    borderRadius: 8,
    marginRight: 10,
    overflow: "hidden",
  },
  moveBtn: {
    padding: 10,
    paddingHorizontal: 12,
  },
  removeButton: { padding: 4 },
  emptyContainer: { alignItems: "center", marginTop: 100 },
  emptyText: { color: "#666", fontSize: 16 },
});
