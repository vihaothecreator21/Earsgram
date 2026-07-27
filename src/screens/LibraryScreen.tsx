import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppStyles as styles } from "../styles/AppStyles";
import { useTheme } from "../context/ThemeContext";
import { SpotifyPlaylist } from "../types/spotify";
import { getErrorMessage } from "../utils/getErrorMessage";
import EmptyState from "../components/EmptyState";
import { ErrorState, LoadingState } from "../components/ScreenState";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import {
  getSavedToken,
  getUserPlaylists,
  getUserProfile,
  createPlaylist,
} from "../services/spotifyService";

import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../config/firebaseConfig";

type LibraryNavigationRoutes = {
  LikedSongs: undefined;
  PlaylistDetail: {
    playlist: SpotifyPlaylist;
    playlistIndex: number;
    allPlaylists: SpotifyPlaylist[];
  };
};

export default function LibraryScreen() {
  const navigation = useNavigation<NavigationProp<LibraryNavigationRoutes>>();
  const { colors, isDark } = useTheme();

  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchPlaylists();
    }, [])
  );

  const toggleViewMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode((prev) => (prev === "grid" ? "list" : "grid"));
  };

  const fetchPlaylists = async () => {
    try {
      setErrorMessage(null);
      if (!auth.currentUser) return;
      const token = await getSavedToken(auth.currentUser.uid);

      if (token) {
        const data = await getUserPlaylists(token);
        const rawPlaylists = data.items || [];

        setPlaylists(rawPlaylists);
      }
    } catch (error) {
      if (__DEV__) console.error(error);
      setErrorMessage("Could not load your playlists. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert("Missing name", "Please enter a playlist name.");
      return;
    }
    setCreating(true);
    try {
      if (!auth.currentUser) return;
      const token = await getSavedToken(auth.currentUser.uid);
      if (!token) return;

      const user = await getUserProfile(token);

      const newPl = await createPlaylist(token, user.id, newPlaylistName);

      if (auth.currentUser) {
        await setDoc(doc(db, "playlists", newPl.id), {
          spotifyId: newPl.id,
          name: newPlaylistName,
          ownerId: auth.currentUser.uid,
          createdAt: new Date().toISOString(),
          trackCount: 0,
        });
      }

      setCreateModalVisible(false);
      setNewPlaylistName("");
      fetchPlaylists();
      Alert.alert("Success", "Playlist created.");
    } catch (e) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const openPlaylistDetail = (playlist: SpotifyPlaylist, index: number) => {
    navigation.navigate("PlaylistDetail", {
      playlist: playlist,
      playlistIndex: index,
      allPlaylists: playlists,
    });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>Library</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={toggleViewMode} style={styles.iconBtn}>
              <Ionicons
                name={viewMode === "grid" ? "list" : "grid"}
                size={24}
                color="#1DB954"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCreateModalVisible(true)}
              style={styles.createBtn}
            >
              <Text style={styles.createBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Liked Songs Card */}
        <TouchableOpacity
          style={styles.likedSongsCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("LikedSongs");
          }}
          activeOpacity={0.7}
        >
          <View style={styles.likedSongsIcon}>
            <Ionicons name="heart" size={32} color="white" />
          </View>
          <View style={styles.likedSongsInfo}>
            <Text style={styles.likedSongsTitle}>Liked Songs</Text>
            <Text style={styles.likedSongsSubtitle}>Your favorite tracks</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#888" />
        </TouchableOpacity>

        {/* Playlist List */}
        {loading ? (
          <LoadingState message="Loading your library..." />
        ) : errorMessage ? (
          <ErrorState
            title="Library unavailable"
            message={errorMessage}
            actionText="Retry"
            onAction={fetchPlaylists}
          />
        ) : (
          <FlatList
            key={viewMode}
            data={playlists}
            keyExtractor={(item) => item.id}
            numColumns={viewMode === "grid" ? 2 : 1}
            columnWrapperStyle={
              viewMode === "grid"
                ? { justifyContent: "space-between" }
                : undefined
            }
            contentContainerStyle={{ paddingBottom: 150 }}
            refreshing={loading}
            onRefresh={fetchPlaylists}
            ListEmptyComponent={
              <EmptyState
                icon="library-outline"
                title="No playlists yet"
                message="Create your first playlist to start building your library."
                actionText="Create Playlist"
                onAction={() => setCreateModalVisible(true)}
              />
            }
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={viewMode === "grid" ? styles.gridItem : styles.listItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openPlaylistDetail(item, index);
                }}
                activeOpacity={0.7}
              >
                <Image
                  source={{
                    uri:
                      item.images?.[0]?.url ||
                      "https://via.placeholder.com/150",
                  }}
                  style={viewMode === "grid" ? styles.gridImg : styles.listImg}
                />
                <View style={viewMode === "list" ? styles.listInfo : {}}>
                  <Text
                    style={[styles.name, { color: colors.text }]}
                    numberOfLines={viewMode === "grid" ? 2 : 1}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.count, { color: colors.textSecondary }]}>
                    {item.tracks?.total || 0} bĂ i hĂ¡t
                  </Text>
                </View>
                {viewMode === "list" && (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            )}
          />
        )}

        {/* Modal Create Playlist */}
        <Modal
          visible={createModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalView, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Create Playlist
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Playlist name..."
                placeholderTextColor={colors.textSecondary}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel]}
                  onPress={() => setCreateModalVisible(false)}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnConfirm]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  <Text style={styles.btnText}>
                    {creating ? "Creating..." : "Create"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}


