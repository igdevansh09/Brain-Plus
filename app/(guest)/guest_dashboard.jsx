import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../config/firebaseConfig";

const GuestDashboard = () => {
  const router = useRouter();
  const [courses, setCourses] = useState([]); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const q = query(
          collection(db, "courses"),
          where("target", "==", "Guest")
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCourses(list);
      } catch (error) {
        console.log("Error fetching guest content:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  const handleWatch = (item) => {
    router.push({
      pathname: "/(guest)/videoplayer",
      params: {
        courseTitle: item.title,
        playlist: JSON.stringify(item.playlist),
        description: item.description,
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#282C34] justify-center items-center">
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#282C34] pt-8">
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      <View className="px-4 py-4 flex-row justify-between items-center">
        <View>
          <Text className="text-white text-2xl font-bold">Guest Access</Text>
          <Text className="text-gray-400 text-sm">Explore free content</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/login_options")}
          className="bg-[#f49b33] px-4 py-2 rounded-full"
        >
          <Text className="text-[#282C34] font-bold">Login</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 mt-2">
        <Text className="text-[#f49b33] text-xl font-bold mb-4">
          Free Demo Classes
        </Text>

        {courses.length === 0 ? (
          <Text className="text-gray-500 text-center mt-10">
            No free content available at the moment.
          </Text>
        ) : (
          courses.map((course) => (
            <TouchableOpacity
              key={course.id}
              activeOpacity={0.9}
              onPress={() => handleWatch(course)}
              className="bg-[#333842] rounded-xl overflow-hidden mb-6 border border-[#4C5361]"
            >
              <View>
                <Image
                  source={{ uri: course.thumbnail }}
                  style={{ width: "100%", height: 180 }}
                  resizeMode="cover"
                />
                <View className="absolute inset-0 justify-center items-center bg-black/30">
                  <Ionicons name="play-circle" size={50} color="#f49b33" />
                </View>
              </View>

              <View className="p-4">
                <Text className="text-white text-lg font-bold">
                  {course.title}
                </Text>
                <Text className="text-gray-400 text-sm mt-1" numberOfLines={2}>
                  {course.description}
                </Text>
                <Text className="text-[#f49b33] text-xs mt-2 font-bold">
                  Watch Playlist
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View className="p-6 bg-[#f49b33]/10 rounded-xl border border-[#f49b33] mt-2 mb-10">
          <Text className="text-[#f49b33] text-center font-bold text-lg mb-2">
            Want Full Access?
          </Text>
          <Text className="text-gray-300 text-center mb-4">
            Sign up to access the full syllabus, live classes, and homework.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/studentsignup")}
            className="bg-[#f49b33] py-3 rounded-lg"
          >
            <Text className="text-[#282C34] font-bold text-center">
              Register Now
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default GuestDashboard;
