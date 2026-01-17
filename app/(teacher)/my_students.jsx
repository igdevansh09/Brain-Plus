import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

import CustomToast from "../../components/CustomToast";

const TeacherMyStudents = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);

  // Data Lists
  const [allStudents, setAllStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);

  // Profile Data
  const [teachingProfile, setTeachingProfile] = useState([]); // [{class: "10th", subject: "Maths"}]
  const [uniqueClasses, setUniqueClasses] = useState(["All"]);
  const [availableSubjects, setAvailableSubjects] = useState(["All"]);

  // Filter States
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // UI State
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });

  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // --- 1. INITIAL FETCH (MODULAR) ---
  useEffect(() => {
    const init = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        // A. Fetch Teacher Profile (Modular)
        const teacherDocRef = doc(db, "users", uid);
        const teacherDoc = await getDoc(teacherDocRef);
        if (!teacherDoc.exists()) return;

        const data = teacherDoc.data();
        const profile = data.teachingProfile || [];

        let classesToFetch = [];

        if (profile.length > 0) {
          setTeachingProfile(profile);
          const classes = ["All", ...new Set(profile.map((p) => p.class))];
          setUniqueClasses(classes);
          classesToFetch = classes.filter((c) => c !== "All");
        } else {
          // Legacy Fallback
          const classes = data.classesTaught || [];
          const subjects = data.subjects || [];
          setUniqueClasses(["All", ...classes]);
          setTeachingProfile(
            classes.flatMap((c) =>
              subjects.map((s) => ({ class: c, subject: s }))
            )
          );
          classesToFetch = classes;
        }

        // B. Fetch Students from these classes (Modular)
        if (classesToFetch.length > 0) {
          // Firestore 'in' limit is 10. Assuming < 10 classes for now.
          const q = query(
            collection(db, "users"),
            where("role", "==", "student"),
            where("standard", "in", classesToFetch)
          );

          const studentSnap = await getDocs(q);

          const list = studentSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          // Sort by Class then Name
          list.sort(
            (a, b) =>
              a.standard.localeCompare(b.standard) ||
              a.name.localeCompare(b.name)
          );

          setAllStudents(list);
          setFilteredStudents(list);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.log("Init Error:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // --- 2. FILTER LOGIC ---
  useEffect(() => {
    let result = allStudents;

    // A. Class Filter
    if (selectedClass !== "All") {
      result = result.filter((s) => s.standard === selectedClass);

      // Update Subjects for this class
      const relSubjects = teachingProfile
        .filter((p) => p.class === selectedClass)
        .map((p) => p.subject);
      setAvailableSubjects(["All", ...new Set(relSubjects)]);
    } else {
      setAvailableSubjects(["All"]);
    }

    // B. Subject Filter
    if (selectedSubject !== "All") {
      // Check if student has this subject (if enrolledSubjects exists)
      // Otherwise, assume they take it if they are in the class
      result = result.filter((s) =>
        s.enrolledSubjects ? s.enrolledSubjects.includes(selectedSubject) : true
      );
    }

    // C. Search
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(lower) ||
          s.rollNo?.toLowerCase().includes(lower) ||
          s.phone?.includes(lower)
      );
    }

    setFilteredStudents(result);
  }, [selectedClass, selectedSubject, searchQuery, allStudents]);

  // --- HANDLERS ---
  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
    else showToast("No phone number available", "error");
  };

  const openProfile = (student) => {
    setSelectedStudent(student);
    setDetailModalVisible(true);
  };

  // --- RENDER CARD ---
  const renderStudent = ({ item }) => (
    <View
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }}
      className="p-3 rounded-2xl mb-3 flex-row items-center border shadow-sm"
    >
      {/* 1. Avatar (Tap to View) */}
      <TouchableOpacity onPress={() => openProfile(item)} className="mr-3">
        {item.profileImage ? (
          <Image
            source={{ uri: item.profileImage }}
            style={{ borderColor: theme.accent }}
            className="w-14 h-14 rounded-full border-2"
          />
        ) : (
          <View
            style={{
              backgroundColor: theme.accentSoft20,
              borderColor: theme.accentSoft50,
            }}
            className="w-14 h-14 rounded-full items-center justify-center border"
          >
            <Text style={{ color: theme.accent }} className="font-bold text-xl">
              {item.name?.charAt(0)}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 2. Info (Tap to View) */}
      <TouchableOpacity className="flex-1" onPress={() => openProfile(item)}>
        <Text
          style={{ color: theme.textPrimary }}
          className="font-bold text-lg"
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </TouchableOpacity>

      {/* 3. Call Action */}
      <TouchableOpacity
        onPress={() => handleCall(item.phone)}
        style={{
          backgroundColor: theme.infoSoft,
          borderColor: theme.infoSoft,
        }}
        className="p-3 rounded-xl border"
      >
        <Ionicons name="call" size={20} color={theme.info} />
      </TouchableOpacity>
    </View>
  );

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

      {/* --- HEADER --- */}
      <View className="px-5 py-4 pt-3 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="p-2 rounded-full border"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-xl font-bold"
        >
          My Students
        </Text>
        <View className="w-10" />
      </View>

      {/* --- SEARCH --- */}
      <View className="px-5 mb-4">
        <View
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="flex-row items-center rounded-xl px-4 border"
        >
          <Ionicons name="search" size={20} color={theme.textMuted} />
          <TextInput
            placeholder="Search Name..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: theme.textPrimary }}
            className="flex-1 p-3 font-medium h-12"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- FILTERS --- */}
      <View className="mb-2">
        {/* Classes */}
        <View className="mb-3 px-5">
          <Text
            style={{ color: theme.textMuted }}
            className="text-[10px] font-bold uppercase mb-2 tracking-widest"
          >
            Filter by Class
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {uniqueClasses.map((cls) => (
              <TouchableOpacity
                key={cls}
                onPress={() => {
                  setSelectedClass(cls);
                  if (cls === "All") setSelectedSubject("All");
                }}
                style={{
                  backgroundColor:
                    selectedClass === cls ? theme.accent : theme.bgSecondary,
                  borderColor:
                    selectedClass === cls ? theme.accent : theme.border,
                }}
                className="mr-2 px-4 py-2 rounded-xl border"
              >
                <Text
                  style={{
                    color:
                      selectedClass === cls
                        ? theme.textDark
                        : theme.textPrimary,
                  }}
                  className="font-bold text-xs"
                >
                  {cls}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Subjects (Only show if Class selected) */}
        {selectedClass !== "All" && availableSubjects.length > 1 && (
          <View className="mb-2 px-5">
            <Text
              style={{ color: theme.textMuted }}
              className="text-[10px] font-bold uppercase mb-2 tracking-widest"
            >
              Filter by Subject
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableSubjects.map((subj) => (
                <TouchableOpacity
                  key={subj}
                  onPress={() => setSelectedSubject(subj)}
                  style={{
                    backgroundColor:
                      selectedSubject === subj ? theme.info : theme.bgSecondary,
                    borderColor:
                      selectedSubject === subj ? theme.info : theme.border,
                  }}
                  className="mr-2 px-4 py-2 rounded-xl border"
                >
                  <Text
                    style={{
                      color:
                        selectedSubject === subj
                          ? theme.white
                          : theme.textPrimary,
                    }}
                    className="font-bold text-xs"
                  >
                    {subj}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
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
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudent}
          contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
          ListEmptyComponent={
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="account-search"
                size={60}
                color={theme.textMuted}
              />
              <Text style={{ color: theme.textMuted }} className="mt-4">
                No students found.
              </Text>
            </View>
          }
        />
      )}

      {/* --- ID CARD MODAL --- */}
      <Modal
        visible={detailModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center items-center p-5"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
              shadowColor: theme.shadow,
            }}
            className="w-full rounded-3xl p-0 border overflow-hidden shadow-2xl"
          >
            {/* Header Pattern */}
            <View
              style={{ backgroundColor: theme.accentSoft20 }}
              className="h-24 w-full relative justify-center items-center"
            >
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={{ backgroundColor: theme.blackSoft20 }}
                className="absolute top-4 right-4 p-1 rounded-full"
              >
                <Ionicons name="close" size={24} color={theme.textDark} />
              </TouchableOpacity>
            </View>

            {/* Avatar Overlap */}
            <View className="items-center -mt-12">
              <View
                style={{
                  borderColor: theme.bgSecondary,
                  backgroundColor: theme.bgPrimary,
                }}
                className="w-24 h-24 rounded-full border-4 items-center justify-center overflow-hidden"
              >
                {selectedStudent?.profileImage ? (
                  <Image
                    source={{ uri: selectedStudent.profileImage }}
                    className="w-full h-full"
                  />
                ) : (
                  <Text
                    style={{ color: theme.accent }}
                    className="font-bold text-4xl"
                  >
                    {selectedStudent?.name?.charAt(0)}
                  </Text>
                )}
              </View>
            </View>

            {/* Info Content */}
            <View className="p-6 items-center">
              <Text
                style={{ color: theme.textPrimary }}
                className="text-2xl font-bold text-center"
              >
                {selectedStudent?.name}
              </Text>
              <Text
                style={{ color: theme.accent }}
                className="font-bold text-sm mt-1"
              >
                Class {selectedStudent?.standard}{" "}
                {selectedStudent?.stream !== "N/A"
                  ? `• ${selectedStudent?.stream}`
                  : ""}
              </Text>

              <View
                style={{ backgroundColor: theme.border }}
                className="w-full h-[1px] my-4"
              />

              <View className="w-full">
                {/* Contact */}
                <View className="flex-row items-center mb-3">
                  <View
                    style={{
                      backgroundColor: theme.bgPrimary,
                      borderColor: theme.border,
                    }}
                    className="p-2 rounded-lg border mr-3"
                  >
                    <Ionicons name="call" size={18} color={theme.accent} />
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ color: theme.textSecondary }}
                      className="text-xs"
                    >
                      Phone Number
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleCall(selectedStudent?.phone)}
                    >
                      <Text
                        style={{ color: theme.infoBright }}
                        className="font-bold text-base underline"
                      >
                        {selectedStudent?.phone || "N/A"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subjects */}
                <View className="flex-row items-start">
                  <View
                    style={{
                      backgroundColor: theme.bgPrimary,
                      borderColor: theme.border,
                    }}
                    className="p-2 rounded-lg border mr-3 mt-1"
                  >
                    <Ionicons name="book" size={18} color={theme.accent} />
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ color: theme.textSecondary }}
                      className="text-xs mb-1"
                    >
                      Enrolled Subjects
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {selectedStudent?.enrolledSubjects?.map((sub, i) => (
                        <View
                          key={i}
                          style={{ backgroundColor: theme.bgTertiary }}
                          className="px-2 py-1 rounded"
                        >
                          <Text
                            style={{ color: theme.textPrimary }}
                            className="text-xs"
                          >
                            {sub}
                          </Text>
                        </View>
                      )) || (
                        <Text
                          style={{ color: theme.textMuted }}
                          className="italic"
                        >
                          None listed
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TeacherMyStudents;
 
