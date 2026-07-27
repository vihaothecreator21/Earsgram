import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { SpotifyPlaylist, SpotifyTrack } from "../types/spotify";

interface Props {
  visible: boolean;
  track: SpotifyTrack | null;
  playlists: SpotifyPlaylist[];
  playlistsContainingTrack: Set<string>;
  adding: boolean;
  onPlayNext: () => void;
  onAddQueue: () => void;
  onAddPlaylist: (playlistId: string, playlistName: string) => void;
  onClose: () => void;
}

export default function TrackOptionsModal({
  visible,
  track,
  playlists,
  playlistsContainingTrack,
  adding,
  onPlayNext,
  onAddQueue,
  onAddPlaylist,
  onClose,
}: Props) {
  if (!visible || !track) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={{ uri: track.album?.images?.[0]?.url }}
              style={styles.image}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {track.name}
              </Text>
              <Text style={styles.subtitle}>{track.artists?.[0]?.name}</Text>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.actionBtn} onPress={onPlayNext}>
            <Ionicons name="return-down-forward" size={22} color="white" />
            <Text style={styles.actionText}>Play Next</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={onAddQueue}>
            <Ionicons name="list" size={22} color="white" />
            <Text style={styles.actionText}>Add to Queue</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Add to Playlist</Text>

          {adding ? (
            <ActivityIndicator color="#1DB954" />
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              style={{ width: "100%", maxHeight: 320 }}
              renderItem={({ item }) => {
                const hasSong = playlistsContainingTrack?.has(item.id);

                return (
                  <TouchableOpacity
                    style={[styles.playlistOption, hasSong && { opacity: 0.5 }]}
                    disabled={hasSong || adding}
                    onPress={() => onAddPlaylist(item.id, item.name)}
                    activeOpacity={0.8}
                  >
                    {/* 🖼 PLAYLIST IMAGE */}
                    <Image
                      source={{
                        uri:
                          item.images?.[0]?.url ||
                          "https://via.placeholder.com/60",
                      }}
                      style={styles.playlistThumb}
                    />

                    {/* 📄 INFO */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.playlistName,
                          hasSong && { color: "#aaa" },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>

                      {hasSong && (
                        <Text style={styles.addedText}>Already added</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={{ color: "white", fontWeight: "bold" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "85%",
    backgroundColor: "#282828",
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  image: { width: 50, height: 50, borderRadius: 4, marginRight: 15 },
  title: { color: "white", fontSize: 16, fontWeight: "bold" },
  subtitle: { color: "#aaa", fontSize: 13 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1DB954",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  actionText: { color: "white", fontWeight: "bold", marginLeft: 10 },
  divider: {
    height: 1,
    backgroundColor: "#444",
    marginVertical: 15,
  },
  sectionTitle: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  playlistRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  playlistOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    width: "100%",
    borderBottomWidth: 0.5,
    borderBottomColor: "#444",
  },

  playlistThumb: {
    width: 45,
    height: 45,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: "#333",
  },

  playlistName: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },

  addedText: {
    fontSize: 12,
    color: "#1DB954",
    marginTop: 2,
    fontWeight: "bold",
  },

  closeBtn: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#444",
    alignItems: "center",
    borderRadius: 8,
  },
});
