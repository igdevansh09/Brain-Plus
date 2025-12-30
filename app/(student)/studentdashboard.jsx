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

const { height } = Dimensions.get("window");

const StudentDashboard = () => {
  const router = useRouter();
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

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    accentBg: "bg-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    borderColor: "border-[#4C5361]",
  };

  // --- DATA FETCHING (FIXED) ---
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

        // *** FIX: Enrich ALL notices with author images ***
        if (combined.length > 0) {
          const enriched = await Promise.all(
            combined.map(async (item) => {
              try {
                // Check if it's an admin notice (tag === 'Global' and no teacherId)
                if (item.tag === "Global" && !item.teacherId) {
                  // Fetch admin data - get first admin user
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
      router.replace("/");
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
      name: "Apply Leave",
      icon: "document-text",
      route: "/applyleaves",
    },
    { id: "6", name: "Class Notes", icon: "pencil", route: "/classnotes" },
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

      {/* Profile Modal - Keep existing implementation */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        {/* Keep your existing profile modal code */}
        <View className="flex-1 justify-end bg-black/60">
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
            }}
            className="bg-[#282C34] w-full h-[85%] rounded-t-3xl overflow-hidden shadow-2xl relative"
          >
            <View
              {...panResponder.panHandlers}
              className="h-32 bg-[#f49b33]/20 w-full relative"
            >
              <View className="absolute top-3 left-0 right-0 items-center z-30">
                <View className="w-12 h-1.5 bg-white/30 rounded-full" />
              </View>
              <View className="absolute top-0 left-0 w-full h-full bg-black/20" />
            </View>

            <View className="px-6 -mt-16 mb-4 flex-row justify-between items-end">
              <TouchableOpacity
                onPress={handleUpdateAvatar}
                disabled={uploading}
                className="relative"
              >
                <View className="w-32 h-32 rounded-full border-4 border-[#282C34] bg-[#333842] items-center justify-center overflow-hidden">
                  {studentData?.profileImage ? (
                    <Image
                      source={{ uri: studentData.profileImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-[#f49b33] font-bold text-5xl">
                      {studentData?.name
                        ? studentData.name.charAt(0).toUpperCase()
                        : "S"}
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
                  ● Active Student
                </Text>
              </View>
            </View>

            <ScrollView className="flex-1 px-6">
              <View className="mb-6">
                <Text className="text-white text-3xl font-bold">
                  {studentData?.name || "Student Name"}
                </Text>
                <Text className="text-[#f49b33] text-sm mt-1">
                  {studentData?.phone || "No phone linked"}
                </Text>
              </View>

              <View className="flex-row justify-between mb-8">
                <View className="bg-[#333842] p-4 rounded-2xl flex-1 mr-3 border border-[#4C5361] items-center">
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1">
                    Standard
                  </Text>
                  <Text className="text-white text-xl font-bold">
                    {studentData?.standard || "N/A"}
                  </Text>
                </View>
                <View className="bg-[#333842] p-4 rounded-2xl flex-1 ml-3 border border-[#4C5361] items-center">
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1">
                    Stream
                  </Text>
                  <Text className="text-[#f49b33] text-xl font-bold">
                    {studentData?.stream || "N/A"}
                  </Text>
                </View>
              </View>

              <Text className="text-gray-300 font-bold text-lg mb-4 border-b border-[#4C5361] pb-2">
                Enrolled Subjects
              </Text>

              <View className="mb-10">
                {studentData?.enrolledSubjects &&
                studentData.enrolledSubjects.length > 0 ? (
                  studentData.enrolledSubjects.map((subject, index) => (
                    <View
                      key={index}
                      className="flex-row items-center bg-[#333842] p-4 rounded-xl mb-3 border border-[#4C5361]"
                    >
                      <View className="bg-[#f49b33]/20 w-12 h-12 rounded-full items-center justify-center mr-4 border border-[#f49b33]/30">
                        <Ionicons name="book" size={22} color="#f49b33" />
                      </View>
                      <View>
                        <Text className="text-white font-bold text-lg">
                          {subject}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View className="items-center py-6">
                    <Text className="text-gray-500 italic">
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
            tintColor="#f49b33"
          />
        }
      >
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => setProfileModalVisible(true)}>
            <View
              className={`w-14 h-14 rounded-full mr-3 items-center justify-center border-2 border-[#f49b33] ${theme.card} overflow-hidden`}
            >
              {studentData?.profileImage ? (
                <Image
                  source={{ uri: studentData.profileImage }}
                  className="w-full h-full"
                />
              ) : (
                <Text className="text-white text-xl font-bold">
                  {studentData?.name ? studentData.name.charAt(0) : "S"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <View className="flex-1">
            <Text className={`${theme.text} text-lg font-bold`}>
              {studentData?.name || "Student"}
            </Text>
            <Text className={`${theme.subText} text-sm`}>
              {studentData?.standard
                ? `${studentData.standard} - ${studentData.stream || ""}`
                : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setLogoutAlertVisible(true)}>
            <Ionicons name="log-out-outline" size={26} color="#f49b33" />
          </TouchableOpacity>
        </View>

        <Text className={`${theme.accent} text-2xl font-bold mb-5`}>
          Welcome Back!
        </Text>

        <BannerCarousel />

        {/* Fee Card */}
        <View className="mb-5">
          <Text className={`${theme.accent} text-lg font-semibold mb-2`}>
            Total Pending Fee
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/studentfees")}
            className={`flex-row justify-between items-center ${theme.card} rounded-xl p-4 border border-1 border-[#f49b33]`}
          >
            <View>
              <Text className={theme.subText}>Due Amount</Text>
              <Text className={`${theme.text} text-2xl font-bold mt-1`}>
                ₹{totalDue}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/studentfees")}
              className={`${theme.accentBg} rounded-lg px-4 py-2`}
            >
              <Text className="text-[#282C34] font-bold">Fee History</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Quick Access */}
        <View className="mb-5">
          <Text className={`${theme.accent} text-lg font-semibold mb-2`}>
            Quick Access
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {quickAccess.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route)}
                activeOpacity={0.8}
                className={`w-[30%] ${theme.card} rounded-xl py-5 items-center mb-3`}
              >
                <Ionicons name={item.icon} size={26} color="#f49b33" />
                <Text className={`${theme.text} mt-2 text-xs text-center`}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notices */}
        <View className="mb-8">
          <Text className={`${theme.accent} text-lg font-semibold mb-2`}>
            Coaching/Class Updates
          </Text>
          {notices.length === 0 ? (
            <Text className="text-gray-500 italic">No new notices.</Text>
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
                  className={`${theme.card} rounded-lg p-4 mb-3 border border-[#4C5361]`}
                >
                  <View className="flex-row justify-between items-start mb-1">
                    <View className="flex-row items-start flex-1 mr-2">
                      <View className="w-10 h-10 rounded-full overflow-hidden mr-3 items-center justify-center bg-[#444]">
                        {item.authorImage ? (
                          <Image
                            source={{ uri: item.authorImage }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <Text className="text-white font-bold">
                            {item.author
                              ? item.author.charAt(0).toUpperCase()
                              : "A"}
                          </Text>
                        )}
                      </View>

                      <View className="flex-1">
                        <Text
                          className={`${theme.text} text-base font-semibold`}
                        >
                          {item.title || "Notice"}
                        </Text>
                        <View className="flex-row mt-1 flex-wrap items-center">
                          <Text
                            className="text-xs font-bold mr-2"
                            style={{ color: isGlobal ? "#4CAF50" : "#29B6F6" }}
                          >
                            {isGlobal ? "Global Notice" : "Class Notice"}
                          </Text>
                          <Text className="text-xs text-gray-400 mr-2">
                            By: {item.author}
                          </Text>
                        </View>

                        {!isGlobal && (
                          <Text className="text-xs text-[#f49b33] font-bold mt-1">
                            {targetText}
                          </Text>
                        )}
                      </View>
                    </View>

                    <Text className={`${theme.subText} text-xs`}>
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
