import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import YoutubePlayer from "react-native-youtube-iframe";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

// Refactor: Custom Header
import CustomHeader from "../../components/CustomHeader";

// Refactor: Modular Imports
import { doc, getDoc } from "@react-native-firebase/firestore";
import { db } from "../../config/firebaseConfig";

const { width } = Dimensions.get("window");

const GuestVideoPlayer = () => {
  const params = useLocalSearchParams();
  const { theme, isDark } = useTheme();

  // Params
  const {
    id: courseId,
    playlist: playlistParam,
    courseTitle,
    description: paramDesc,
  } = params;

  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState([]);
  const [courseInfo, setCourseInfo] = useState({ title: "", description: "" });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef();

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      // Priority 1: Fetch fresh data if ID exists
      if (courseId) {
        try {
          // Modular: getDoc(doc(db, ...))
          const docRef = doc(db, "courses", courseId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setPlaylist(data.playlist || []);
            setCourseInfo({
              title: data.title || "Guest Course",
              description:
                data.description || "Enjoy this free preview content.",
            });
          }
        } catch (e) {
          console.error("Fetch Error:", e);
        }
      }
      // Priority 2: Use passed params
      else if (playlistParam) {
        try {
          setPlaylist(JSON.parse(playlistParam));
          setCourseInfo({
            title: courseTitle || "Guest Course",
            description: paramDesc || "Enjoy this free preview content.",
          });
        } catch (e) {
          console.error("Parse Error:", e);
        }
      }
      setLoading(false);
    };

    init();
  }, [courseId, playlistParam]);

  // --- 2. PLAYER LOGIC ---
  const currentVideo = playlist[currentIndex];

  const onStateChange = useCallback(
    (state) => {
      if (state === "ended") {
        if (currentIndex < playlist.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setPlaying(false);
          Alert.alert(
            "Preview Ended",
            "Register now to access the full course!"
          );
        }
      } else if (state === "playing") {
        setPlaying(true);
      } else if (state === "paused") {
        setPlaying(false);
      }
    },
    [currentIndex, playlist]
  );

  const handleVideoSelect = (index) => {
    setCurrentIndex(index);
    setPlaying(true);
  };

  const handleNext = () => {
    if (currentIndex < playlist.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };


  // --- 3. RENDER ITEMS ---
  const renderPlaylistItem = ({ item, index }) => {
    const isActive = index === currentIndex;

    return (
      <TouchableOpacity
        onPress={() => handleVideoSelect(index)}
        style={{
          backgroundColor: isActive ? theme.accentSoft10 : theme.bgSecondary,
          borderColor: isActive ? theme.accent : theme.border,
        }}
        className={`flex-row items-center p-4 mb-2 mx-4 rounded-xl border`}
      >
        <View className="mr-4">
          {isActive ? (
            <MaterialCommunityIcons
              name="play-circle"
              size={24}
              color={theme.accent}
            />
          ) : (
            <Text
              style={{ color: theme.textMuted }}
              className="font-bold text-lg w-6 text-center"
            >
              {index + 1}
            </Text>
          )}
        </View>

        <View className="flex-1">
          <Text
            style={{ color: isActive ? theme.accent : theme.textPrimary }}
            className="font-bold text-sm mb-1"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text
            style={{ color: theme.textMuted }}
            className="text-[10px] uppercase"
          >
            Video • {item.videoId ? "Ready" : "Unavailable"}
          </Text>
        </View>

        {isActive && (
          <View className="ml-2">
            <Ionicons name="stats-chart" size={16} color={theme.accent} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.bgPrimary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="black" // Keep black for video area focus
      />

      {/* --- ADDED HEADER WITH BACK BUTTON --- */}
      <CustomHeader title="Course Player" showBack={true} />

      {/* --- VIDEO PLAYER --- */}
      <View className="bg-black w-full aspect-video relative z-10 shadow-lg">
        {currentVideo ? (
          <YoutubePlayer
            ref={playerRef}
            height={width * 0.5625}
            width={width}
            play={playing}
            videoId={currentVideo.videoId}
            onChangeState={onStateChange}
            initialPlayerParams={{
              modestbranding: true,
              rel: false,
            }}
          />
        ) : (
          <View
            style={{ backgroundColor: theme.bgSecondary }}
            className="flex-1 justify-center items-center"
          >
            <MaterialCommunityIcons
              name="video-off-outline"
              size={40}
              color={theme.textMuted}
            />
            <Text style={{ color: theme.textMuted }} className="mt-2">
              No video selected
            </Text>
          </View>
        )}
      </View>

      {/* --- CONTENT --- */}
      <View className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* INFO CARD */}
          <View
            style={{ borderColor: theme.border }}
            className="px-5 py-5 border-b"
          >
            <Text
              style={{ color: theme.textPrimary }}
              className="text-xl font-bold mb-2 leading-7"
            >
              {currentVideo?.title || courseInfo.title}
            </Text>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: theme.accentSoft20 }}
                  className="px-2 py-1 rounded mr-2"
                >
                  <Text
                    style={{ color: theme.accent }}
                    className="text-[10px] font-bold uppercase"
                  >
                    Lecture {currentIndex + 1}
                  </Text>
                </View>
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs"
                >
                  {playlist.length} Videos
                </Text>
              </View>

              {/* NAV CONTROLS */}
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={handlePrev}
                  disabled={currentIndex === 0}
                  style={{ backgroundColor: theme.bgSecondary }}
                  className={`p-2 rounded-full mr-2 ${currentIndex === 0 ? "opacity-30" : ""}`}
                >
                  <Ionicons
                    name="play-skip-back"
                    size={18}
                    color={theme.textPrimary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNext}
                  disabled={currentIndex === playlist.length - 1}
                  style={{ backgroundColor: theme.bgSecondary }}
                  className={`p-2 rounded-full ${currentIndex === playlist.length - 1 ? "opacity-30" : ""}`}
                >
                  <Ionicons
                    name="play-skip-forward"
                    size={18}
                    color={theme.textPrimary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* PLAYLIST HEADER */}
          <View className="px-5 py-4 flex-row items-center justify-between">
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-lg"
            >
              Demo Content
            </Text>
            <Text style={{ color: theme.textMuted }} className="text-xs">
              {currentIndex + 1} / {playlist.length}
            </Text>
          </View>

          {/* PLAYLIST ITEMS */}
          {playlist.length > 0 ? (
            <View className="pb-10">
              {playlist.map((item, index) => (
                <React.Fragment key={index}>
                  {renderPlaylistItem({ item, index })}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View className="items-center py-10 opacity-50">
              <MaterialCommunityIcons
                name="playlist-remove"
                size={60}
                color={theme.textMuted}
              />
              <Text style={{ color: theme.textMuted }} className="mt-2">
                No videos available.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default GuestVideoPlayer;
