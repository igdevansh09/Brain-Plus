import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StatusBar,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Linking,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";

const LeaveCard = ({ item, theme }) => {
  const [studentData, setStudentData] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(true);

  // Fetch student details (Avatar & Phone)
  useEffect(() => {
    let isMounted = true;
    const fetchStudent = async () => {
      try {
        if (item.studentId) {
          const docSnap = await firestore()
            .collection("users")
            .doc(item.studentId)
            .get();
          if (isMounted && docSnap.exists) {
            setStudentData(docSnap.data());
          }
        }
      } catch (e) {
        console.log(e);
      } finally {
        if (isMounted) setLoadingStudent(false);
      }
    };
    fetchStudent();
    return () => {
      isMounted = false;
    };
  }, [item.studentId]);

  const handleCall = () => {
    const phone = studentData?.phone || item.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else alert("No phone number available for this student.");
  };

  const getDuration = () => {
    // Simple duration calc based on dates
    // Assuming format DD-MM-YYYY or similar string, better if Timestamp
    // For now, just displaying the range cleanly
    return "Absence Note";
  };

  return (
    <View
      className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
    >
      {/* HEADER: Profile & Call */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-row items-center flex-1">
          {/* Avatar */}
          <View
            className={`w-12 h-12 rounded-full items-center justify-center mr-3 overflow-hidden border ${theme.borderColor} bg-[#282C34]`}
          >
            {studentData?.profileImage ? (
              <Image
                source={{ uri: studentData.profileImage }}
                className="w-full h-full"
              />
            ) : (
              <Text className="text-[#f49b33] font-bold text-lg">
                {item.studentName?.charAt(0) || "S"}
              </Text>
            )}
          </View>

          <View>
            <Text className="text-white font-bold text-lg">
              {item.studentName}
            </Text>
            <Text className="text-gray-400 text-xs">
              {studentData?.rollNo ? `Roll: ${studentData.rollNo}` : "Student"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleCall}
          className="bg-blue-600 w-10 h-10 rounded-xl items-center justify-center"
        >
          <Ionicons name="call" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* BODY: Dates & Reason */}
      <View className="bg-[#282C34] p-3 rounded-xl border border-[#4C5361]/50">
        <View className="flex-row items-center mb-2">
          <MaterialCommunityIcons
            name="calendar-clock"
            size={16}
            color="#f49b33"
            className="mr-2"
          />
          <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">
            Requested Period
          </Text>
        </View>

        <View className="flex-row items-center mb-4">
          <Text className="text-white font-bold text-base">
            {item.startDate}
          </Text>
          <View className="h-[1px] bg-[#4C5361] flex-1 mx-3" />
          <Ionicons
            name="arrow-forward"
            size={16}
            color="#f49b33"
            className="mx-1"
          />
          <View className="h-[1px] bg-[#4C5361] flex-1 mx-3" />
          <Text className="text-white font-bold text-base">{item.endDate}</Text>
        </View>

        <Text className="text-gray-300 text-sm italic border-l-2 border-[#f49b33] pl-3 py-1">
          &quot;{item.reason}&quot;
        </Text>
      </View>

      {/* FOOTER: Date Sent */}
      <View className="flex-row justify-end mt-2">
        <Text className="text-gray-500 text-[10px]">
          Applied on:{" "}
          {item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "N/A"}
        </Text>
      </View>
    </View>
  );
};

const TeacherLeaveViewer = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [myClasses, setMyClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);

  // Toast
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    text: "text-white",
    borderColor: "border-[#4C5361]",
  };

  // --- 1. FETCH PROFILE ---
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const uid = auth().currentUser?.uid;
        if (!uid) return;

        const docSnap = await firestore().collection("users").doc(uid).get();
        if (docSnap.exists) {
          const data = docSnap.data();

          // Get Classes (Support both new profile & legacy array)
          let classes = [];
          if (data.teachingProfile) {
            classes = [...new Set(data.teachingProfile.map((i) => i.class))];
          } else {
            classes = data.classesTaught || [];
          }

          setMyClasses(classes);
          if (classes.length > 0) setSelectedClass(classes[0]);
        }
      } catch (error) {
        console.log("Profile Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // --- 2. FETCH LEAVES ---
  useEffect(() => {
    if (!selectedClass) return;
    fetchLeaves();
  }, [selectedClass]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const q = firestore()
        .collection("leaves")
        .where("classId", "==", selectedClass)
        .orderBy("createdAt", "desc");

      const snapshot = await q.get();
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert timestamp to string if needed for rendering
        createdAt: doc.data().createdAt?.toDate
          ? doc.data().createdAt.toDate()
          : doc.data().createdAt,
      }));
      setLeaveRequests(list);
    } catch (error) {
      console.log("Fetch Error:", error);
      // Optional: handle permission errors gracefully
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeaves();
    setRefreshing(false);
  };

  if (loading && !refreshing && leaveRequests.length === 0) {
    return (
      <SafeAreaView
        className={`flex-1 ${theme.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* --- HEADER --- */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Student Leaves</Text>
        <View className="w-10" />
      </View>

      {/* --- CLASS SELECTOR --- */}
      <View className="px-5 mb-4 mt-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {myClasses.length > 0 ? (
            myClasses.map((cls) => (
              <TouchableOpacity
                key={cls}
                onPress={() => setSelectedClass(cls)}
                className={`mr-3 px-5 py-2 rounded-xl border ${selectedClass === cls ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-[#4C5361]"}`}
              >
                <Text
                  className={`font-bold ${selectedClass === cls ? "text-[#282C34]" : "text-gray-400"}`}
                >
                  {cls}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-gray-500 italic">No classes assigned.</Text>
          )}
        </ScrollView>
      </View>

      {/* --- LIST --- */}
      <FlatList
        data={leaveRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LeaveCard item={item} theme={theme} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f49b33"
          />
        }
        ListEmptyComponent={() => (
          <View className="mt-20 items-center opacity-30">
            <MaterialCommunityIcons
              name="email-open-outline"
              size={80}
              color="gray"
            />
            <Text className="text-gray-400 mt-4 text-center">
              No leave requests for {selectedClass}.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default TeacherLeaveViewer;
