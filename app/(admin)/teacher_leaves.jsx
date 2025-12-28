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

  return (
    <View
      className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
    >
      {/* Header: Teacher Info */}
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-row items-center flex-1">
          <View className="w-12 h-12 rounded-full bg-[#f49b33]/20 items-center justify-center mr-3 border border-[#f49b33]/30">
            <Text className="text-[#f49b33] font-bold text-xl">
              {item.teacherName?.charAt(0) || "T"}
            </Text>
          </View>
          <View>
            <Text className="text-white font-bold text-lg">
              {item.teacherName}
            </Text>
            {loadingData ? (
              <ActivityIndicator size="small" color="#f49b33" />
            ) : (
              <Text className="text-gray-400 text-xs">
                {teacherData?.subjects?.join(", ") || "No Subject"}
              </Text>
            )}
          </View>
        </View>

        {/* Call Button */}
        <TouchableOpacity
          onPress={handleCall}
          className="bg-blue-600 w-10 h-10 rounded-xl items-center justify-center shadow-sm"
        >
          <Ionicons name="call" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Body: Date & Reason */}
      <View className="bg-[#282C34] p-3 rounded-xl border border-[#4C5361]/50">
        <View className="flex-row items-center mb-2">
          <MaterialCommunityIcons
            name="calendar-clock"
            size={16}
            color="#f49b33"
            className="mr-2"
          />
          <Text className="text-gray-300 text-xs font-bold uppercase tracking-wide">
            Absence Period
          </Text>
        </View>
        <Text className="text-white font-bold text-base mb-3 pl-6">
          {item.startDate} <Text className="text-[#f49b33]">➔</Text>{" "}
          {item.endDate}
        </Text>

        <View className="h-[1px] bg-[#4C5361] w-full mb-3 opacity-50" />

        <Text className="text-gray-400 text-sm italic pl-1">
          &quot;{item.reason}&quot;
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
