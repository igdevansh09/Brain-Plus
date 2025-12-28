import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import YoutubePlayer from "react-native-youtube-iframe";
import { Ionicons } from "@expo/vector-icons";

const StudentVideoPlayer = () => {
  const router = useRouter();

  const {
    courseTitle,
    playlist: playlistParam,
    playlistId, 
    subject,
    title: paramTitle,
    description: paramDesc,
  } = useLocalSearchParams();

  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (playlistParam) {
      try {
        setPlaylist(JSON.parse(playlistParam));
      } catch (e) {
        console.log("Error parsing playlist", e);
      }
    }
  }, [playlistParam]);

  const currentVideo = playlist.length > 0 ? playlist[currentIndex] : null;

  const displayTitle = currentVideo
    ? currentVideo.title
    : paramTitle || courseTitle;
  const displayDesc = paramDesc || "View this course content.";

  const onStateChange = useCallback(
    (state) => {
      if (state === "ended") {
        setPlaying(false);
        if (playlist.length > 0) {
          if (currentIndex < playlist.length - 1) {
            setTimeout(() => setCurrentIndex(currentIndex + 1), 1000);
          } else {
            Alert.alert("Course Completed", "You have finished all chapters.");
          }
        }
      }
    },
    [currentIndex, playlist]
  );

  const renderPlaylistItem = ({ item, index }) => {
    const isActive = index === currentIndex;
    return (
      <TouchableOpacity
        onPress={() => setCurrentIndex(index)}
        style={{
          backgroundColor: isActive ? "#f49b33" : "#333842",
          borderColor: isActive ? "#f49b33" : "#4C5361",
        }}
        className="p-4 rounded-xl mb-3 border flex-row items-center"
      >
        <View className="flex-1">
          <Text
            className={`text-base font-bold ${isActive ? "text-[#282C34]" : "text-white"}`}
            numberOfLines={1}
          >
            {index + 1}. {item.title}
          </Text>
          <Text
            className={`text-xs mt-1 ${isActive ? "text-[#282C34]" : "text-gray-400"}`}
          >
            Duration: {item.duration}
          </Text>
        </View>
        <Ionicons
          name={isActive ? "bar-chart" : "play-circle-outline"}
          size={24}
          color={isActive ? "#282C34" : "#f49b33"}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#282C34]">
      <StatusBar barStyle="light-content" backgroundColor="#282C34" />

      <View className="px-4 py-4 mt-8 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-lg font-bold" numberOfLines={1}>
            {courseTitle || displayTitle}
          </Text>
        </View>
      </View>

      <View className="w-full aspect-video bg-black mb-4">
        <YoutubePlayer
          height={230}
          play={true}
          videoId={currentVideo ? currentVideo.videoId : undefined}
          playList={!currentVideo ? playlistId : undefined} 
          onChangeState={onStateChange}
          initialPlayerParams={{
            loop: false,
            controls: true,
          }}
        />
      </View>

      <View className="flex-1 px-4">
        <Text className="text-[#f49b33] text-xl font-bold mb-1">
          {displayTitle}
        </Text>

        {playlist.length > 0 && (
          <Text className="text-gray-400 text-sm mb-4">
            Chapter {currentIndex + 1} of {playlist.length}
          </Text>
        )}

        <Text className="text-gray-300 text-sm mb-6">{displayDesc}</Text>

        <View className="flex-row justify-between mb-6">
          <TouchableOpacity
            className="flex-1 bg-[#333842] p-3 rounded-lg mr-2 border border-[#4C5361] items-center flex-row justify-center"
            onPress={() => Alert.alert("Notes", "Notes feature coming soon!")}
          >
            <Ionicons name="document-text-outline" size={20} color="#f49b33" />
            <Text className="text-white ml-2 font-semibold">Notes</Text>
          </TouchableOpacity>
        </View>

        {playlist.length > 0 ? (
          <>
            <Text className="text-white font-bold text-lg mb-3">
              Course Playlist
            </Text>
            <FlatList
              data={playlist}
              keyExtractor={(item) => item.id}
              renderItem={renderPlaylistItem}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          </>
        ) : (
          <View className="flex-1 justify-center items-center opacity-50 pb-20">
            <Ionicons name="layers-outline" size={40} color="#888" />
            <Text className="text-gray-400 mt-2 text-center text-sm px-10">
              Use the player controls above to navigate chapters.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default StudentVideoPlayer;
