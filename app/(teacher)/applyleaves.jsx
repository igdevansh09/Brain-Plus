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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";

// --- MODULAR IMPORTS ---
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import instances

// Helper: Calculate Days
const getDaysCount = (start, end) => {
  try {
    const d1 = new Date(start);
    const d2 = new Date(end);
    if (isNaN(d1) || isNaN(d2)) return 1;
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  } catch (e) {
    return 1;
  }
};

const StudentLeaveCard = ({ item }) => {
  const { theme } = useTheme();
  const [studentData, setStudentData] = useState(null);

  // Fetch Student Avatar & Details
  useEffect(() => {
    let isMounted = true;
    const fetchStudentProfile = async () => {
      try {
        if (item.studentId) {
          const userDocRef = doc(db, "users", item.studentId);
          const userDoc = await getDoc(userDocRef);

          if (isMounted && userDoc.exists()) {
            setStudentData(userDoc.data());
          }
        }
      } catch (error) {
        console.log("Error fetching student:", error);
      }
    };
    fetchStudentProfile();
    return () => {
      isMounted = false;
    };
  }, [item.studentId]);

  const handleCall = () => {
    const phone = studentData?.phone || item.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert("Unavailable", "No phone number found.");
  };

  const daysCount = getDaysCount(item.startDate, item.endDate);

  return (
    <View
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }}
      className="p-4 rounded-2xl mb-4 border shadow-sm"
    >
      {/* Header: Avatar, Info & Call */}
      <View className="flex-row items-center mb-4">
        <View className="mr-4">
          {studentData?.profileImage ? (
            <Image
              source={{ uri: studentData.profileImage }}
              style={{ borderColor: theme.accent }}
              className="w-14 h-14 rounded-full border"
            />
          ) : (
            <View
              style={{
                backgroundColor: theme.accentSoft20,
                borderColor: theme.accentSoft30,
              }}
              className="w-14 h-14 rounded-full items-center justify-center border"
            >
              <Text
                style={{ color: theme.accent }}
                className="font-bold text-xl"
              >
                {item.studentName?.charAt(0) || "S"}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-1">
          <Text
            style={{ color: theme.textPrimary }}
            className="font-bold text-lg leading-tight"
          >
            {item.studentName}
          </Text>
          <View className="flex-row items-center mt-1">
            <View
              style={{ backgroundColor: theme.accent }}
              className="px-2 py-0.5 rounded mr-2"
            >
              <Text
                style={{ color: theme.textDark }}
                className="text-[10px] font-bold"
              >
                {daysCount} {daysCount > 1 ? "Days" : "Day"} Leave
              </Text>
            </View>
            <Text style={{ color: theme.textSecondary }} className="text-xs">
              {studentData?.standard || "Student"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleCall}
          style={{
            backgroundColor: theme.bgTertiary,
            borderColor: theme.border,
          }}
          className="w-10 h-10 rounded-full items-center justify-center border"
        >
          <Ionicons name="call" size={18} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <View
        style={{
          backgroundColor: theme.bgTertiary,
          borderColor: theme.border,
        }}
        className="rounded-xl flex-row items-center justify-between p-3 mb-3 border"
      >
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name="calendar-arrow-right"
            size={20}
            color={theme.textMuted}
          />
          <Text
            style={{ color: theme.textSecondary }}
            className="font-bold ml-3 text-sm"
          >
            {item.startDate}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={theme.textMuted} />
        <Text
          style={{ color: theme.textSecondary }}
          className="font-bold text-sm"
        >
          {item.endDate}
        </Text>
      </View>

      <View
        style={{ borderLeftColor: theme.accentSoft50 }}
        className="pl-2 border-l-2"
      >
        <Text style={{ color: theme.textMuted }} className="text-sm italic">
          &quot;{item.reason || "No reason provided."}&quot;
        </Text>
      </View>
    </View>
  );
};

const TeacherStudentLeaves = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    const loadData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // 1. Get Teacher's Profile to find their classes
        const teacherDocRef = doc(db, "users", user.uid);
        const teacherDoc = await getDoc(teacherDocRef);

        if (!teacherDoc.exists()) {
          setLoading(false);
          return;
        }

        const teacherData = teacherDoc.data();
        let teacherClasses = [];

        // Support both old (classesTaught) and new (teachingProfile) structures
        if (teacherData.teachingProfile && teacherData.teachingProfile.length > 0) {
          teacherClasses = [
            ...new Set(teacherData.teachingProfile.map((p) => p.class)),
          ];
        } else if (teacherData.classesTaught && teacherData.classesTaught.length > 0) {
          teacherClasses = teacherData.classesTaught;
        }

        // If teacher has no classes assigned, stop here
        if (teacherClasses.length === 0) {
          setLeaves([]);
          setLoading(false);
          return;
        }

        // 2. Fetch all STUDENTS who belong to these classes
        // Note: 'in' query works for up to 10 classes.
        const studentsQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("standard", "in", teacherClasses)
        );
        
        const studentsSnap = await getDocs(studentsQuery);
        const validStudentIds = new Set(studentsSnap.docs.map((d) => d.id));

        // 3. Fetch leaves and filter LOCALLY by validStudentIds
        const leavesCollection = collection(db, "leaves");
        
        unsubscribe = onSnapshot(leavesCollection, (snapshot) => {
          const filteredList = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((leave) => validStudentIds.has(leave.studentId)); // Filtering happens here

          // Sort manually
          filteredList.sort((a, b) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return tB - tA;
          });

          setLeaves(filteredList);
          setLoading(false);
        });

      } catch (error) {
        console.error("Error loading leaves:", error);
        setLoading(false);
      }
    };

    loadData();

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* --- HEADER --- */}
      <View className="px-5 py-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="p-2 rounded-full border mr-4"
        >
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-2xl font-bold"
        >
          Student Leaves
        </Text>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.accent}
          className="mt-10"
        />
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <StudentLeaveCard item={item} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="calendar-check"
                size={80}
                color={theme.textMuted}
              />
              <Text
                style={{ color: theme.textMuted }}
                className="text-center mt-4"
              >
                No leave applications from your students.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default TeacherStudentLeaves; 
