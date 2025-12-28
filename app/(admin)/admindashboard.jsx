import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

// Native SDKs
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";

// --- THEME ---
const theme = {
  bg: "bg-[#282C34]",
  card: "bg-[#333842]",
  accent: "text-[#f49b33]",
  accentBg: "bg-[#f49b33]",
  text: "text-white",
  subText: "text-gray-400",
  borderColor: "border-[#4C5361]",
};

const AdminDashboard = () => {
  const router = useRouter();
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Stats State
  const [activeStudentCount, setActiveStudentCount] = useState(0);
  const [activeTeacherCount, setActiveTeacherCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // UI States
  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchUserData = async (uid) => {
    try {
      const userDoc = await firestore().collection("users").doc(uid).get();
      if (userDoc.exists) {
        setAdminData(userDoc.data());
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    setUploading(true);
    try {
      const filename = `profile_pictures/${uid}/avatar.jpg`;
      const reference = storage().ref(filename);
      await reference.putFile(uri);
      const url = await reference.getDownloadURL();

      await firestore().collection("users").doc(uid).update({
        profileImage: url,
      });

      setAdminData((prev) => ({ ...prev, profileImage: url }));
      showToast("Profile picture updated!", "success");
    } catch (error) {
      console.error(error);
      showToast("Upload failed. Try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  // --- LISTENERS ---
  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged(async (user) => {
      if (user) {
        await fetchUserData(user.uid);
      } else {
        router.replace("/");
      }
    });

    // 1. Students Listener
    const unsubStudents = firestore()
      .collection("users")
      .where("role", "==", "student")
      .where("verified", "==", true)
      .onSnapshot((snapshot) => {
        if (snapshot) setActiveStudentCount(snapshot.size);
      });

    // 2. Teachers Listener
    const unsubTeachers = firestore()
      .collection("users")
      .where("role", "==", "teacher")
      .where("verified", "==", true)
      .onSnapshot((snapshot) => {
        if (snapshot) setActiveTeacherCount(snapshot.size);
      });

    // 3. Pending Listener
    const unsubPending = firestore()
      .collection("users")
      .where("verified", "==", false)
      .onSnapshot((snapshot) => {
        if (snapshot) setPendingCount(snapshot.size);
      });

    return () => {
      unsubscribeAuth();
      unsubStudents();
      unsubTeachers();
      unsubPending();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const user = auth().currentUser;
    if (user) await fetchUserData(user.uid);
    setRefreshing(false);
  }, []);

  const handleConfirmLogout = async () => {
    setLogoutAlertVisible(false);
    try {
      await auth().signOut();
      router.replace("/");
    } catch (error) {
      console.log("Logout Error", error.message);
    }
  };

  const adminActions = [
    {
      id: "1",
      name: "Manage Students",
      icon: "people-outline",
      route: "/(admin)/managestudents",
    },
    {
      id: "2",
      name: "Manage Teachers",
      icon: "briefcase-outline",
      route: "/(admin)/manageteachers",
    },
    {
      id: "3",
      name: "Student Fee",
      icon: "bar-chart-outline",
      route: "/(admin)/feereports",
    },
    {
      id: "4",
      name: "Teacher Fee",
      icon: "stats-chart-outline",
      route: "/(admin)/salaryreports",
    },
    {
      id: "5",
      name: "Global Notices",
      icon: "megaphone-outline",
      route: "/(admin)/globalnotices",
    },
    {
      id: "6",
      name: "Manage Courses",
      icon: "library-outline",
      route: "/(admin)/manage_content",
    },
    {
      id: "7",
      name: "Teacher Leaves",
      icon: "calendar-outline",
      route: "/(admin)/teacher_leaves",
    },
    {
      id: "8",
      name: "Notifications",
      icon: "notifications-outline",
      route: "/(admin)/view_notifications",
    },
  ];

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${theme.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );
  }

  const renderAvatar = (size = "small") => {
    const sizeClasses = size === "large" ? "w-24 h-24" : "w-12 h-12";
    const textClasses = size === "large" ? "text-4xl" : "text-xl";

    // Using a consistent border style for the avatar container
    const containerClasses = `${sizeClasses} rounded-full border-2 border-[#f49b33] overflow-hidden items-center justify-center bg-[#f49b33]`;

    if (adminData?.profileImage) {
      return (
        <Image
          source={{ uri: adminData.profileImage }}
          className={containerClasses}
          style={{
            width: size === "large" ? 96 : 48,
            height: size === "large" ? 96 : 48,
          }} // Force size for image
        />
      );
    }
    return (
      <View className={containerClasses}>
        <Text className={`text-[#282C34] font-bold ${textClasses}`}>
          {adminData?.name ? adminData.name.charAt(0).toUpperCase() : "A"}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      <CustomToast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <CustomAlert
        visible={logoutAlertVisible}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        onCancel={() => setLogoutAlertVisible(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* --- PROFILE MODAL --- */}
      <Modal
        visible={profileModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/80 p-4">
          <View
            className={`${theme.card} w-[85%] rounded-2xl p-6 border ${theme.borderColor} relative`}
          >
            <TouchableOpacity
              onPress={() => setProfileModalVisible(false)}
              className="absolute top-4 right-4 z-10 bg-[#282C34] p-1 rounded-full"
            >
              <Ionicons name="close" size={20} color="gray" />
            </TouchableOpacity>

            <View className="items-center mb-6 mt-2">
              <TouchableOpacity
                onPress={handleUpdateAvatar}
                disabled={uploading}
                className="relative mb-3"
              >
                {renderAvatar("large")}
                <View className="absolute bottom-0 right-0 bg-[#f49b33] rounded-full p-2 border-2 border-[#333842]">
                  {uploading ? (
                    <ActivityIndicator size="small" color="#282C34" />
                  ) : (
                    <Ionicons name="camera" size={18} color="#282C34" />
                  )}
                </View>
              </TouchableOpacity>

              <Text className={`${theme.text} text-2xl font-bold`}>
                {adminData?.name || "Administrator"}
              </Text>
              <Text className={`${theme.subText} text-sm uppercase mt-1`}>
                Tap photo to update
              </Text>
            </View>

            <View className="mb-6 bg-[#282C34] p-4 rounded-xl border border-[#4C5361]">
              <View className="mb-3">
                <Text
                  className={`${theme.accent} text-xs uppercase font-bold mb-1`}
                >
                  Email
                </Text>
                <Text className={`${theme.text} text-base`}>
                  {adminData?.email}
                </Text>
              </View>
              <View>
                <Text
                  className={`${theme.accent} text-xs uppercase font-bold mb-1`}
                >
                  Password
                </Text>
                <Text className={`${theme.text} text-base`}>AdminPassword123!</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        className="flex-1 px-5"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f49b33"
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* --- 1. HEADER --- */}
        <View className="flex-row items-center justify-between py-6">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => setProfileModalVisible(true)}>
              {renderAvatar("small")}
            </TouchableOpacity>
            <View className="ml-4">
              <Text className={`${theme.text} text-xl font-bold`}>
                {adminData?.name || "Admin"}
              </Text>
              <Text className={`${theme.subText} text-xs`}>Administrator</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setLogoutAlertVisible(true)}
            className="p-2"
          >
            <Ionicons name="log-out-outline" size={26} color="#f49b33" />
          </TouchableOpacity>
        </View>

        {/* --- 2. HERO STATS --- */}
        <View className="flex-row gap-4 mb-8">
          {/* Active Students Card */}
          <View
            className={`flex-1 ${theme.card} p-5 rounded-2xl border ${theme.borderColor} items-center shadow-lg`}
          >
            <View className="bg-[#f49b33]/10 p-3 rounded-full mb-3">
              <Ionicons name="people" size={28} color="#f49b33" />
            </View>
            <Text className="text-white text-3xl font-bold mb-1">
              {activeStudentCount}
            </Text>
            <Text
              className={`${theme.subText} text-xs font-semibold uppercase tracking-wider`}
            >
              Active Students
            </Text>
          </View>

          {/* Active Teachers Card */}
          <View
            className={`flex-1 ${theme.card} p-5 rounded-2xl border ${theme.borderColor} items-center shadow-lg`}
          >
            <View className="bg-[#f49b33]/10 p-3 rounded-full mb-3">
              <Ionicons name="school" size={28} color="#f49b33" />
            </View>
            <Text className="text-white text-3xl font-bold mb-1">
              {activeTeacherCount}
            </Text>
            <Text
              className={`${theme.subText} text-xs font-semibold uppercase tracking-wider`}
            >
              Active Teachers
            </Text>
          </View>
        </View>

        {/* --- 3. ALERT BANNER (Conditional) --- */}
        {pendingCount > 0 && (
          <TouchableOpacity
            onPress={() =>
              router.push("/(admin)/managestudents?filter=pending")
            } // Or a dedicated approval screen
            className="bg-orange-500/10 border border-orange-500/50 rounded-xl p-4 mb-8 flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1">
              <View className="bg-orange-500 rounded-full w-8 h-8 items-center justify-center mr-3">
                <Text className="text-white font-bold">{pendingCount}</Text>
              </View>
              <View>
                <Text className="text-white font-bold text-base">
                  Pending Approvals
                </Text>
                <Text className="text-orange-200/70 text-xs">
                  New registration requests
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#f97316" />
          </TouchableOpacity>
        )}

        {/* --- 4. ACTION GRID --- */}
        <Text className={`${theme.accent} text-lg font-bold mb-4 ml-1`}>
          Administration
        </Text>

        <View className="flex-row flex-wrap justify-between">
          {adminActions.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => item.route && router.push(item.route)}
              activeOpacity={0.7}
              className={`w-[48%] ${theme.card} rounded-2xl p-6 items-center mb-4 border ${theme.borderColor} shadow-sm`}
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

        {/* Bottom Padding */}
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminDashboard;
