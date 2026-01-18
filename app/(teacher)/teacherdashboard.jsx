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
import { useTheme } from "../../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import { signOut, onAuthStateChanged } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
} from "@react-native-firebase/firestore";
import {
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";
import { auth, db, storage } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

import CustomAlert from "../../components/CustomAlert";
import CustomAlert2 from "../../components/CustomAlert2";
import CustomToast from "../../components/CustomToast";

const { width, height } = Dimensions.get("window");

const TeacherDashboard = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();

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
        return gestureState.dy > 5;
      },
      onPanResponderMove: Animated.event([null, { dy: pan }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          setProfileModalVisible(false);
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 10,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (profileModalVisible) {
      pan.setValue(0);
    }
  }, [profileModalVisible]);

  const getClassIcon = (className) => {
    const lower = className ? className.toLowerCase() : "";
    if (lower.includes("cs") || lower.includes("comp")) return "laptop-outline";
    if (lower.includes("prep")) return "shapes-outline";
    if (lower.includes("11") || lower.includes("12")) return "school-outline";
    if (lower.includes("10") || lower.includes("9")) return "library-outline";
    return "book-outline";
  };

  // --- DATA FETCHING (MODULAR) ---
  const fetchData = async (uid) => {
    try {
      // 1. Fetch Teacher Data
      const teacherDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(teacherDocRef);
      if (userDoc.exists()) {
        setTeacherData(userDoc.data());
      }

      // 2. Fetch Pending Salary
      const qSalary = query(
        collection(db, "salaries"),
        where("teacherId", "==", uid),
        where("status", "==", "Pending")
      );
      const salarySnap = await getDocs(qSalary);

      let total = 0;
      salarySnap.forEach((doc) => {
        total += parseInt(doc.data().amount || 0);
      });
      setPendingSalary(total);

      // 3. Fetch Notices
      const qNotices = query(
        collection(db, "notices"),
        orderBy("createdAt", "desc")
      );
      const noticesSnap = await getDocs(qNotices);

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
    // Modular: auth.currentUser
    const current = auth.currentUser;
    if (current) fetchData(current.uid);

    // Modular: onAuthStateChanged
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchData(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const user = auth.currentUser;
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
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setUploading(true);
    try {
      // Modular Storage
      const filename = `profile_pictures/${uid}/avatar.jpg`;
      const storageRef = ref(storage, filename);

      // FIX: Use putFile instead of uploadBytes for React Native local URIs
      await storageRef.putFile(uri);
      const url = await getDownloadURL(storageRef);

      // Modular Firestore Update
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
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
      // Modular SignOut
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
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
      route: "/(teacher)/student_leaves",
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
        style={{ backgroundColor: theme.bgPrimary }}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bgPrimary}
      />

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
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View
          style={{ backgroundColor: theme.blackSoft60 }}
          className="flex-1 justify-end"
        >
          <TouchableOpacity
            className="flex-1"
            onPress={() => setProfileModalVisible(false)}
          />

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
              backgroundColor: theme.bgPrimary,
            }}
            className="w-full h-[85%] rounded-t-3xl overflow-hidden shadow-2xl relative"
          >
            {/* 1. Header Banner & Drag Handle */}
            <View
              {...panResponder.panHandlers}
              style={{ backgroundColor: theme.accentSoft20 }}
              className="h-32 w-full relative"
            >
              <View className="absolute top-3 left-0 right-0 items-center z-30">
                <View
                  style={{ backgroundColor: theme.white }}
                  className="w-12 h-1.5 opacity-30 rounded-full"
                />
              </View>
            </View>

            {/* 2. Profile Avatar */}
            <View className="px-6 -mt-16 mb-4 flex-row justify-between items-end">
              <TouchableOpacity
                onPress={handleUpdateAvatar}
                disabled={uploading}
                className="relative"
              >
                <View
                  style={{
                    borderColor: theme.bgPrimary,
                    backgroundColor: theme.bgSecondary,
                  }}
                  className="w-32 h-32 rounded-full border-4 items-center justify-center overflow-hidden"
                >
                  {teacherData?.profileImage ? (
                    <Image
                      source={{ uri: teacherData.profileImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      style={{ color: theme.accent }}
                      className="font-bold text-5xl"
                    >
                      {teacherData?.name
                        ? teacherData.name.charAt(0).toUpperCase()
                        : "T"}
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    backgroundColor: theme.accent,
                    borderColor: theme.bgPrimary,
                  }}
                  className="absolute bottom-1 right-1 p-2 rounded-full border-2"
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={theme.textDark} />
                  ) : (
                    <Ionicons name="camera" size={16} color={theme.textDark} />
                  )}
                </View>
              </TouchableOpacity>

              <View
                style={{
                  backgroundColor: theme.successSoft,
                  borderColor: theme.success,
                }}
                className="px-4 py-2 rounded-full border mb-4"
              >
                <Text
                  style={{ color: theme.successBright }}
                  className="font-bold text-xs uppercase tracking-wide"
                >
                  ● Active Faculty
                </Text>
              </View>
            </View>

            {/* 3. Main Info */}
            <ScrollView className="flex-1 px-6">
              <View className="mb-6">
                <Text
                  style={{ color: theme.textPrimary }}
                  className="text-3xl font-bold"
                >
                  {teacherData?.name}
                </Text>
                <Text style={{ color: theme.accent }} className="text-sm mt-1">
                  {teacherData?.phone || "No phone linked"}
                </Text>
              </View>

              {/* 4. Stats Grid */}
              <View className="flex-row justify-between mb-8">
                <View
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                  }}
                  className="p-4 rounded-2xl flex-1 mr-3 border items-center"
                >
                  <Text
                    style={{ color: theme.textSecondary }}
                    className="text-xs font-bold uppercase mb-1"
                  >
                    Assigned
                  </Text>
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="text-xl font-bold"
                  >
                    {getTotalClasses()} Classes
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                  }}
                  className="p-4 rounded-2xl flex-1 ml-3 border items-center"
                >
                  <Text
                    style={{ color: theme.textSecondary }}
                    className="text-xs font-bold uppercase mb-1"
                  >
                    Salary Type
                  </Text>
                  <Text
                    style={{ color: theme.accent }}
                    className="text-xl font-bold"
                  >
                    {teacherData?.salaryType === "Commission"
                      ? "Commission"
                      : "Fixed"}
                  </Text>
                </View>
              </View>

              {/* 5. Teaching Profile List */}
              <Text
                style={{
                  color: theme.textSecondary,
                  borderColor: theme.border,
                }}
                className="font-bold text-lg mb-4 border-b pb-2"
              >
                Teaching Schedule
              </Text>

              <View className="mb-10">
                {teacherData?.teachingProfile
                  ? teacherData.teachingProfile.map((item, index) => (
                      <View
                        key={index}
                        style={{
                          backgroundColor: theme.bgSecondary,
                          borderColor: theme.border,
                        }}
                        className="flex-row items-center p-4 rounded-xl mb-3 border"
                      >
                        <View
                          style={{
                            backgroundColor: theme.accentSoft20,
                            borderColor: theme.accentSoft30,
                          }}
                          className="w-12 h-12 rounded-full items-center justify-center mr-4 border"
                        >
                          <Ionicons
                            name={getClassIcon(item.class)}
                            size={22}
                            color={theme.accent}
                          />
                        </View>
                        <View>
                          <Text
                            style={{ color: theme.textPrimary }}
                            className="font-bold text-lg"
                          >
                            {item.class}
                          </Text>
                          <Text
                            style={{ color: theme.textSecondary }}
                            className="text-sm"
                          >
                            {item.subject}
                          </Text>
                        </View>
                      </View>
                    ))
                  : teacherData?.classesTaught?.map((cls, index) => (
                      <View
                        key={index}
                        style={{
                          backgroundColor: theme.bgSecondary,
                          borderColor: theme.border,
                        }}
                        className="flex-row items-center p-4 rounded-xl mb-3 border"
                      >
                        <View
                          style={{
                            backgroundColor: theme.accentSoft20,
                            borderColor: theme.accentSoft30,
                          }}
                          className="w-12 h-12 rounded-full items-center justify-center mr-4 border"
                        >
                          <Ionicons
                            name={getClassIcon(cls)}
                            size={22}
                            color={theme.accent}
                          />
                        </View>
                        <View>
                          <Text
                            style={{ color: theme.textPrimary }}
                            className="font-bold text-lg"
                          >
                            {cls}
                          </Text>
                          <Text
                            style={{ color: theme.textSecondary }}
                            className="text-sm"
                          >
                            General Subject
                          </Text>
                        </View>
                      </View>
                    ))}
                {!teacherData?.teachingProfile &&
                  !teacherData?.classesTaught && (
                    <View className="items-center py-6">
                      <Text
                        style={{ color: theme.textMuted }}
                        className="italic"
                      >
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
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {/* HEADER */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => setProfileModalVisible(true)}>
            <View
              style={{
                borderColor: theme.accent,
                backgroundColor: theme.bgSecondary,
              }}
              className="w-14 h-14 rounded-full mr-3 items-center justify-center border-2 overflow-hidden"
            >
              {teacherData?.profileImage ? (
                <Image
                  source={{ uri: teacherData.profileImage }}
                  className="w-full h-full"
                />
              ) : (
                <Text
                  style={{ color: theme.textPrimary }}
                  className="text-xl font-bold"
                >
                  {teacherData?.name ? teacherData.name.charAt(0) : "T"}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <View className="flex-1">
            <Text
              style={{ color: theme.textPrimary }}
              className="text-2xl font-bold"
            >
              {teacherData?.name || "Teacher"}
            </Text>
          </View>

          <TouchableOpacity onPress={handleLogoutPress}>
            <Ionicons name="log-out-outline" size={26} color={theme.accent} />
          </TouchableOpacity>
        </View>

        <Text
          style={{ color: theme.accent }}
          className="text-2xl font-bold mb-5"
        >
          Welcome Back!
        </Text>

        <BannerCarousel />

        {/* PAYMENT CARD */}
        <View className="mb-6">
          <Text
            style={{ color: theme.accent }}
            className="text-lg font-semibold mb-2"
          >
            Payment Status
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/(teacher)/teachersalary")}
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="flex-row justify-between items-center rounded-xl p-4 border shadow-sm"
          >
            <View>
              <Text style={{ color: theme.textSecondary }}>Pending Payout</Text>
              <Text
                style={{ color: theme.textPrimary }}
                className="text-2xl font-bold mt-1"
              >
                ₹{pendingSalary}
              </Text>
            </View>
            <View
              style={{ backgroundColor: theme.accent }}
              className="rounded-lg px-4 py-2"
            >
              <Text style={{ color: theme.textDark }} className="font-bold">
                View History
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* QUICK ACCESS GRID */}
        <View className="mb-5">
          <Text
            style={{ color: theme.accent }}
            className="text-lg font-semibold mb-2"
          >
            Quick Access
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {quickAccess.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => item.route && router.push(item.route)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: theme.bgSecondary,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                }}
                className="w-[48%] rounded-xl p-5 items-center mb-4 border shadow-sm"
              >
                <Ionicons name={item.icon} size={32} color={theme.accent} />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="mt-3 text-sm font-semibold text-center"
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* NOTICES */}
        <View className="mb-8">
          <Text
            style={{ color: theme.accent }}
            className="text-lg font-semibold mb-2"
          >
            Global Notices
          </Text>
          {notices.length === 0 ? (
            <View className="p-6 items-center opacity-50">
              <Ionicons
                name="notifications-off-outline"
                size={30}
                color={theme.textMuted}
              />
              <Text style={{ color: theme.textMuted }} className="italic mt-2">
                No new notices.
              </Text>
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
                style={{
                  backgroundColor: theme.bgSecondary,
                  borderColor: theme.border,
                }}
                className="rounded-xl p-4 mb-3 border"
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-2">
                    <Text
                      style={{ color: theme.textPrimary }}
                      className="text-base font-semibold mb-1"
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{ color: theme.textSecondary }}
                      className="text-xs"
                    >
                      {item.date}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.textMuted}
                  />
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
 
