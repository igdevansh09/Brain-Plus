import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// --- NATIVE SDK IMPORTS ---
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const MyCourses = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState([]);

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    accentBg: "bg-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    border: "border-[#4C5361]",
  };

  // --- 1. FETCH DATA (NATIVE SDK) ---
  const fetchCourses = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      // First, get student's enrolled standard/class
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      const studentClass = userDoc.data()?.standard;

      if (!studentClass) {
        setLoading(false);
        return;
      }

      // Fetch courses mapped to this class
      const snapshot = await firestore()
        .collection("courses")
        .where("classId", "==", studentClass)
        .get();

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setCourses(data);
    } catch (error) {
      console.log("Error fetching courses:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCourses();
  }, []);

  // --- 2. RENDER COURSE ITEM ---
  const renderCourseItem = ({ item }) => {
    const progress = item.progress || 0; // percentage value

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() =>
          router.push({ pathname: "/coursedetail", params: { id: item.id } })
        }
        className={`${theme.card} p-5 rounded-3xl mb-5 border ${theme.border} shadow-lg`}
      >
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-1">
            <View className="bg-[#f49b33]/10 px-3 py-1 rounded-full self-start mb-2 border border-[#f49b33]/20">
              <Text className="text-[#f49b33] text-[10px] font-bold uppercase tracking-widest">
                {item.category || "Academic"}
              </Text>
            </View>
            <Text className="text-white text-xl font-bold">{item.title}</Text>
            <Text className="text-gray-400 text-xs mt-1">
              Instructor: {item.teacherName || "Assigned Faculty"}
            </Text>
          </View>

          <View className="bg-[#282C34] p-3 rounded-2xl border border-[#4C5361]">
            <MaterialCommunityIcons
              name={item.icon || "book-open-variant"}
              size={24}
              color="#f49b33"
            />
          </View>
        </View>

        {/* Syllabus Progress UI */}
        <View className="mt-2">
          <View className="flex-row justify-between items-end mb-2">
            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-tighter">
              Syllabus Completion
            </Text>
            <Text className="text-[#f49b33] font-bold text-sm">
              {progress}%
            </Text>
          </View>
          <View className="h-2 bg-[#282C34] rounded-full overflow-hidden w-full border border-[#4C5361]/30">
            <View
              style={{ width: `${progress}%` }}
              className="h-full bg-[#f49b33] rounded-full"
            />
          </View>
        </View>

        <View className="flex-row mt-5 pt-4 border-t border-[#4C5361]/50 justify-between items-center">
          <View className="flex-row items-center">
            <Ionicons name="layers-outline" size={14} color="#888" />
            <Text className="text-gray-500 text-xs ml-1">
              {item.lessonsCount || 0} Lessons
            </Text>
          </View>
          <View className="flex-row items-center bg-[#f49b33] px-4 py-1.5 rounded-xl">
            <Text className="text-[#282C34] font-bold text-[10px] uppercase">
              Continue
            </Text>
            <Ionicons
              name="chevron-forward"
              size={12}
              color="#282C34"
              className="ml-1"
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${theme.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${theme.bg} pt-8`}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">My Courses</Text>
        <View className="w-10" />
      </View>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        renderItem={renderCourseItem}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f49b33"
          />
        }
        ListEmptyComponent={() => (
          <View className="items-center py-20 opacity-30">
            <MaterialCommunityIcons
              name="book-off-outline"
              size={80}
              color="gray"
            />
            <Text className="text-gray-400 mt-4 text-center text-lg font-medium">
              No courses assigned to your class.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default MyCourses;
