import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  Dimensions,
  PanResponder,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import BannerCarousel from "../../components/BannerCarousel";

// Native SDKs
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

import CustomAlert from "../../components/CustomAlert";
import CustomAlert2 from "../../components/CustomAlert2";
import CustomToast from "../../components/CustomToast";

const { width, height } = Dimensions.get("window");

const TeacherDashboard = () => {
  const router = useRouter();

  // Data State
  const [teacherData, setTeacherData] = useState(null);
  const [notices, setNotices] = useState([]);
  const [pendingSalary, setPendingSalary] = useState(0);

  // UI State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
  const [readOnlyVisible, setReadOnlyVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState({
    title: "",
    message: "",
  });
  const [uploading, setUploading] = useState(false);

  // Toast State
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // --- GESTURE ANIMATION STATE ---
  const pan = useRef(new Animated.Value(0)).current;

  // PanResponder to handle the slide-down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only trigger if dragging down
        return gestureState.dy > 5;
      },
      onPanResponderMove: Animated.event([null, { dy: pan }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down more than 150px, close the modal
        if (gestureState.dy > 150) {
          setProfileModalVisible(false);
        } else {
          // Otherwise snap back to top
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 10,
          }).start();
        }
      },
    })
  ).current;

  // Reset position when modal opens
  useEffect(() => {
    if (profileModalVisible) {
      pan.setValue(0);
    }
  }, [profileModalVisible]);

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    accentBg: "bg-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    borderColor: "border-[#4C5361]",
  };

  const getClassIcon = (className) => {
    const lower = className ? className.toLowerCase() : "";
    if (lower.includes("cs") || lower.includes("comp")) return "laptop-outline";
    if (lower.includes("prep")) return "shapes-outline";
    if (lower.includes("11") || lower.includes("12")) return "school-outline";
    if (lower.includes("10") || lower.includes("9")) return "library-outline";
    return "book-outline";
  };

  const fetchData = async (uid) => {
    try {
      const userDoc = await firestore().collection("users").doc(uid).get();
      if (userDoc.exists) {
        setTeacherData(userDoc.data());
      }

      const salarySnap = await firestore()
        .collection("salaries")
        .where("teacherId", "==", uid)
        .where("status", "==", "Pending")
        .get();

      let total = 0;
      salarySnap.forEach((doc) => {
        total += parseInt(doc.data().amount || 0);
      });
      setPendingSalary(total);

      const noticesSnap = await firestore()
        .collection("notices")
        .orderBy("createdAt", "desc")
        .get();

      const noticesList = noticesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotices(noticesList);
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Try to fetch on mount if there's a currently signed-in user.
    const current = auth().currentUser;
    if (current) fetchData(current.uid);

    // Keep a listener to refresh data when auth state changes,
    // but avoid performing navigation here — the root layout handles redirects.
    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (user) {
        fetchData(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const user = auth().currentUser;
    if (user) await fetchData(user.uid);
    setRefreshing(false);
  }, []);

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

      setTeacherData((prev) => ({ ...prev, profileImage: url }));
      showToast("Profile picture updated!", "success");
    } catch (error) {
      console.error(error);
      showToast("Upload failed. Check permissions.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleLogoutPress = () => setLogoutAlertVisible(true);

  const confirmLogout = async () => {
    setLogoutAlertVisible(false);
    try {
      await auth().signOut();
      router.replace("/");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const getDisplaySubjects = () => {
    if (!teacherData?.teachingProfile) {
      return teacherData?.subjects?.join(", ") || "Faculty";
    }
    const subjects = [
      ...new Set(teacherData.teachingProfile.map((p) => p.subject)),
    ];
    return subjects.join(", ");
  };

  const getTotalClasses = () => {
    if (teacherData?.teachingProfile) return teacherData.teachingProfile.length;
    if (teacherData?.classesTaught) return teacherData.classesTaught.length;
    return 0;
  };

  const quickAccess = [
    {
      id: "1",
      name: "Attendance",
      icon: "checkmark-circle-outline",
      route: "/(teacher)/attendancescreen",
    },
    {
      id: "2",
      name: "Homework",
      icon: "book-outline",
      route: "/(teacher)/homeworkscreen",
    },
    {
      id: "3",
      name: "Notify Students",
      icon: "megaphone-outline",
      route: "/(teacher)/notifystudents",
    },
    {
      id: "4",
      name: "Submit Scores",
      icon: "ribbon-outline",
      route: "/(teacher)/testscores",
    },
    {
      id: "5",
      name: "Student Leaves",
      icon: "eye-outline",
      route: "/(teacher)/applyleaves",
    },
    {
      id: "6",
      name: "Upload Notes",
      icon: "document-attach-outline",
      route: "/(teacher)/classnotes",
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
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

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

      {/* --- PREMIUM PROFILE BOTTOM SHEET --- */}
      <Modal
        visible={profileModalVisible}
        animationType="slide" // Fade background, slide content manually
        transparent={true}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          {/* Tap outside to close */}
          <TouchableOpacity
            className="flex-1"
            onPress={() => setProfileModalVisible(false)}
          />

          {/* ANIMATED BOTTOM SHEET */}
          <Animated.View
            style={{
              transform: [
                {
                  translateY: pan.interpolate({
                    inputRange: [0, height],
                    outputRange: [0, height],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
            className="bg-[#282C34] w-full h-[85%] rounded-t-3xl overflow-hidden shadow-2xl relative"
          >
            {/* 1. Header Banner & Drag Handle */}
            <View
              {...panResponder.panHandlers}
              className="h-32 bg-[#f49b33]/20 w-full relative"
            >
              {/* Drag Pill */}
              <View className="absolute top-3 left-0 right-0 items-center z-30">
                <View className="w-12 h-1.5 bg-white/30 rounded-full" />
              </View>

              <View className="absolute top-0 left-0 w-full h-full bg-black/20" />
            </View>

            {/* 2. Profile Avatar */}
            <View className="px-6 -mt-16 mb-4 flex-row justify-between items-end">
              <TouchableOpacity
                onPress={handleUpdateAvatar}
                disabled={uploading}
                className="relative"
              >
                <View className="w-32 h-32 rounded-full border-4 border-[#282C34] bg-[#333842] items-center justify-center overflow-hidden">
                  {teacherData?.profileImage ? (
                    <Image
                      source={{ uri: teacherData.profileImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-[#f49b33] font-bold text-5xl">
                      {teacherData?.name
                        ? teacherData.name.charAt(0).toUpperCase()
                        : "T"}
                    </Text>
                  )}
                </View>
                <View className="absolute bottom-1 right-1 bg-[#f49b33] p-2 rounded-full border-2 border-[#282C34]">
                  {uploading ? (
                    <ActivityIndicator size="small" color="#282C34" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#282C34" />
                  )}
                </View>
              </TouchableOpacity>

              <View className="bg-green-500/20 px-4 py-2 rounded-full border border-green-500/30 mb-4">
                <Text className="text-green-400 font-bold text-xs uppercase tracking-wide">
                  ● Active Faculty
                </Text>
              </View>
            </View>

            {/* 3. Main Info */}
            <ScrollView className="flex-1 px-6">
              <View className="mb-6">
                <Text className="text-white text-3xl font-bold">
                  {teacherData?.name}
                </Text>
                <Text className="text-[#f49b33] text-sm mt-1">
                  {teacherData?.phone || "No phone linked"}
                </Text>
              </View>

              {/* 4. Stats Grid */}
              <View className="flex-row justify-between mb-8">
                <View className="bg-[#333842] p-4 rounded-2xl flex-1 mr-3 border border-[#4C5361] items-center">
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1">
                    Assigned
                  </Text>
                  <Text className="text-white text-xl font-bold">
                    {getTotalClasses()} Classes
                  </Text>
                </View>
                <View className="bg-[#333842] p-4 rounded-2xl flex-1 ml-3 border border-[#4C5361] items-center">
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1">
                    Salary Type
                  </Text>
                  <Text className="text-[#f49b33] text-xl font-bold">
                    {teacherData?.salaryType === "Commission"
                      ? "Commission"
                      : "Fixed"}
                  </Text>
                </View>
              </View>

              {/* 5. Teaching Profile List */}
              <Text className="text-gray-300 font-bold text-lg mb-4 border-b border-[#4C5361] pb-2">
                Teaching Schedule
              </Text>

              <View className="mb-10">
                {teacherData?.teachingProfile
                  ? teacherData.teachingProfile.map((item, index) => (
                      <View
                        key={index}
                        className="flex-row items-center bg-[#333842] p-4 rounded-xl mb-3 border border-[#4C5361]"
                      >
                        <View className="bg-[#f49b33]/20 w-12 h-12 rounded-full items-center justify-center mr-4 border border-[#f49b33]/30">
                          <Ionicons
                            name={getClassIcon(item.class)}
                            size={22}
                            color="#f49b33"
                          />
                        </View>
                        <View>
                          <Text className="text-white font-bold text-lg">
                            {item.class}
                          </Text>
                          <Text className="text-gray-400 text-sm">
                            {item.subject}
                          </Text>
                        </View>
                      </View>
                    ))
                  : teacherData?.classesTaught?.map((cls, index) => (
                      <View
                        key={index}
                        className="flex-row items-center bg-[#333842] p-4 rounded-xl mb-3 border border-[#4C5361]"
                      >
                        <View className="bg-[#f49b33]/20 w-12 h-12 rounded-full items-center justify-center mr-4 border border-[#f49b33]/30">
                          <Ionicons
                            name={getClassIcon(cls)}
                            size={22}
                            color="#f49b33"
                          />
                        </View>
                        <View>
                          <Text className="text-white font-bold text-lg">
                            {cls}
                          </Text>
                          <Text className="text-gray-400 text-sm">
                            General Subject
                          </Text>
                        </View>
                      </View>
                    ))}
                {!teacherData?.teachingProfile &&
                  !teacherData?.classesTaught && (
                    <View className="items-center py-6">
                      <Text className="text-gray-500 italic">
                        No active classes assigned.
                      </Text>
                    </View>
                  )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* --- DASHBOARD CONTENT --- */}
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
        {/* HEADER */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => setProfileModalVisible(true)}>
            <View
              className={`w-14 h-14 rounded-full mr-3 items-center justify-center border-2 border-[#f49b33] overflow-hidden ${theme.card}`}
            >
              {teacherData?.profileImage ? (
                <Image
                  source={{ uri: teacherData.profileImage }}
                  className="w-full h-full"
                />
              ) : (
                <Text className="text-white text-xl font-bold">
                  {teacherData?.name ? teacherData.name.charAt(0) : "T"}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <View className="flex-1">
            <Text className={`${theme.text} text-2xl font-bold`}>
              {teacherData?.name || "Teacher"}
            </Text>
          </View>

          <TouchableOpacity onPress={handleLogoutPress}>
            <Ionicons name="log-out-outline" size={26} color="#f49b33" />
          </TouchableOpacity>
        </View>

        <Text className={`${theme.accent} text-2xl font-bold mb-5`}>
          Welcome Back!
        </Text>

        <BannerCarousel />

        {/* PAYMENT CARD */}
        <View className="mb-6">
          <Text className={`${theme.accent} text-lg font-semibold mb-2`}>
            Payment Status
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/(teacher)/teachersalary")}
            className={`flex-row justify-between items-center ${theme.card} rounded-xl p-4 border border-1 border-[#f49b33] shadow-sm`}
          >
            <View>
              <Text className={theme.subText}>Pending Payout</Text>
              <Text className={`${theme.text} text-2xl font-bold mt-1`}>
                ₹{pendingSalary}
              </Text>
            </View>
            <View className={`${theme.accentBg} rounded-lg px-4 py-2`}>
              <Text className="text-[#282C34] font-bold">View History</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* QUICK ACCESS GRID */}
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
                className={`w-[48%] ${theme.card} rounded-xl p-5 items-center mb-4 border border-[#4C5361] shadow-sm`}
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

        {/* NOTICES */}
        <View className="mb-8">
          <Text className={`${theme.accent} text-lg font-semibold mb-2`}>
            Global Notices
          </Text>
          {notices.length === 0 ? (
            <View className="p-6 items-center opacity-50">
              <Ionicons
                name="notifications-off-outline"
                size={30}
                color="gray"
              />
              <Text className="text-gray-500 italic mt-2">No new notices.</Text>
            </View>
          ) : (
            notices.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  setSelectedContent({
                    title: item.title,
                    message: item.content,
                  });
                  setReadOnlyVisible(true);
                }}
                activeOpacity={0.8}
                className={`${theme.card} rounded-xl p-4 mb-3 border ${theme.borderColor}`}
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-2">
                    <Text
                      className={`${theme.text} text-base font-semibold mb-1`}
                    >
                      {item.title}
                    </Text>
                    <Text className={`${theme.subText} text-xs`}>
                      {item.date}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#4C5361" />
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
