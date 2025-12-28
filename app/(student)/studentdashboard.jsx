import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CustomAlert from "../../components/CustomAlert";
import CustomAlert2 from "../../components/CustomAlert2";
import { auth, db } from "../../config/firebaseConfig";

const StudentDashboard = () => {
  const router = useRouter();
  const [studentData, setStudentData] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [totalDue, setTotalDue] = useState(0);
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
        let currentStandard = "";
        if (userDoc.exists()) {
          const data = userDoc.data();
          setStudentData(data);
          currentStandard = data.standard;
        }

        const globalQ = query(collection(db, "notices"));
        const globalSnap = await getDocs(globalQ);
        const globalList = globalSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          tag: "Global",
          author: doc.data().author || "Raja",
        }));

        let classList = [];
        if (currentStandard) {
          const classQ = query(
            collection(db, "class_notices"),
            where("classId", "==", currentStandard)
          );
          const classSnap = await getDocs(classQ);
          classList = classSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            tag: "Class",
            author: doc.data().teacherName || "Teacher",
          }));
        }

        const combined = [...globalList, ...classList];
        combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotices(combined);

        const feesQ = query(
          collection(db, "fees"),
          where("studentId", "==", user.uid)
        );
        const feesSnap = await getDocs(feesQ);
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

  const confirmLogout = async () => {
    setLogoutAlertVisible(false);
    try {
      await signOut(auth);
      router.replace("/");
    } catch (e) {
      Alert.alert("Error", e.message);
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
    {
      id: "3",
      name: "My Courses",
      icon: "library-outline",
      route: "/courses",
    },
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
              {studentData?.name}
            </Text>

            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase mb-1">
                Contact Info
              </Text>
              <Text className="text-white text-base mb-1">
                <Ionicons name="mail" size={15} color={"#eab308"} />
                {"  "} {studentData?.email}
              </Text>
              <Text className="text-white text-base">
                <Ionicons name="call" size={15} color={"#eab308"} />
                {"  "} {studentData?.phone || "N/A"}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase mb-1">
                Academic Info
              </Text>
              <Text className="text-white text-base">
                Class:{" "}
                <Text className="font-bold">{studentData?.standard}</Text>
              </Text>
              {studentData?.stream !== "N/A" && (
                <Text className="text-white text-base">
                  Stream: {studentData?.stream}
                </Text>
              )}
              <Text className="text-white text-sm mt-1 text-gray-300">
                Subjects: {studentData?.enrolledSubjects?.join(", ")}
              </Text>
            </View>

            <View className="mb-6">
              <Text className="text-gray-400 text-xs uppercase mb-1">
                Financial Info
              </Text>
              <Text className="text-[#4CAF50] text-xl font-bold">
                Monthly Fee: ₹{studentData?.monthlyFeeAmount || "5000"}
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
                {studentData?.name ? studentData.name.charAt(0) : "S"}
              </Text>
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
                    <View className="flex-1 mr-2">
                      <Text className={`${theme.text} text-base font-semibold`}>
                        {item.title || "Notice"}
                      </Text>
                      <View className="flex-row mt-1 flex-wrap">
                        <Text
                          className="text-xs font-bold mr-2"
                          style={{ color: isGlobal ? "#4CAF50" : "#29B6F6" }}
                        >
                          {isGlobal ? "Global Notice" : "Class Notice"}
                        </Text>
                        <Text className="text-xs text-gray-400 mr-2">
                          By: {item.author} Sir
                        </Text>
                      </View>

                      {!isGlobal && (
                        <Text className="text-xs text-[#f49b33] font-bold mt-1">
                          {targetText}
                        </Text>
                      )}
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