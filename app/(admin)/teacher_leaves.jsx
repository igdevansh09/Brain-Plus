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

const LeaveCard = ({ item }) => {
  const [teacherData, setTeacherData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchTeacherProfile = async () => {
      try {
        if (item.teacherId) {
          const userDoc = await firestore()
            .collection("users")
            .doc(item.teacherId)
            .get();
          if (isMounted && userDoc.exists) {
            setTeacherData(userDoc.data());
          }
        }
      } catch (error) {
        console.log("Error fetching teacher:", error);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };
    fetchTeacherProfile();
    return () => {
      isMounted = false;
    };
  }, [item.teacherId]);

  const handleCall = () => {
    const phone = teacherData?.phone || item.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert("Unavailable", "No phone number found for this teacher.");
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
          {teacherData?.profileImage ? (
            <Image
              source={{ uri: teacherData.profileImage }}
              className="w-14 h-14 rounded-full border border-[#f49b33]"
            />
          ) : (
            <View className="w-14 h-14 rounded-full bg-[#f49b33]/20 items-center justify-center border border-[#f49b33]/30">
              <Text className="text-[#f49b33] font-bold text-xl">
                {item.teacherName?.charAt(0) || "T"}
              </Text>
            </View>
          )}
        </View>

        {/* Name & Days Info */}
        <View className="flex-1">
          <Text className="text-white font-bold text-lg leading-tight">
            {item.teacherName}
          </Text>
          <View className="flex-row items-center mt-1">
            <View className="bg-[#f49b33] px-2 py-0.5 rounded mr-2">
              <Text className="text-[#282C34] text-[10px] font-bold">
                {daysCount} {daysCount > 1 ? "Days" : "Day"} Leave
              </Text>
            </View>
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

const AdminTeacherLeaves = () => {
  const router = useRouter();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection("teacher_leaves")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        if (!snapshot) return;
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
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
        <Text className="text-white text-2xl font-bold">Absence Log</Text>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LeaveCard item={item} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="calendar-check"
                size={80}
                color="gray"
              />
              <Text className="text-white text-center mt-4">
                No absence notifications.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AdminTeacherLeaves;
