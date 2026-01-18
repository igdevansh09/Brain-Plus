import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from "@react-native-firebase/firestore";
import { db } from "../../config/firebaseConfig";
// --- REFACTOR END ---

import { useTheme } from "../../context/ThemeContext";
import ScreenWrapper from "../../components/ScreenWrapper"; // <--- IMPORTED
import CustomHeader from "../../components/CustomHeader"; // <--- IMPORTED

const getDaysCount = (start, end) => {
  try {
    const d1 = new Date(start);
    const d2 = new Date(end);
    if (isNaN(d1) || isNaN(d2)) return 1;

    // Calculate difference in milliseconds
    const diffTime = Math.abs(d2 - d1);
    // Convert to days and add 1 (inclusive of start date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  } catch (e) {
    return 1;
  }
};

const LeaveCard = ({ item, type }) => {
  const { theme } = useTheme();
  const [userData, setUserData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // Determine ID and Name based on the leave type
  const isTeacher = type === "Teachers";
  const userId = isTeacher ? item.teacherId : item.studentId;

  // Fallback name if user profile fails to load
  const fallbackName = isTeacher ? item.teacherName : item.studentName;

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        if (userId) {
          const userDoc = await getDoc(doc(db, "users", userId));
          if (isMounted && userDoc.exists()) {
            setUserData(userDoc.data());
          }
        }
      } catch (error) {
        console.log("Error fetching user:", error);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleCall = () => {
    const phone = userData?.phone || item.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert("Unavailable", "No phone number found.");
  };

  const daysCount = getDaysCount(item.startDate, item.endDate);

  // Display Name logic
  const displayName = userData?.name || fallbackName || "Unknown";

  // Avatar Initial
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }}
      className="p-4 rounded-2xl mb-4 border shadow-sm"
    >
      {/* Header: Avatar, Info & Call */}
      <View className="flex-row items-center mb-4">
        {/* Avatar Section */}
        <View className="mr-4">
          {userData?.profileImage ? (
            <Image
              source={{ uri: userData.profileImage }}
              style={{ borderColor: theme.accent, borderWidth: 1 }}
              className="w-14 h-14 rounded-full"
            />
          ) : (
            <View
              style={{
                backgroundColor:
                  theme.accentSoft10 || "rgba(244, 155, 51, 0.1)",
                borderColor: theme.accentSoft30 || "rgba(244, 155, 51, 0.3)",
                borderWidth: 1,
              }}
              className="w-14 h-14 rounded-full items-center justify-center"
            >
              <Text
                style={{ color: theme.accent }}
                className="font-bold text-xl"
              >
                {initial}
              </Text>
            </View>
          )}
        </View>

        {/* Name & Info */}
        <View className="flex-1">
          <Text
            style={{ color: theme.textPrimary }}
            className="font-bold text-lg leading-tight"
          >
            {displayName}
          </Text>
          <View className="flex-row items-center mt-1">
            <View
              style={{ backgroundColor: theme.accent }}
              className="px-2 py-0.5 rounded mr-2"
            >
              <Text
                style={{ color: theme.textDark }}
                className="text-[10px] font-bold"
              >
                {daysCount} {daysCount > 1 ? "Days" : "Day"} Leave
              </Text>
            </View>

            {/* Show Class for Students */}
            {!isTeacher && userData?.standard && (
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs ml-1"
              >
                Class: {userData.standard}
              </Text>
            )}
          </View>
        </View>

        {/* Call Button */}
        <TouchableOpacity
          onPress={handleCall}
          style={{
            backgroundColor: theme.bgPrimary,
            borderColor: theme.border,
          }}
          className="w-10 h-10 rounded-full items-center justify-center border"
        >
          <Ionicons name="call" size={18} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {/* Date Range Strip */}
      <View
        style={{
          backgroundColor: theme.bgTertiary,
          borderColor: theme.borderSoft || "rgba(0,0,0,0.05)",
        }}
        className="rounded-xl flex-row items-center justify-between p-3 mb-3 border"
      >
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name="calendar-arrow-right"
            size={20}
            color={theme.textMuted}
          />
          <Text
            style={{ color: theme.textSecondary }}
            className="font-bold ml-3 text-sm"
          >
            {item.startDate}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={theme.textMuted} />
        <Text
          style={{ color: theme.textSecondary }}
          className="font-bold text-sm"
        >
          {item.endDate}
        </Text>
      </View>

      {/* Reason */}
      <View
        style={{ borderLeftColor: theme.accentSoft50 || theme.accent }}
        className="pl-2 border-l-2"
      >
        <Text style={{ color: theme.textMuted }} className="text-sm italic">
          &quot;{item.reason || "No reason provided."}&quot;
        </Text>
      </View>
    </View>
  );
};

const AllLeaves = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Teachers"); // "Teachers" or "Students"

  useEffect(() => {
    setLoading(true);

    // --- COLLECTION SELECTION LOGIC ---
    const collectionName =
      activeTab === "Teachers" ? "teacher_leaves" : "leaves";

    // Modular: query(collection, orderBy)
    const q = query(
      collection(db, collectionName),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot) {
          setLeaves([]);
          setLoading(false);
          return;
        }
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLeaves(list);
        setLoading(false);
      },
      (err) => {
        console.log("Error fetching leaves:", err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [activeTab]);

  return (
    // FIX: Using ScreenWrapper with 'edges' to exclude top padding
    <ScreenWrapper scrollable={false} edges={["left", "right", "bottom"]}>

      {/* --- TABS --- */}
      <View className="flex-row px-5 mb-4 pt-2">
        <TouchableOpacity
          onPress={() => setActiveTab("Teachers")}
          style={{
            borderBottomColor:
              activeTab === "Teachers" ? theme.accent : theme.border,
            borderBottomWidth: 2,
          }}
          className="flex-1 py-3 items-center"
        >
          <Text
            style={{
              color: activeTab === "Teachers" ? theme.accent : theme.textMuted,
              fontWeight: activeTab === "Teachers" ? "bold" : "500",
            }}
          >
            Teachers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("Students")}
          style={{
            borderBottomColor:
              activeTab === "Students" ? theme.accent : theme.border,
            borderBottomWidth: 2,
          }}
          className="flex-1 py-3 items-center"
        >
          <Text
            style={{
              color: activeTab === "Students" ? theme.accent : theme.textMuted,
              fontWeight: activeTab === "Students" ? "bold" : "500",
            }}
          >
            Students
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.accent}
          className="mt-10"
        />
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LeaveCard item={item} type={activeTab} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="calendar-check"
                size={80}
                color={theme.textMuted}
              />
              <Text
                style={{ color: theme.textMuted }}
                className="text-center mt-4"
              >
                No {activeTab.toLowerCase()} leaves found.
              </Text>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
};

export default AllLeaves;
