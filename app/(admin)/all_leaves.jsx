import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";

const theme = {
  bg: "bg-[#282C34]",
  card: "bg-[#333842]",
  accent: "text-[#f49b33]",
  borderColor: "border-[#4C5361]",
};

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
          const userDoc = await firestore()
            .collection("users")
            .doc(userId)
            .get();
          if (isMounted && userDoc.exists) {
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
      className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
    >
      {/* Header: Avatar, Info & Call */}
      <View className="flex-row items-center mb-4">
        {/* Avatar Section */}
        <View className="mr-4">
          {userData?.profileImage ? (
            <Image
              source={{ uri: userData.profileImage }}
              className="w-14 h-14 rounded-full border border-[#f49b33]"
            />
          ) : (
            <View className="w-14 h-14 rounded-full bg-[#f49b33]/20 items-center justify-center border border-[#f49b33]/30">
              <Text className="text-[#f49b33] font-bold text-xl">
                {initial}
              </Text>
            </View>
          )}
        </View>

        {/* Name & Info */}
        <View className="flex-1">
          <Text className="text-white font-bold text-lg leading-tight">
            {displayName}
          </Text>
          <View className="flex-row items-center mt-1">
            <View className="bg-[#f49b33] px-2 py-0.5 rounded mr-2">
              <Text className="text-[#282C34] text-[10px] font-bold">
                {daysCount} {daysCount > 1 ? "Days" : "Day"} Leave
              </Text>
            </View>

            {/* Show Class for Students */}
            {!isTeacher && userData?.standard && (
              <Text className="text-gray-400 text-xs ml-1">
                Class: {userData.standard}
              </Text>
            )}
          </View>
        </View>

        {/* Call Button */}
        <TouchableOpacity
          onPress={handleCall}
          className="bg-[#282C34] w-10 h-10 rounded-full items-center justify-center border border-[#4C5361]"
        >
          <Ionicons name="call" size={18} color="#f49b33" />
        </TouchableOpacity>
      </View>

      {/* Date Range Strip */}
      <View className="bg-[#282C34] rounded-xl flex-row items-center justify-between p-3 mb-3 border border-[#4C5361]/50">
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name="calendar-arrow-right"
            size={20}
            color="#9CA3AF"
          />
          <Text className="text-gray-300 font-bold ml-3 text-sm">
            {item.startDate}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color="#4C5361" />
        <Text className="text-gray-300 font-bold text-sm">{item.endDate}</Text>
      </View>

      {/* Reason */}
      <View className="pl-2 border-l-2 border-[#f49b33]/50">
        <Text className="text-gray-400 text-sm italic">
          &quot;{item.reason || "No reason provided."}&quot;
        </Text>
      </View>
    </View>
  );
};

const AllLeaves = () => {
  const router = useRouter();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Teachers"); // "Teachers" or "Students"

  useEffect(() => {
    setLoading(true);

    // --- COLLECTION SELECTION LOGIC ---
    // Teachers -> "teacher_leaves"
    // Students -> "leaves" (As per instruction)
    const collectionName =
      activeTab === "Teachers" ? "teacher_leaves" : "leaves";

    const unsubscribe = firestore()
      .collection(collectionName)
      .orderBy("createdAt", "desc")
      .onSnapshot(
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
        }
      );

    return () => unsubscribe();
  }, [activeTab]);

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      {/* --- HEADER --- */}
      <View className="px-5 py-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361] mr-4"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Absence Log</Text>
      </View>

      {/* --- TABS --- */}
      <View className="flex-row px-5 mb-4">
        <TouchableOpacity
          onPress={() => setActiveTab("Teachers")}
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === "Teachers" ? "border-[#f49b33]" : "border-[#333842]"}`}
        >
          <Text
            className={`${activeTab === "Teachers" ? "text-[#f49b33] font-bold" : "text-gray-400 font-medium"}`}
          >
            Teachers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("Students")}
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === "Students" ? "border-[#f49b33]" : "border-[#333842]"}`}
        >
          <Text
            className={`${activeTab === "Students" ? "text-[#f49b33] font-bold" : "text-gray-400 font-medium"}`}
          >
            Students
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
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
                color="gray"
              />
              <Text className="text-white text-center mt-4">
                No {activeTab.toLowerCase()} leaves found.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AllLeaves;
