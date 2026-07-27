// src/screens/LibraryScreen.tsx
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

import { AppStyles as styles } from "../styles/AppStyles"; // âœ… Chá»‰ dĂ¹ng 1 nguá»“n styles duy nháº¥t
import { useTheme } from "../context/ThemeContext";
import { SpotifyPlaylist } from "../types/spotify";
import { getErrorMessage } from "../utils/getErrorMessage";

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

import { doc, setDoc } from "firebase/firestore"; // Bá» getDoc vĂ¬ khĂ´ng cáº§n merge ná»¯a
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

  // State
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Create Playlist State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creating, setCreating] = useState(false);

  // Má»—i khi mĂ n hĂ¬nh Ä‘Æ°á»£c focus, load láº¡i danh sĂ¡ch
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
      if (!auth.currentUser) return;
      // âœ… FIX: Truyá»n uid vĂ o getSavedToken Ä‘á»ƒ láº¥y Ä‘Ăºng token
      const token = await getSavedToken(auth.currentUser.uid);

      if (token) {
        const data = await getUserPlaylists(token);
        const rawPlaylists = data.items || [];

        // âœ… FIX QUAN TRá»ŒNG:
        // Sá»­ dá»¥ng trá»±c tiáº¿p dá»¯ liá»‡u tá»« Spotify Ä‘á»ƒ Ä‘áº£m báº£o sá»‘ lÆ°á»£ng bĂ i hĂ¡t (total) luĂ´n Ä‘Ăºng.
        // KhĂ´ng cáº§n merge vá»›i Firestore ná»¯a vĂ¬ Spotify lĂ  nguá»“n dá»¯ liá»‡u gá»‘c (Single Source of Truth).
        setPlaylists(rawPlaylists);
      }
    } catch (error) {
      if (__DEV__) console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert("Lá»—i", "Vui lĂ²ng nháº­p tĂªn Playlist");
      return;
    }
    setCreating(true);
    try {
      if (!auth.currentUser) return;
      const token = await getSavedToken(auth.currentUser.uid);
      if (!token) return;

      const user = await getUserProfile(token);

      // 1. Táº¡o trĂªn Spotify
      const newPl = await createPlaylist(token, user.id, newPlaylistName);

      // 2. LÆ°u vĂ o Firestore Ä‘á»ƒ backup (náº¿u cáº§n dĂ¹ng sau nĂ y)
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
      fetchPlaylists(); // Load láº¡i Ä‘á»ƒ tháº¥y playlist má»›i
      Alert.alert("ThĂ nh cĂ´ng", "ÄĂ£ táº¡o playlist má»›i!");
    } catch (e) {
      Alert.alert("Lá»—i", getErrorMessage(e));
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
          <Text style={[styles.title, { color: colors.text }]}>ThÆ° viá»‡n</Text>
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
              <Text style={styles.createBtnText}>+ Táº¡o má»›i</Text>
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
          <ActivityIndicator
            size="large"
            color="#1DB954"
            style={{ marginTop: 50 }}
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
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginTop: 50,
                }}
              >
                ChÆ°a cĂ³ playlist nĂ o.
              </Text>
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
                  {/* âœ… FIX: Hiá»ƒn thá»‹ Ä‘Ăºng sá»‘ bĂ i tá»« Spotify */}
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
                Táº¡o Playlist Má»›i
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
                placeholder="TĂªn playlist..."
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
                  <Text style={styles.btnText}>Há»§y</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnConfirm]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  <Text style={styles.btnText}>
                    {creating ? "Äang táº¡o..." : "Táº¡o"}
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

// âœ… FIX: ÄĂƒ XĂ“A KHá»I 'const styles = ...' á» ÄĂ‚Y Äá»‚ TRĂNH Lá»–I XUNG Äá»˜T

