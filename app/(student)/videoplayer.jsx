import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import YoutubePlayer from "react-native-youtube-iframe";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

// --- NATIVE SDK ---
import firestore from "@react-native-firebase/firestore";

const { width } = Dimensions.get("window");

const StudentVideoPlayer = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Params can come from 'My Courses' (id) or direct playlist (legacy)
  const {
    id: courseId,
    playlist: playlistParam,
    title: paramTitle,
    description: paramDesc,
  } = params;

  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState([]);
  const [courseInfo, setCourseInfo] = useState({ title: "", description: "" });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef();

  // Theme
  const theme = {
    bg: "#1A1D21",
    card: "#282C34",
    accent: "#f49b33",
    text: "#FFFFFF",
    subText: "#A0A0A0",
    border: "#333842",
    activeItem: "#f49b3315",
  };

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      // MODE A: Fetch by Course ID (Best Practice)
      if (courseId) {
        try {
          const doc = await firestore()
            .collection("courses")
            .doc(courseId)
            .get();
          if (doc.exists) {
            const data = doc.data();
            setPlaylist(data.playlist || []);
            setCourseInfo({
              title: data.title || "Untitled Course",
              description: data.description || "No description available.",
            });
          }
        } catch (e) {
          console.error("Fetch Error:", e);
        }
      }
      // MODE B: Parse Param (Legacy)
      else if (playlistParam) {
        try {
          const parsed = JSON.parse(playlistParam);
          setPlaylist(parsed);
          setCourseInfo({
            title: paramTitle || "Course Content",
            description: paramDesc || "",
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
          // Auto-play next
          setCurrentIndex((prev) => prev + 1);
        } else {
          setPlaying(false);
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
        className={`flex-row items-center p-4 mb-2 mx-4 rounded-xl border ${
          isActive
            ? "border-[#f49b33] bg-[#f49b33]/10"
            : "border-[#333842] bg-[#282C34]"
        }`}
      >
        {/* Number / Icon */}
        <View className="mr-4">
          {isActive ? (
            <MaterialCommunityIcons
              name="play-circle"
              size={24}
              color="#f49b33"
            />
          ) : (
            <Text className="text-gray-500 font-bold text-lg w-6 text-center">
              {index + 1}
            </Text>
          )}
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text
            className={`font-bold text-sm mb-1 ${isActive ? "text-[#f49b33]" : "text-white"}`}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text className="text-gray-500 text-[10px] uppercase">
            Video • {item.videoId ? "Ready" : "Unavailable"}
          </Text>
        </View>

        {/* Status */}
        {isActive && (
          <View className="ml-2">
            <Ionicons name="stats-chart" size={16} color="#f49b33" />
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
          backgroundColor: theme.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* --- VIDEO SECTION (FIXED TOP) --- */}
      <View className="bg-black w-full aspect-video relative z-10 shadow-lg mt-10">
        {currentVideo ? (
          <YoutubePlayer
            ref={playerRef}
            height={width * 0.5625} // 16:9 Aspect Ratio
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
          <View className="flex-1 justify-center items-center bg-[#282C34]">
            <MaterialCommunityIcons
              name="video-off-outline"
              size={40}
              color="#666"
            />
            <Text className="text-gray-500 mt-2">No video selected</Text>
          </View>
        )}
      </View>

      {/* --- SCROLLABLE CONTENT --- */}
      <View className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 1. INFO CARD */}
          <View className="px-5 py-5 border-b border-[#333842]">
            <Text className="text-white text-xl font-bold mb-2 leading-7">
              {currentVideo?.title || courseInfo.title}
            </Text>

            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="bg-[#f49b33]/20 px-2 py-1 rounded mr-2">
                  <Text className="text-[#f49b33] text-[10px] font-bold uppercase">
                    Lecture {currentIndex + 1}
                  </Text>
                </View>
                <Text className="text-gray-400 text-xs">
                  {playlist.length} Videos
                </Text>
              </View>

              {/* NAV CONTROLS */}
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={handlePrev}
                  disabled={currentIndex === 0}
                  className={`p-2 rounded-full mr-2 ${currentIndex === 0 ? "opacity-30" : "bg-[#333842]"}`}
                >
                  <Ionicons name="play-skip-back" size={18} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNext}
                  disabled={currentIndex === playlist.length - 1}
                  className={`p-2 rounded-full ${currentIndex === playlist.length - 1 ? "opacity-30" : "bg-[#333842]"}`}
                >
                  <Ionicons name="play-skip-forward" size={18} color="white" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Description Accordion (Simple) */}
            <Text className="text-gray-400 text-sm leading-5">
              {courseInfo.description}
            </Text>


          </View>

          {/* 2. PLAYLIST HEADER */}
          <View className="px-5 py-4 flex-row items-center justify-between">
            <Text className="text-white font-bold text-lg">Course Content</Text>
            <Text className="text-gray-500 text-xs">
              {currentIndex + 1} / {playlist.length}
            </Text>
          </View>

          {/* 3. PLAYLIST ITEMS */}
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
                color="gray"
              />
              <Text className="text-gray-500 mt-2">No videos available.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default StudentVideoPlayer;
