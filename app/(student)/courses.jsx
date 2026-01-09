import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

// --- NATIVE SDK IMPORTS ---
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const MyCourses = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get dynamic theme values
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState([]);

  // --- 1. FETCH DATA ---
  const fetchCourses = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      // 1. Get Student Class
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      const studentClass = userDoc.data()?.standard;

      if (!studentClass) {
        setLoading(false);
        return;
      }

      // 2. Fetch Courses using 'target' field
      // Logic: target string starts with the class name (e.g. "11th Physics" starts with "11th")
      const snapshot = await firestore()
        .collection("courses")
        .where("target", ">=", studentClass)
        .where("target", "<=", studentClass + "\uf8ff")
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

  // --- 2. CLEAN CARD DESIGN ---
  const CourseCard = ({ item }) => {
    // Extract subject from target string (e.g. "11th Physics" -> "Physics")
    const subject = item.target.replace(/^\S+\s/, "") || "General";
    const lessonCount = item.playlist ? item.playlist.length : 0;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/(student)/videoplayer",
            params: { id: item.id },
          })
        }
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        }}
        className="flex-row p-3 rounded-2xl mb-4 border items-center shadow-sm"
      >
        {/* Thumbnail */}
        <View
          style={{
            backgroundColor: theme.bgTertiary,
            borderColor: theme.border,
          }}
          className="w-20 h-20 rounded-xl overflow-hidden mr-4 border"
        >
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={24}
                color={theme.textMuted}
              />
            </View>
          )}
        </View>

        {/* Content */}
        <View className="flex-1 justify-center">
          <View className="flex-row justify-between items-start">
            <Text
              style={{ color: theme.accent }}
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
            >
              {subject}
            </Text>
          </View>

          <Text
            style={{ color: theme.textPrimary }}
            className="font-bold text-lg leading-6 mb-1"
            numberOfLines={2}
          >
            {item.title}
          </Text>

          <View className="flex-row items-center">
            <Ionicons
              name="play-circle-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs ml-1"
            >
              {lessonCount} Videos
            </Text>
          </View>
        </View>

        {/* Action Icon */}
        <View className="pl-2">
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ backgroundColor: theme.bgPrimary }}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bgPrimary}
      />

      {/* --- HEADER --- */}
      <View className="px-5 pt-3 pb-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="p-2 rounded-full border"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-xl font-bold"
        >
          My Courses
        </Text>
        <View className="w-10" />
      </View>

      {/* --- LIST --- */}
      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CourseCard item={item} />}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 50,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        ListEmptyComponent={() => (
          <View className="items-center py-20 opacity-40">
            <MaterialCommunityIcons
              name="bookshelf"
              size={64}
              color={theme.textMuted}
            />
            <Text style={{ color: theme.textMuted }} className="mt-4 text-base">
              No courses found.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default MyCourses;
