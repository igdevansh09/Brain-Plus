import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal, 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { auth, db } from "../../config/firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
  where,
} from "firebase/firestore";

import CustomAlert from "../../components/CustomAlert";
import CustomAlert2 from "../../components/CustomAlert2";

const TeacherDashboard = () => {
  const router = useRouter();
  const [teacherData, setTeacherData] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSalary, setPendingSalary] = useState(0);
  const [profileModalVisible, setProfileModalVisible] = useState(false); 

  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);

  const [readOnlyVisible, setReadOnlyVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState({
    title: "",
    message: "",
  });

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    accentBg: "bg-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    borderColor: "border-[#4C5361]",
  };

  const fetchData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setTeacherData(userDoc.data());
        }

        const salaryQ = query(
          collection(db, "salaries"),
          where("teacherId", "==", user.uid),
          where("status", "==", "Pending")
        );
        const salarySnap = await getDocs(salaryQ);
        let total = 0;
        salarySnap.forEach((doc) => {
          total += parseInt(doc.data().amount || 0);
        });
        setPendingSalary(total);

        const q = query(collection(db, "notices"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const noticesList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotices(noticesList);
      }
    } catch (error) {
      console.log("Error fetching data:", error);
    }
  };

  useEffect(() => {
    const loadInitial = async () => {
      await fetchData();
      setLoading(false);
    };
    loadInitial();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handleLogoutPress = () => {
    setLogoutAlertVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutAlertVisible(false);
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const quickAccess = [
    {
      id: "1",
      name: "Attendance",
      icon: "checkmark-circle-outline",
      route: "/attendancescreen",
    },
    {
      id: "2",
      name: "Homework",
      icon: "book-outline",
      route: "/homeworkscreen",
    },
    {
      id: "3",
      name: "Notify Students",
      icon: "megaphone-outline",
      route: "/notifystudents",
    },
    {
      id: "4",
      name: "Submit Scores",
      icon: "ribbon-outline",
      route: "/testscores",
    },
    {
      id: "5",
      name: "Student Leaves",
      icon: "eye-outline",
      route: "/applyleaves",
    },
    {
      id: "6",
      name: "Upload Notes",
      icon: "document-attach-outline",
      route: "/classnotes",
    },
    {
      id: "7",
      name: "My Leave",
      icon: "calendar-outline",
      route: "/(teacher)/request_leave", 
    },
    {
      id: "8", 
      name: "My Students",
      icon: "people-outline",
      route: "/(teacher)/my_students",
    },
  ];

  const handlePress = (item) => {
    if (item.content) {
      setSelectedContent({
        title: item.title,
        message: item.content,
      });
      setReadOnlyVisible(true);
    } else {
      console.log(`Navigating to: ${item.name || item.title}`);
    }
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
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      <CustomAlert
        visible={logoutAlertVisible}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        type="warning"
        onCancel={() => setLogoutAlertVisible(false)}
        onConfirm={confirmLogout}
      />

      <CustomAlert2
        visible={readOnlyVisible}
        title={selectedContent.title}
        message={selectedContent.message}
        onClose={() => setReadOnlyVisible(false)}
      />

      <Modal
        visible={profileModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/80 p-4">
          <View className="bg-[#333842] w-full rounded-xl p-6 border border-[#f49b33]">
            <Text className="text-white text-2xl font-bold mb-4 border-b border-gray-600 pb-2">
              {teacherData?.name}
            </Text>

            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase mb-1">
                Contact Info
              </Text>
              <Text className="text-white text-base mb-1">
                <Ionicons name="mail" size={15} color={"#eab308"} />
                {"  "} {teacherData?.email}
              </Text>
              <Text className="text-white text-base">
                <Ionicons name="call" size={15} color={"#eab308"} />
                {"  "} {teacherData?.phone || "N/A"}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase mb-1">
                Academic Info
              </Text>
              <Text className="text-white text-base mb-1">
                <Text className="font-bold">Classes:</Text>{" "}
                {teacherData?.classesTaught?.join(", ")}
              </Text>
              <Text className="text-white text-sm text-gray-300">
                <Text className="font-bold">Subjects:</Text>{" "}
                {teacherData?.subjects?.join(", ")}
              </Text>
            </View>

            <View className="mb-6">
              <Text className="text-gray-400 text-xs uppercase mb-1">
                Financial Info
              </Text>
              <Text className="text-[#4CAF50] text-xl font-bold">
                {teacherData?.salaryType === "Commission"
                  ? "Commission Based"
                  : `Salary: ₹${teacherData?.salary}`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setProfileModalVisible(false)}
              className="bg-[#f49b33] p-3 rounded-lg items-center"
            >
              <Text className="text-[#282C34] font-bold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        className="flex-1 px-4 py-7"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f49b33"
          />
        }
      >
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => setProfileModalVisible(true)}>
            <View
              className={`w-14 h-14 rounded-full mr-3 items-center justify-center border-2 border-[#f49b33] ${theme.card}`}
            >
              <Text className="text-white text-xl font-bold">
                {teacherData?.name ? teacherData.name.charAt(0) : "T"}
              </Text>
            </View>
          </TouchableOpacity>

          <View className="flex-1">
            <Text className={`${theme.text} text-lg font-bold`}>
              {teacherData?.name || "Teacher"}
            </Text>
            <Text className={`${theme.subText} text-sm`}>
              {teacherData?.subjects
                ? teacherData.subjects.join(", ")
                : "Faculty"}
            </Text>
          </View>

          <TouchableOpacity onPress={handleLogoutPress}>
            <Ionicons name="log-out-outline" size={26} color="#f49b33" />
          </TouchableOpacity>
        </View>

        <Text className={`${theme.accent} text-2xl font-bold mb-5`}>
          Welcome Back!
        </Text>

        <View className="mb-6">
          <Text className={`${theme.accent} text-lg font-semibold mb-2`}>
            Payment Status
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/(teacher)/teachersalary")}
            className={`flex-row justify-between items-center ${theme.card} rounded-xl p-4 border border-1 border-[#f49b33]`}
          >
            <View>
              <Text className={theme.subText}>Pending Salary</Text>
              <Text className={`${theme.text} text-2xl font-bold mt-1`}>
                ₹{pendingSalary}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(teacher)/teachersalary")}
              className={`${theme.accentBg} rounded-lg px-4 py-2`}
            >
              <Text className="text-[#282C34] font-bold">View History</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <View className="mb-5">
          <Text className={`${theme.accent} text-lg font-semibold mb-2`}>
            Quick Access
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {quickAccess.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => item.route && router.push(item.route)}
                activeOpacity={0.8}
                className={`w-[48%] ${theme.card} rounded-xl p-5 items-center mb-4 border border-[#4C5361]`}
              >
                <Ionicons name={item.icon} size={32} color="#f49b33" />
                <Text
                  className={`${theme.text} mt-3 text-sm font-semibold text-center`}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-8">
          <Text className={`${theme.accent} text-lg font-semibold mb-2`}>
            Global Notices
          </Text>
          {notices.length === 0 ? (
            <Text className="text-gray-500 italic">No new notices.</Text>
          ) : (
            notices.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handlePress(item)}
                activeOpacity={0.8}
                className={`${theme.card} rounded-lg p-4 mb-3 border ${theme.borderColor}`}
              >
                <View className="flex-row justify-between items-start mb-1">
                  <Text
                    className={`${theme.text} text-base font-semibold flex-1 mr-2`}
                  >
                    {item.title}
                  </Text>
                  <Text className={`${theme.subText} text-xs`}>
                    {item.date}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherDashboard;