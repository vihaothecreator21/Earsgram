import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { Audio } from "expo-av";
import { db, auth } from "../config/firebaseConfig";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { getPlayableUrl } from "../services/spotifyService";

interface MusicContextType {
  isPlaying: boolean;
  currentTrack: any;
  isExpanded: boolean;
  playTrack: (track: any, list?: any[]) => Promise<void>;
  pauseTrack: () => Promise<void>;
  resumeTrack: () => Promise<void>;
  closePlayer: () => Promise<void>;
  expandPlayer: () => void;
  collapsePlayer: () => void;
  position: number;
  duration: number;
  seekTo: (value: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  insertNext: (track: any) => void;
  addToQueue: (track: any) => void;
  removeFromQueue: (trackId: string) => void;
  queue: any[];
  reorderQueue?: (newQueue: any[]) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider = ({ children }: { children: ReactNode }) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const playStartTimeRef = useRef<number | null>(null);

  // Use refs to keep latest queue/index for playNext/playPrevious
  const queueRef = useRef<any[]>([]);
  const currentIndexRef = useRef<number>(-1);

  const seekTo = async (value: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(value);
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const expandPlayer = () => setIsExpanded(true);
  const collapsePlayer = () => setIsExpanded(false);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(1);

  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [queue, setQueue] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Save listening history to Firestore
  const saveListeningHistory = useCallback(async (track: any) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        if (__DEV__)
          console.log("â ï¸ Cannot save history: user not authenticated");
        return;
      }

      if (!playStartTimeRef.current) {
        if (__DEV__) console.log("â ï¸ Cannot save history: no play start time");
        return;
      }

      const playDuration = Date.now() - playStartTimeRef.current;

      // Only save if played for at least 3 seconds
      if (playDuration < 3000) {
        if (__DEV__) console.log("â ï¸ Not saving history: played < 3s");
        return;
      }

      const historyRef = collection(db, "users", user.uid, "listening_history");

      await addDoc(historyRef, {
        track: {
          id: track.id,
          name: track.name,
          artists: track.artists,
          album: track.album,
        },
        duration: playDuration,
        playedAt: Timestamp.now(),
      });

      if (__DEV__) console.log("âœ… Saved listening history for:", track.name);
    } catch (error: any) {
      // Silently fail for Firebase permission errors - don't block playback
      if (__DEV__) {
        if (error.code === "permission-denied") {
          console.log(
            "â ï¸ Firebase permissions issue - history not saved (non-critical)"
          );
        } else {
          console.error("Failed to save listening history:", error);
        }
      }
    }
  }, []);

  const insertNext = useCallback((trackToAdd: any) => {
    const currentQueue = [...queueRef.current];
    const currentIdx = currentIndexRef.current;

    if (currentIdx !== -1) {
      currentQueue.splice(currentIdx + 1, 0, trackToAdd);
    } else {
      currentQueue.unshift(trackToAdd);
      currentIndexRef.current = 0;
      setCurrentIndex(0);
    }

    // Cáº­p nháº­t cáº£ Ref vĂ  State
    queueRef.current = currentQueue;
    setQueue(currentQueue);

    if (__DEV__) console.log("â• Inserted next:", trackToAdd.name);
  }, []);

  const playNext = async () => {
    const currentQueue = queueRef.current;
    const currentIdx = currentIndexRef.current;

    if (currentQueue.length === 0) return;

    const nextIndex = (currentIdx + 1) % currentQueue.length;

    await playTrack(currentQueue[nextIndex], currentQueue);
  };

  const playPrevious = async () => {
    const currentQueue = queueRef.current;
    const currentIdx = currentIndexRef.current;

    if (__DEV__) {
      console.log(
        "đŸ” playPrevious called - queue length:",
        currentQueue.length,
        "currentIndex:",
        currentIdx
      );
      console.log(
        "đŸ” Queue preview:",
        currentQueue.map((t) => t.name).slice(0, 3)
      );
    }

    if (currentQueue.length === 0) {
      if (__DEV__) console.log("âŒ playPrevious: queue is empty");
      return;
    }
    const prevIndex =
      (currentIdx - 1 + currentQueue.length) % currentQueue.length;
    if (__DEV__)
      console.log(
        "âœ… playPrevious: moving to index",
        prevIndex,
        "/",
        currentQueue.length
      );
    await playTrack(currentQueue[prevIndex], currentQueue);
  };

  const playTrack = async (track: any, list?: any[]) => {
    const previewUrl =
      track.preview_url ||
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

    try {
      // Save previous track history before switching
      if (currentTrack && currentTrack.id !== track.id) {
        await saveListeningHistory(currentTrack);
      }

      // Náº¿u truyá»n danh sĂ¡ch bĂ i â†’ set queue
      if (list && list.length > 0) {
        if (__DEV__)
          console.log("đŸ“‹ Setting queue with", list.length, "tracks");
        queueRef.current = list;
        setQueue(list);
        const index = list.findIndex((t) => t.id === track.id);
        currentIndexRef.current = index;
        setCurrentIndex(index);
      } else if (queueRef.current.length > 0) {
        // If no list provided but queue exists, find track in existing queue
        const existingIndex = queueRef.current.findIndex((t) => t.id === track.id);
        if (existingIndex !== -1) {
          if (__DEV__)
            console.log(
              "đŸ“‹ Using existing queue, setting index to",
              existingIndex
            );
          currentIndexRef.current = existingIndex;
          setCurrentIndex(existingIndex);
        } else {
          if (__DEV__)
            console.warn(
              "â ï¸ playTrack called without list, and track not in queue"
            );
        }
      } else {
        if (__DEV__)
          console.warn("â ï¸ playTrack called without list and queue is empty");
      }

      // Toggle play/pause if same track
      if (currentTrack?.id === track.id && soundRef.current) {
        const status = await soundRef.current.getStatusAsync();

        if (!status.isLoaded) {
          if (__DEV__) console.log("â ï¸ Track not loaded, reloading...");
          // Fallback: reload track
        } else if (status.isPlaying) {
          // Pause with proper state check
          await pauseTrack();
          return;
        } else {
          // Resume with proper state check
          await resumeTrack();
          return;
        }
      }

      if (soundRef.current) {
        // Stop immediately - no fade out for instant response
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (e) {
          // Ignore if already stopped
          if (__DEV__) console.log("â ï¸ Error stopping old track:", e);
        }
        soundRef.current = null;
      }

      const playableUrl = await getPlayableUrl(track);

      if (!playableUrl) {
        console.log("âŒ No playable URL found");
        return;
      }

      setCurrentTrack(track);
      setIsPlaying(true);
      playStartTimeRef.current = Date.now();

      const { sound } = await Audio.Sound.createAsync(
        { uri: playableUrl },
        { shouldPlay: false, volume: 0 }
      );

      soundRef.current = sound;

      // Quick fade in - 2 steps only
      await sound.playAsync();
      await sound.setVolumeAsync(0.5);
      await new Promise((resolve) => setTimeout(resolve, 30));
      await sound.setVolumeAsync(1);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status.isLoaded) return;
        setPosition(status.positionMillis);
        setDuration(status.durationMillis || 1);

        if (status.didJustFinish) {
          playNext();
        }
      });
    } catch (e) {
      if (__DEV__) console.error(e);
    }
  };

  const pauseTrack = async () => {
    if (!soundRef.current) return;

    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        if (__DEV__) console.log("â ï¸ Cannot pause: sound not loaded");
        setIsPlaying(false);
        return;
      }

      if (!status.isPlaying) {
        if (__DEV__) console.log("â ï¸ Already paused");
        setIsPlaying(false);
        return;
      }

      // Immediate state update to prevent UI lag
      setIsPlaying(false);

      // Quick fade out (reduced time)
      await soundRef.current.setVolumeAsync(0.3);
      await new Promise((resolve) => setTimeout(resolve, 30));
      await soundRef.current.setVolumeAsync(0);

      // Pause immediately
      await soundRef.current.pauseAsync();

      // Reset volume for next play
      await soundRef.current.setVolumeAsync(1);

      if (__DEV__) console.log("âœ… Paused successfully");
    } catch (e) {
      if (__DEV__) console.error("âŒ Pause error:", e);
      setIsPlaying(false);
      // Force pause without fade
      try {
        await soundRef.current.pauseAsync();
      } catch (fallbackError) {
        if (__DEV__) console.error("âŒ Fallback pause failed:", fallbackError);
      }
    }
  };

  const resumeTrack = async () => {
    if (!soundRef.current) return;

    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        if (__DEV__) console.log("â ï¸ Cannot resume: sound not loaded");
        setIsPlaying(false);
        return;
      }

      if (status.isPlaying) {
        if (__DEV__) console.log("â ï¸ Already playing");
        setIsPlaying(true);
        return;
      }

      // Immediate state update
      setIsPlaying(true);

      // Quick fade in (reduced time)
      await soundRef.current.setVolumeAsync(0);
      await soundRef.current.playAsync();
      await new Promise((resolve) => setTimeout(resolve, 30));
      await soundRef.current.setVolumeAsync(0.5);
      await new Promise((resolve) => setTimeout(resolve, 30));
      await soundRef.current.setVolumeAsync(1);

      if (__DEV__) console.log("âœ… Resumed successfully");
    } catch (e) {
      if (__DEV__) console.error("âŒ Resume error:", e);
      setIsPlaying(false);
      // Force play without fade
      try {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      } catch (fallbackError) {
        if (__DEV__) console.error("âŒ Fallback resume failed:", fallbackError);
      }
    }
  };

  const closePlayer = async () => {
    try {
      if (soundRef.current) {
        // Get status first
        const status = await soundRef.current.getStatusAsync();

        if (__DEV__)
          console.log(
            "đŸ”´ Closing player - status:",
            status.isLoaded,
            status.isLoaded ? status.isPlaying : "Not Loaded"
          );

        // Stop if playing - with volume fade for clean stop
        if (status.isLoaded) {
          // Mute immediately
          await soundRef.current.setVolumeAsync(0);

          if (status.isPlaying) {
            await soundRef.current.pauseAsync(); // Pause first
            await soundRef.current.stopAsync(); // Then stop
          }
          await soundRef.current.unloadAsync();
        }
        soundRef.current = null;
        if (__DEV__) console.log("âœ… Player closed and sound stopped");
      }
    } catch (e) {
      if (__DEV__) console.error("â ï¸ Error closing player:", e);
      // Force clear ref even if error
      soundRef.current = null;
    }

    // Save history before closing
    if (currentTrack) {
      await saveListeningHistory(currentTrack);
    }

    setCurrentTrack(null);
    setIsPlaying(false);
  };

  const addToQueue = useCallback((trackToAdd: any) => {
    // Láº¥y queue hiá»‡n táº¡i
    const currentQueue = [...queueRef.current];

    // Äáº©y vĂ o cuá»‘i máº£ng
    currentQueue.push(trackToAdd);

    // Cáº­p nháº­t cáº£ Ref vĂ  State
    queueRef.current = currentQueue;
    setQueue(currentQueue);

    if (__DEV__) console.log("â• Added to end of queue:", trackToAdd.name);
  }, []);

  const reorderQueue = useCallback(
    (newQueue: any[]) => {
      queueRef.current = newQueue;
      setQueue(newQueue);

      if (currentTrack) {
        const newIndex = newQueue.findIndex((t) => t.id === currentTrack.id);
        if (newIndex !== -1) {
          currentIndexRef.current = newIndex;
          setCurrentIndex(newIndex);
        }
      }

      if (__DEV__) console.log("Queue reordered");
    },
    [currentTrack]
  );

  const removeFromQueue = (trackId: string) => {
    if (__DEV__) console.log("Removing from queue:", trackId);

    const removedIndex = queueRef.current.findIndex((t) => t.id === trackId);
    const newQueue = queueRef.current.filter((t) => t.id !== trackId);
    queueRef.current = newQueue;
    setQueue(newQueue);

    if (removedIndex !== -1) {
      let nextIndex = currentIndexRef.current;
      if (removedIndex < currentIndexRef.current) {
        nextIndex -= 1;
      } else if (currentIndexRef.current >= newQueue.length) {
        nextIndex = newQueue.length - 1;
      }

      currentIndexRef.current = Math.max(nextIndex, -1);
      setCurrentIndex(currentIndexRef.current);
    }

    if (__DEV__) console.log("Queue now has", newQueue.length, "tracks");
  };

  return (
    <MusicContext.Provider
      value={{
        isPlaying,
        currentTrack,
        isExpanded,
        playTrack,
        pauseTrack,
        resumeTrack,
        closePlayer,
        expandPlayer,
        collapsePlayer,
        position,
        duration,
        seekTo,
        playNext,
        insertNext,
        playPrevious,
        addToQueue,
        removeFromQueue,
        queue,
        reorderQueue,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within a MusicProvider");
  return context;
};
