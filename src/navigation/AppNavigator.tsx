import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

type TabIconName = React.ComponentProps<typeof Ionicons>["name"];

// Screens
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import LibraryScreen from "../screens/LibraryScreen";
import PlaylistDetailScreen from "../screens/PlaylistDetailScreen";
import LikedSongsScreen from "../screens/LikedSongsScreen";

// Components & Context
import { MusicProvider, useMusic } from "../context/MusicContext";
import { useTheme } from "../context/ThemeContext";
import MiniPlayer from "../components/MiniPlayer";
import FullPlayer from "../components/FullPlayer";
import StatsScreen from "../screens/StatsScreen";
import ArtistDetailsScreen from "../screens/ArtistDetailsScreen";
import AlbumDetailsScreen from "../screens/AlbumDetailsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: TabIconName = "home";
          if (route.name === "Home")
            iconName = focused ? "home" : "home-outline";
          else if (route.name === "Search")
            iconName = focused ? "search" : "search-outline";
          else if (route.name === "Library")
            iconName = focused ? "library" : "library-outline";
          else if (route.name === "Stats")
            iconName = focused ? "stats-chart" : "stats-chart-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
    </Tab.Navigator>
  );
}

const RootNavigation = () => {
  const { colors, isDark } = useTheme();

  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  const customTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
    fonts: baseTheme.fonts || {
      regular: {
        fontFamily: "System",
        fontWeight: "400" as const,
      },
      medium: {
        fontFamily: "System",
        fontWeight: "500" as const,
      },
      bold: {
        fontFamily: "System",
        fontWeight: "700" as const,
      },
      heavy: {
        fontFamily: "System",
        fontWeight: "900" as const,
      },
    },
  };

  return (
    <NavigationContainer
      theme={customTheme}
      documentTitle={{
        formatter: (options, route) =>
          `${options?.title ?? route?.name} - Eargasm`,
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          animation: "fade_from_bottom", // Smooth transition
          animationDuration: 300,
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={TabNavigator}
          options={{
            headerShown: false,
            animation: "none",
          }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{
            title: "Profile",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="LikedSongs"
          component={LikedSongsScreen}
          options={{
            headerShown: false,
            title: "Liked Songs",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="PlaylistDetail"
          component={PlaylistDetailScreen}
          options={{
            headerShown: false,
            title: "Playlist",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="ArtistDetails"
          component={ArtistDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AlbumDetails"
          component={AlbumDetailsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>

      {/* Render Components Globally */}
      <MiniPlayer />

      {/* Conditionally Render FullPlayer */}
      <FullPlayerWrapper />
    </NavigationContainer>
  );
};

function FullPlayerWrapper() {
  const { isExpanded } = useMusic();
  return isExpanded ? <FullPlayer /> : null;
}

export default function AppNavigator() {
  return (
    <MusicProvider>
      <RootNavigation />
    </MusicProvider>
  );
}
