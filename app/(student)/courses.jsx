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
import { useTheme } from "../../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

const MyCourses = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState([]);

  // --- 1. FETCH DATA (MODULAR) ---
  const fetchCourses = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // 1. Get Student Data (Standard & Enrolled Subjects)
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const studentClass = userData.standard; // e.g., "12th" or "CS"
      const enrolledSubjects = userData.enrolledSubjects || []; // e.g., ["Physics", "CS"]

      // 2. Fetch All Courses and Filter Locally
      // (Fetching all is necessary because Firestore queries with mixed OR logic on different fields are limited)
      const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const allCourses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // --- FILTER LOGIC ---
      const filteredCourses = allCourses.filter((course) => {
        // Condition A: Course matches student's standard exactly (e.g. "12th" matches "12th")
        // Logic: Check if target starts with the class name
        if (course.target.startsWith(studentClass)) return true;

        // Condition B: CS Course Exception
        // If the course target is "CS", show it to students in class "CS" OR students with "CS" subject
        if (course.target.startsWith("CS")) {
          const hasCSSubject = enrolledSubjects.some(
            (sub) =>
              sub.trim().toUpperCase() === "CS" ||
              sub.trim().toUpperCase() === "COMPUTER SCIENCE"
          );
          if (studentClass === "CS" || hasCSSubject) return true;
        }

        return false;
      });

      setCourses(filteredCourses);
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
 
