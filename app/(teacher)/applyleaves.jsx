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

// Helper: Calculate Days
const getDaysCount = (start, end) => {
  try {
    const d1 = new Date(start);
    const d2 = new Date(end);
    if (isNaN(d1) || isNaN(d2)) return 1;
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  } catch (e) {
    return 1;
  }
};

const StudentLeaveCard = ({ item }) => {
  const [studentData, setStudentData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch Student Avatar
  useEffect(() => {
    let isMounted = true;
    const fetchStudentProfile = async () => {
      try {
        if (item.studentId) {
          const userDoc = await firestore()
            .collection("users")
            .doc(item.studentId)
            .get();
          if (isMounted && userDoc.exists) {
            setStudentData(userDoc.data());
          }
        }
      } catch (error) {
        console.log("Error fetching student:", error);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };
    fetchStudentProfile();
    return () => {
      isMounted = false;
    };
  }, [item.studentId]);

  const handleCall = () => {
    const phone = studentData?.phone || item.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert("Unavailable", "No phone number found.");
  };

  const daysCount = getDaysCount(item.startDate, item.endDate);

  return (
    <View
      className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
    >
      {/* Header: Avatar, Info & Call */}
      <View className="flex-row items-center mb-4">
        {/* Avatar Section */}
        <View className="mr-4">
          {studentData?.profileImage ? (
            <Image
              source={{ uri: studentData.profileImage }}
              className="w-14 h-14 rounded-full border border-[#f49b33]"
            />
          ) : (
            <View className="w-14 h-14 rounded-full bg-[#f49b33]/20 items-center justify-center border border-[#f49b33]/30">
              <Text className="text-[#f49b33] font-bold text-xl">
                {item.studentName?.charAt(0) || "S"}
              </Text>
            </View>
          )}
        </View>

        {/* Name & Days Info */}
        <View className="flex-1">
          <Text className="text-white font-bold text-lg leading-tight">
            {item.studentName}
          </Text>
          <View className="flex-row items-center mt-1">
            <View className="bg-[#f49b33] px-2 py-0.5 rounded mr-2">
              <Text className="text-[#282C34] text-[10px] font-bold">
                {daysCount} {daysCount > 1 ? "Days" : "Day"} Leave
              </Text>
            </View>
            <Text className="text-gray-400 text-xs">
              {studentData?.standard || "Student"}
            </Text>
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

const TeacherStudentLeaves = () => {
  const router = useRouter();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FIX: Removed .orderBy to avoid index issues, handling sort manually
    const unsubscribe = firestore()
      .collection("leaves") // Fetching Student Leaves
      .onSnapshot((snapshot) => {
        if (!snapshot) return;
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Manual Sort (Newest First)
        list.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return tB - tA;
        });

        setLeaves(list);
        setLoading(false);
      });
    return () => unsubscribe();
  }, []);

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
        <Text className="text-white text-2xl font-bold">Student Leaves</Text>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <StudentLeaveCard item={item} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="calendar-check"
                size={80}
                color="gray"
              />
              <Text className="text-white text-center mt-4">
                No leave applications found.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default TeacherStudentLeaves;
