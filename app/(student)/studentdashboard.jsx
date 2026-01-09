import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  Image,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import BannerCarousel from "../../components/BannerCarousel";

// --- NATIVE SDK IMPORTS ---
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import * as ImagePicker from "expo-image-picker";

// --- CUSTOM COMPONENTS ---
import CustomAlert from "../../components/CustomAlert";
import CustomAlert2 from "../../components/CustomAlert2";
import CustomToast from "../../components/CustomToast";
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

const { height } = Dimensions.get("window");

const StudentDashboard = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get dynamic theme values
  const [studentData, setStudentData] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [totalDue, setTotalDue] = useState(0);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // Alert & Toast States
  const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });

  const [readOnlyVisible, setReadOnlyVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState({
    title: "",
    message: "",
  });

  // Helper to show toast
  const showToast = (msg, type = "success") => {
    setToast({ visible: true, msg, type });
  };

  // Animation Refs
  const pan = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: Animated.event([null, { dy: pan }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (e, gestureState) => {
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

  // --- DATA FETCHING ---
  const fetchData = async () => {
    try {
      const user = auth().currentUser;
      if (user) {
        // 1. Fetch User Data
        const userDoc = await firestore()
          .collection("users")
          .doc(user.uid)
          .get();
        let currentStandard = "";

        if (userDoc.exists) {
          const data = userDoc.data();
          setStudentData(data);
          currentStandard = data.standard;
        }

        // 2. Fetch Notices
        const globalSnap = await firestore().collection("notices").get();
        const globalList = globalSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          tag: "Global",
          author: doc.data().author || "Admin",
        }));

        let classList = [];
        if (currentStandard) {
          const classSnap = await firestore()
            .collection("class_notices")
            .where("classId", "==", currentStandard)
            .get();

          classList = classSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            tag: "Class",
            author: doc.data().teacherName || "Teacher",
          }));
        }

        let combined = [...globalList, ...classList];

        // Enrich ALL notices with author images
        if (combined.length > 0) {
          const enriched = await Promise.all(
            combined.map(async (item) => {
              try {
                // Check if it's an admin notice (tag === 'Global' and no teacherId)
                if (item.tag === "Global" && !item.teacherId) {
                  const adminSnap = await firestore()
                    .collection("users")
                    .where("role", "==", "admin")
                    .limit(1)
                    .get();

                  if (!adminSnap.empty) {
                    const adminData = adminSnap.docs[0].data();
                    return {
                      ...item,
                      author: adminData.name || "Admin",
                      authorImage: adminData.profileImage || null,
                    };
                  }
                  return { ...item, authorImage: null };
                }

                // For teacher notices, fetch teacher data
                const authorId = item.teacherId || item.authorId || null;
                if (authorId) {
                  const userDoc = await firestore()
                    .collection("users")
                    .doc(authorId)
                    .get();
                  if (userDoc.exists) {
                    const u = userDoc.data();
                    return {
                      ...item,
                      author: u.name || item.author,
                      authorImage: u.profileImage || null,
                    };
                  }
                }
              } catch (e) {
                console.log("Failed to fetch author image", e);
              }
              return { ...item, authorImage: null };
            })
          );

          combined = enriched;
        }

        combined.sort((a, b) => {
          const dateA = a.createdAt?.toDate
            ? a.createdAt.toDate()
            : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setNotices(combined);

        // 3. Fetch Fees
        const feesSnap = await firestore()
          .collection("fees")
          .where("studentId", "==", user.uid)
          .get();

        const pending = feesSnap.docs.filter(
          (d) => d.data().status === "Pending"
        );
        const total = pending.reduce(
          (sum, fee) => sum + Number(fee.data().amount),
          0
        );
        setTotalDue(total);
      }
    } catch (error) {
      console.log("Error:", error);
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchData();
      setLoading(false);
    };
    load();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  // --- AVATAR UPDATE ---
  const handleUpdateAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setUploading(true);
        const { uri } = result.assets[0];
        const user = auth().currentUser;

        const ref = storage().ref(`profile_pictures/${user.uid}/avatar.jpg`);
        await ref.putFile(uri);
        const url = await ref.getDownloadURL();

        await firestore().collection("users").doc(user.uid).update({
          profileImage: url,
        });

        setStudentData((prev) => ({ ...prev, profileImage: url }));
        setUploading(false);
        showToast("Profile picture updated!", "success");
      }
    } catch (error) {
      console.error(error);
      setUploading(false);
      showToast("Failed to update profile picture.", "error");
    }
  };

  const confirmLogout = async () => {
    setLogoutAlertVisible(false);
    try {
      await auth().signOut();
      showToast("Signed out", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const handlePress = (item) => {
    const content = item.content || item.message || "No details provided.";
    setSelectedContent({
      title: item.title || "Notice",
      message: content,
    });
    setReadOnlyVisible(true);
  };

  const quickAccess = [
    {
      id: "1",
      name: "Attendance",
      icon: "calendar",
      route: "/attendancescreen",
    },
    { id: "2", name: "Homework", icon: "book", route: "/homeworkscreen" },
    { id: "3", name: "My Courses", icon: "library-outline", route: "/courses" },
    { id: "4", name: "Test Scores", icon: "bar-chart", route: "/testscores" },
    {
      id: "5",
      name: "Submit Leave",
      icon: "document-text",
      route: "/submitleaves",
    },
    { id: "6", name: "Class Notes", icon: "pencil", route: "/classnotes" },
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
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
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

      {/* Profile Modal */}
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
                  {studentData?.profileImage ? (
                    <Image
                      source={{ uri: studentData.profileImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      style={{ color: theme.accent }}
                      className="font-bold text-5xl"
                    >
                      {studentData?.name
                        ? studentData.name.charAt(0).toUpperCase()
                        : "S"}
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
                  ● Active Student
                </Text>
              </View>
            </View>

            <ScrollView className="flex-1 px-6">
              <View className="mb-6">
                <Text
                  style={{ color: theme.textPrimary }}
                  className="text-3xl font-bold"
                >
                  {studentData?.name || "Student Name"}
                </Text>
                <Text style={{ color: theme.accent }} className="text-sm mt-1">
                  {studentData?.phone || "No phone linked"}
                </Text>
              </View>

              <View className="flex-row justify-between mb-8">
                <View
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                  }}
                  className="p-4 rounded-2xl flex-1 mr-3 border items-center"
                >
                  <Text
                    style={{ color: theme.textMuted }}
                    className="text-xs font-bold uppercase mb-1"
                  >
                    Standard
                  </Text>
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="text-xl font-bold"
                  >
                    {studentData?.standard || "N/A"}
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
                    style={{ color: theme.textMuted }}
                    className="text-xs font-bold uppercase mb-1"
                  >
                    Stream
                  </Text>
                  <Text
                    style={{ color: theme.accent }}
                    className="text-xl font-bold"
                  >
                    {studentData?.stream || "N/A"}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  color: theme.textSecondary,
                  borderColor: theme.border,
                }}
                className="font-bold text-lg mb-4 border-b pb-2"
              >
                Enrolled Subjects
              </Text>

              <View className="mb-10">
                {studentData?.enrolledSubjects &&
                studentData.enrolledSubjects.length > 0 ? (
                  studentData.enrolledSubjects.map((subject, index) => (
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
                        <Ionicons name="book" size={22} color={theme.accent} />
                      </View>
                      <View>
                        <Text
                          style={{ color: theme.textPrimary }}
                          className="font-bold text-lg"
                        >
                          {subject}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View className="items-center py-6">
                    <Text style={{ color: theme.textMuted }} className="italic">
                      No subjects enrolled yet.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Dashboard Content */}
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
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => setProfileModalVisible(true)}>
            <View
              style={{
                borderColor: theme.accent,
                backgroundColor: theme.bgSecondary,
              }}
              className="w-14 h-14 rounded-full mr-3 items-center justify-center border-2 overflow-hidden"
            >
              {studentData?.profileImage ? (
                <Image
                  source={{ uri: studentData.profileImage }}
                  className="w-full h-full"
                />
              ) : (
                <Text
                  style={{ color: theme.textPrimary }}
                  className="text-lg font-bold"
                >
                  {studentData?.name ? studentData.name.charAt(0) : "S"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <View className="flex-1">
            <Text
              style={{ color: theme.textPrimary }}
              className="text-2xl font-bold"
            >
              {studentData?.name || "Student"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setLogoutAlertVisible(true)}>
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

        {/* Fee Card */}
        <View className="mb-5">
          <Text
            style={{ color: theme.accent }}
            className="text-lg font-semibold mb-2"
          >
            Total Pending Fee
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/studentfees")}
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="flex-row justify-between items-center rounded-xl p-4 border"
          >
            <View>
              <Text style={{ color: theme.textSecondary }}>Due Amount</Text>
              <Text
                style={{ color: theme.textPrimary }}
                className="text-2xl font-bold mt-1"
              >
                ₹{totalDue}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/studentfees")}
              style={{ backgroundColor: theme.accent }}
              className="rounded-lg px-4 py-2"
            >
              <Text style={{ color: theme.textDark }} className="font-bold">
                Fee History
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Quick Access */}
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
                onPress={() => router.push(item.route)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: theme.bgSecondary,
                  shadowColor: theme.shadow,
                }}
                className="w-[30%] rounded-xl py-5 items-center mb-3 shadow-sm"
              >
                <Ionicons name={item.icon} size={26} color={theme.accent} />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="mt-2 text-xs text-center"
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notices */}
        <View className="mb-8">
          <Text
            style={{ color: theme.accent }}
            className="text-lg font-semibold mb-2"
          >
            Coaching/Class Updates
          </Text>
          {notices.length === 0 ? (
            <Text style={{ color: theme.textMuted }} className="italic">
              No new notices.
            </Text>
          ) : (
            notices.map((item) => {
              const isGlobal = item.tag === "Global";
              const targetText = isGlobal
                ? "All"
                : `${item.classId} • ${item.subject || "General"}`;

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handlePress(item)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                  }}
                  className="rounded-lg p-4 mb-3 border"
                >
                  <View className="flex-row justify-between items-start mb-1">
                    <View className="flex-row items-start flex-1 mr-2">
                      <View
                        style={{
                          backgroundColor: theme.blackSoft60,
                          borderColor: theme.accentSoft30,
                        }}
                        className="w-10 h-10 rounded-full overflow-hidden mr-3 items-center justify-center border"
                      >
                        {item.authorImage ? (
                          <Image
                            source={{ uri: item.authorImage }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <Text
                            style={{ color: theme.textDark }}
                            className="font-bold"
                          >
                            {item.author
                              ? item.author.charAt(0).toUpperCase()
                              : "A"}
                          </Text>
                        )}
                      </View>

                      <View className="flex-1">
                        <Text
                          style={{ color: theme.textPrimary }}
                          className="text-base font-semibold"
                        >
                          {item.title || "Notice"}
                        </Text>
                        <View className="flex-row mt-1 flex-wrap items-center">
                          <Text
                            className="text-xs font-bold mr-2"
                            style={{
                              color: isGlobal
                                ? theme.successBright
                                : theme.infoBright,
                            }}
                          >
                            {isGlobal ? "Global Notice" : "Class Notice"}
                          </Text>
                          <Text
                            style={{ color: theme.textMuted }}
                            className="text-xs mr-2"
                          >
                            By: {item.author}
                          </Text>
                        </View>

                        {!isGlobal && (
                          <Text
                            style={{ color: theme.accent }}
                            className="text-xs font-bold mt-1"
                          >
                            {targetText}
                          </Text>
                        )}
                      </View>
                    </View>

                    <Text
                      style={{ color: theme.textSecondary }}
                      className="text-xs"
                    >
                      {item.date}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default StudentDashboard;
