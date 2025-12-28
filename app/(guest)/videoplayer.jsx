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

const GuestVideoPlayer = () => {
  const router = useRouter();

  const { courseTitle, playlist: playlistParam } = useLocalSearchParams();

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

  const currentVideo = playlist[currentIndex] || {};

  const onStateChange = useCallback(
    (state) => {
      if (state === "ended") {
        setPlaying(false);
        if (currentIndex < playlist.length - 1) {
          setTimeout(() => setCurrentIndex(currentIndex + 1), 1000);
        } else {
          Alert.alert("Demo Finished", "Register to access full courses!");
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
            {courseTitle}
          </Text>
        </View>
      </View>

      <View className="w-full aspect-video bg-black mb-4">
        <YoutubePlayer
          height={230}
          play={true}
          videoId={currentVideo.videoId}
          onChangeState={onStateChange}
          key={currentVideo.videoId} 
        />
      </View>

      <View className="flex-1 px-4">
        <Text className="text-[#f49b33] text-xl font-bold mb-1">
          {currentVideo.title}
        </Text>

        <View className="my-4 p-3 bg-[#f49b33]/10 rounded-lg border border-[#f49b33]/50 flex-row items-center justify-between">
          <Text className="text-white text-xs">Want more features?</Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/studentsignup")}
            className="bg-[#f49b33] px-3 py-1 rounded"
          >
            <Text className="text-[#282C34] font-bold text-xs">Sign Up</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-white font-bold text-lg mb-3">Chapters</Text>

        <FlatList
          data={playlist}
          keyExtractor={(item) => item.id}
          renderItem={renderPlaylistItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
};

export default GuestVideoPlayer;
