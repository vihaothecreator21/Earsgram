import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import LibraryScreen from "../screens/LibraryScreen";
import StatsScreen from "../screens/StatsScreen";
import MiniPlayer from "../components/MiniPlayer";
import FullPlayer from "../components/FullPlayer";
import { useMusic } from "../context/MusicContext";

const Tab = createBottomTabNavigator();
type TabIconName = React.ComponentProps<typeof Ionicons>["name"];

export default function TabsWithPlayer() {
  const { isExpanded } = useMusic(); // ✅ ĐÚNG CHỖ

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#121212",
            borderTopColor: "#282828",
            height: 60,
            paddingBottom: 10,
          },
          tabBarActiveTintColor: "white",
          tabBarInactiveTintColor: "gray",
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: TabIconName = "home";

            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Search") {
              iconName = focused ? "search" : "search-outline";
            } else if (route.name === "Library") {
              iconName = focused ? "library" : "library-outline";
            } else if (route.name === "Stats") {
              iconName = focused ? "stats-chart" : "stats-chart-outline";
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Search" component={SearchScreen} />
        <Tab.Screen name="Library" component={LibraryScreen} />
        <Tab.Screen name="Stats" component={StatsScreen} />
      </Tab.Navigator>

      <MiniPlayer />
      {isExpanded && <FullPlayer />}
    </>
  );
}
