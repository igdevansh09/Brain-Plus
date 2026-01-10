import { useEffect, useState, useCallback } from "react";
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

// --- Modular Firebase Imports ---
import { signOut, onAuthStateChanged } from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
} from "@react-native-firebase/firestore";
import {
  ref,
  getDownloadURL,
  // uploadBytes, // REMOVED: Incompatible with RN local files
} from "@react-native-firebase/storage";

import { auth, db, storage } from "../../config/firebaseConfig";

import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";
import { useTheme } from "../../context/ThemeContext";

const AdminDashboard = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Stats State
  const [activeStudentCount, setActiveStudentCount] = useState(0);
  const [activeTeacherCount, setActiveTeacherCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Granular Pending States
  const [pendingStudentCount, setPendingStudentCount] = useState(0);
  const [pendingTeacherCount, setPendingTeacherCount] = useState(0);

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

  // --- 1. MEMOIZED FETCH FUNCTION ---
  const fetchUserData = useCallback(async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        setAdminData(userDoc.data());
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
      showToast("Error picking image", "error");
    }
  };

  // --- FIX: UPLOAD IMAGE (putFile) ---
  const uploadImage = async (uri) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setUploading(true);
    try {
      const filename = `profile_pictures/${uid}/avatar.jpg`;
      const storageRef = ref(storage, filename);

      // FIX: Use putFile instead of uploadBytes for React Native local URIs
      await storageRef.putFile(uri);

      const url = await getDownloadURL(storageRef);

      // Update Firestore
      await updateDoc(doc(db, "users", uid), {
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
    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchUserData(user.uid);
      } else {
        setLoading(false);
      }
    });

    // 1. Students Listener
    const qStudents = query(
      collection(db, "users"),
      where("role", "==", "student"),
      where("verified", "==", true)
    );
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      if (snapshot) setActiveStudentCount(snapshot.size);
    });

    // 2. Teachers Listener
    const qTeachers = query(
      collection(db, "users"),
      where("role", "==", "teacher"),
      where("verified", "==", true)
    );
    const unsubTeachers = onSnapshot(qTeachers, (snapshot) => {
      if (snapshot) setActiveTeacherCount(snapshot.size);
    });

    // 3. Pending Listener
    const qPending = query(
      collection(db, "users"),
      where("verified", "==", false)
    );
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      if (snapshot) {
        setPendingCount(snapshot.size);

        let sCount = 0;
        let tCount = 0;
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.role === "student") sCount++;
          if (data.role === "teacher") tCount++;
        });

        setPendingStudentCount(sCount);
        setPendingTeacherCount(tCount);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubStudents();
      unsubTeachers();
      unsubPending();
    };
  }, [fetchUserData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const user = auth.currentUser;
    if (user) await fetchUserData(user.uid);
    setRefreshing(false);
  }, [fetchUserData]);

  const handleConfirmLogout = async () => {
    setLogoutAlertVisible(false);
    try {
      await signOut(auth);
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
      name: "Leaves",
      icon: "calendar-outline",
      route: "/(admin)/all_leaves",
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
        style={{ backgroundColor: theme.bgPrimary }}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  const renderAvatar = (size = "small") => {
    const sizeStyle =
      size === "large" ? { width: 96, height: 96 } : { width: 48, height: 48 };
    const textSize = size === "large" ? "text-4xl" : "text-xl";

    if (adminData?.profileImage) {
      return (
        <Image
          source={{ uri: adminData.profileImage }}
          style={[
            sizeStyle,
            {
              borderColor: theme.accent,
              backgroundColor: theme.accent,
              borderWidth: 2,
              borderRadius: 999,
            },
          ]}
        />
      );
    }
    return (
      <View
        style={[
          sizeStyle,
          {
            backgroundColor: theme.accent,
            borderColor: theme.accent,
            borderWidth: 2,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Text
          style={{ color: theme.textDark }}
          className={`font-bold ${textSize}`}
        >
          {adminData?.name ? adminData.name.charAt(0).toUpperCase() : "A"}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ backgroundColor: theme.bgPrimary, flex: 1 }}>
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

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
        <View
          style={{ backgroundColor: theme.blackSoft80 || "rgba(0,0,0,0.8)" }}
          className="flex-1 justify-center items-center p-4"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="w-[85%] rounded-2xl p-6 border relative"
          >
            <TouchableOpacity
              onPress={() => setProfileModalVisible(false)}
              style={{ backgroundColor: theme.bgTertiary }}
              className="absolute top-4 right-4 z-10 p-1 rounded-full"
            >
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            <View className="items-center mb-6 mt-2">
              <TouchableOpacity
                onPress={handleUpdateAvatar}
                disabled={uploading}
                className="relative mb-3"
              >
                {renderAvatar("large")}
                <View
                  style={{
                    backgroundColor: theme.accent,
                    borderColor: theme.bgSecondary,
                  }}
                  className="absolute bottom-0 right-0 rounded-full p-2 border-2"
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={theme.textDark} />
                  ) : (
                    <Ionicons name="camera" size={18} color={theme.textDark} />
                  )}
                </View>
              </TouchableOpacity>

              <Text
                style={{ color: theme.textPrimary }}
                className="text-2xl font-bold"
              >
                {adminData?.name || "Administrator"}
              </Text>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-sm uppercase mt-1"
              >
                Tap photo to update
              </Text>
            </View>

            <View
              style={{
                backgroundColor: theme.bgPrimary,
                borderColor: theme.border,
              }}
              className="mb-6 p-4 rounded-xl border"
            >
              <View className="mb-3">
                <Text
                  style={{ color: theme.accent }}
                  className="text-xs uppercase font-bold mb-1"
                >
                  Email
                </Text>
                <Text
                  style={{ color: theme.textPrimary }}
                  className="text-base"
                >
                  {adminData?.email}
                </Text>
              </View>
              <View>
                <Text
                  style={{ color: theme.accent }}
                  className="text-xs uppercase font-bold mb-1"
                >
                  Password
                </Text>
                <Text
                  style={{ color: theme.textPrimary }}
                  className="text-base"
                >
                  AdminPassword123!
                </Text>
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
            tintColor={theme.accent}
            colors={[theme.accent]}
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
              <Text
                style={{ color: theme.textPrimary }}
                className="text-2xl font-bold"
              >
                {adminData?.name || "Admin"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setLogoutAlertVisible(true)}
            className="p-2"
          >
            <Ionicons name="log-out-outline" size={26} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {/* --- 2. HERO STATS --- */}
        <View className="flex-row gap-4 mb-8">
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            }}
            className="flex-1 p-5 rounded-2xl border items-center shadow-lg"
          >
            <View
              style={{ backgroundColor: theme.accentSoft10 }}
              className="p-3 rounded-full mb-3"
            >
              <Ionicons name="people" size={28} color={theme.accent} />
            </View>
            <Text
              style={{ color: theme.textPrimary }}
              className="text-3xl font-bold mb-1"
            >
              {activeStudentCount}
            </Text>
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs font-semibold uppercase tracking-wider"
            >
              Active Students
            </Text>
          </View>

          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            }}
            className="flex-1 p-5 rounded-2xl border items-center shadow-lg"
          >
            <View
              style={{ backgroundColor: theme.accentSoft10 }}
              className="p-3 rounded-full mb-3"
            >
              <Ionicons name="school" size={28} color={theme.accent} />
            </View>
            <Text
              style={{ color: theme.textPrimary }}
              className="text-3xl font-bold mb-1"
            >
              {activeTeacherCount}
            </Text>
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs font-semibold uppercase tracking-wider"
            >
              Active Teachers
            </Text>
          </View>
        </View>

        {/* --- 4. ACTION GRID --- */}
        <Text
          style={{ color: theme.accent }}
          className="text-lg font-bold mb-4 ml-1"
        >
          Administration
        </Text>

        <View className="flex-row flex-wrap justify-between">
          {adminActions.map((item) => {
            let badgeCount = 0;
            if (item.id === "1") badgeCount = pendingStudentCount;
            if (item.id === "2") badgeCount = pendingTeacherCount;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => item.route && router.push(item.route)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: theme.bgSecondary,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                }}
                className="w-[48%] rounded-2xl p-6 items-center mb-4 border shadow-sm relative"
              >
                <Ionicons name={item.icon} size={32} color={theme.accent} />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="mt-3 text-sm font-semibold text-center"
                >
                  {item.name}
                </Text>

                {badgeCount > 0 && (
                  <View
                    style={{
                      backgroundColor: theme.error,
                      borderColor: theme.bgSecondary,
                    }}
                    className="absolute top-3 right-3 rounded-full min-w-[22px] h-[22px] items-center justify-center border px-1"
                  >
                    <Text className="text-white text-[10px] font-bold">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminDashboard;
