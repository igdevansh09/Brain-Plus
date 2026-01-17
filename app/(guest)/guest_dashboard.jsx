import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

// Refactor: Custom Header
import CustomHeader from "../../components/CustomHeader";

// Refactor: Modular Imports
import { signInAnonymously } from "@react-native-firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig";

const GuestDashboard = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeGuest = async () => {
      try {
        // 1. Silent Anonymous Login (Modular)
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        // 2. Fetch Guest Content (Modular)
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
        if (
          error.code === "auth/admin-restricted-operation" ||
          error.code === "auth/operation-not-allowed"
        ) {
          Alert.alert(
            "Configuration Error",
            "Please enable Anonymous Authentication in your Firebase Console."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    initializeGuest();
  }, []);

  const handleWatch = (item) => {
    router.push({
      pathname: "/(guest)/videoplayer",
      params: {
        id: item.id,
        courseTitle: item.title,
        playlist: JSON.stringify(item.playlist),
        description: item.description,
      },
    });
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
    <SafeAreaView
      style={{ backgroundColor: theme.bgPrimary }}
      className="flex-1"
    >
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* --- ADDED showBack={true} HERE --- */}
      <CustomHeader
        title="Guest Access"
        subtitle="Explore free content"
        showBack={true}
        // Passing the Login Button as a custom right component
        rightComponent={
          <TouchableOpacity
            onPress={() => router.push("/login_options")}
            style={{ backgroundColor: theme.accent }}
            className="px-4 py-2 rounded-full"
          >
            <Text style={{ color: theme.textDark }} className="font-bold">
              Login
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        className="flex-1 px-4 mt-2"
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{ color: theme.accent }}
          className="text-xl font-bold mb-4 mt-4"
        >
          Free Demo Classes
        </Text>

        {courses.length === 0 ? (
          <Text
            style={{ color: theme.textMuted }}
            className="text-center mt-10"
          >
            No free content available at the moment.
          </Text>
        ) : (
          courses.map((course) => (
            <TouchableOpacity
              key={course.id}
              activeOpacity={0.9}
              onPress={() => handleWatch(course)}
              style={{
                backgroundColor: theme.bgSecondary,
                borderColor: theme.border,
              }}
              className="rounded-xl overflow-hidden mb-6 border"
            >
              <View>
                <Image
                  source={{
                    uri:
                      course.thumbnail ||
                      "https://via.placeholder.com/300x150.png?text=Course+Thumbnail",
                  }}
                  style={{ width: "100%", height: 180 }}
                  resizeMode="cover"
                />
                <View className="absolute inset-0 justify-center items-center bg-black/30">
                  <Ionicons name="play-circle" size={50} color={theme.accent} />
                </View>
              </View>

              <View className="p-4">
                <Text
                  style={{ color: theme.textPrimary }}
                  className="text-lg font-bold"
                >
                  {course.title}
                </Text>
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-sm mt-1"
                  numberOfLines={2}
                >
                  {course.description}
                </Text>
                <Text
                  style={{ color: theme.accent }}
                  className="text-xs mt-2 font-bold"
                >
                  Watch Playlist
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View
          style={{
            backgroundColor: theme.accentSoft10,
            borderColor: theme.accent,
          }}
          className="p-6 rounded-xl border mt-2 mb-10"
        >
          <Text
            style={{ color: theme.accent }}
            className="text-center font-bold text-lg mb-2"
          >
            Want Full Access?
          </Text>
          <Text
            style={{ color: theme.textSecondary }}
            className="text-center mb-4"
          >
            Sign up to access the full syllabus, live classes, and homework.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/studentsignup")}
            style={{ backgroundColor: theme.accent }}
            className="py-3 rounded-lg"
          >
            <Text
              style={{ color: theme.textDark }}
              className="font-bold text-center"
            >
              Register Now
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default GuestDashboard;
 
