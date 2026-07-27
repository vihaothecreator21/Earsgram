import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { ResponseType, useAuthRequest } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { deleteField, doc, setDoc } from "firebase/firestore";

import { auth, db } from "../config/firebaseConfig";
import { SPOTIFY_CONFIG } from "../config/spotifyConfig";
import {
  clearToken,
  exchangeCodeForToken,
  getSavedToken,
  getUserProfile,
  isSpotifyDashboardAccessError,
  saveToken,
} from "../services/spotifyService";
import { SpotifyProfile } from "../types/spotify";
import { getErrorMessage } from "../utils/getErrorMessage";

WebBrowser.maybeCompleteAuthSession();

type SpotifyContextType = {
  token: string | null;
  loading: boolean;
  userProfile: SpotifyProfile | null;
  connectSpotify: () => void;
  logoutSpotify: () => Promise<void>;
};

const SpotifyAuthContext = createContext<SpotifyContextType | null>(null);

export const SpotifyAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<SpotifyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: SPOTIFY_CONFIG.clientId,
      scopes: SPOTIFY_CONFIG.scopes,
      usePKCE: true,
      redirectUri: SPOTIFY_CONFIG.redirectUri,
    },
    SPOTIFY_CONFIG.discovery
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setToken(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const activeToken = await getSavedToken(user.uid);

      if (activeToken) {
        setToken(activeToken);
        try {
          const profile = await getUserProfile(activeToken);
          setUserProfile(profile);
        } catch (error) {
          if (__DEV__ && !isSpotifyDashboardAccessError(error)) {
            console.log("Spotify token invalid or expired", error);
          }
          await clearToken(user.uid);
          setToken(null);
        }
      }

      setLoading(false);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (response?.type === "success") {
      handleExchangeToken(response.params.code);
    }
  }, [response]);

  const connectSpotify = () => {
    if (!request) return;
    promptAsync();
  };

  const handleExchangeToken = async (code: string) => {
    try {
      setLoading(true);
      const tokenResult = await exchangeCodeForToken(
        code,
        request?.codeVerifier || ""
      );

      const { access_token, expires_in } = tokenResult;

      setToken(access_token);
      if (auth.currentUser) {
        await saveToken(access_token, expires_in, auth.currentUser.uid);
      }

      const profile = await getUserProfile(access_token);
      setUserProfile(profile);

      if (auth.currentUser) {
        await setDoc(
          doc(db, "users", auth.currentUser.uid),
          {
            spotify: {
              isConnected: true,
              email: profile.email || null,
              id: profile.id,
              connectedAt: new Date().toISOString(),
              accessToken: deleteField(),
              tokenExpiration: deleteField(),
            },
          },
          { merge: true }
        );
      }
    } catch (err) {
      Alert.alert("Spotify Error", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const logoutSpotify = async () => {
    setToken(null);
    setUserProfile(null);

    if (auth.currentUser) {
      await clearToken(auth.currentUser.uid);
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          spotify: {
            isConnected: false,
            accessToken: deleteField(),
            tokenExpiration: deleteField(),
          },
        },
        { merge: true }
      );
    }

    await signOut(auth);
  };

  return (
    <SpotifyAuthContext.Provider
      value={{ token, loading, userProfile, connectSpotify, logoutSpotify }}
    >
      {children}
    </SpotifyAuthContext.Provider>
  );
};

export const useSpotifyAuth = () => {
  const ctx = useContext(SpotifyAuthContext);
  if (!ctx) throw new Error("useSpotifyAuth must be used inside Provider");
  return ctx;
};
