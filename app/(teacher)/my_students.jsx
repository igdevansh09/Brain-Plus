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

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";

const TeacherMyStudents = () => {
  const router = useRouter();
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

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    borderColor: "border-[#4C5361]",
  };

  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    const init = async () => {
      try {
        const uid = auth().currentUser?.uid;
        if (!uid) return;

        // A. Fetch Teacher Profile
        const teacherDoc = await firestore().collection("users").doc(uid).get();
        if (!teacherDoc.exists) return;

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

        // B. Fetch Students from these classes
        if (classesToFetch.length > 0) {
          // Firestore 'in' limit is 10. Assuming < 10 classes for now.
          const studentSnap = await firestore()
            .collection("users")
            .where("role", "==", "student")
            .where("standard", "in", classesToFetch)
            .get();

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
      className={`${theme.card} p-3 rounded-2xl mb-3 flex-row items-center border ${theme.borderColor} shadow-sm`}
    >
      {/* 1. Avatar (Tap to View) */}
      <TouchableOpacity onPress={() => openProfile(item)} className="mr-3">
        {item.profileImage ? (
          <Image
            source={{ uri: item.profileImage }}
            className="w-14 h-14 rounded-full border-2 border-[#f49b33]"
          />
        ) : (
          <View className="w-14 h-14 rounded-full bg-[#f49b33]/20 items-center justify-center border border-[#f49b33]/50">
            <Text className="text-[#f49b33] font-bold text-xl">
              {item.name?.charAt(0)}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 2. Info (Tap to View) */}
      <TouchableOpacity className="flex-1" onPress={() => openProfile(item)}>
        <Text className="text-white font-bold text-lg" numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>

      {/* 3. Call Action */}
      <TouchableOpacity
        onPress={() => handleCall(item.phone)}
        className="bg-blue-600/20 p-3 rounded-xl border border-blue-600/50"
      >
        <Ionicons name="call" size={20} color="#3b82f6" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* --- HEADER --- */}
      <View className="px-5 py-4 pt-10 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">My Students</Text>
        <View className="w-10" />
      </View>

      {/* --- SEARCH --- */}
      <View className="px-5 mb-4">
        <View className="bg-[#333842] flex-row items-center rounded-xl px-4 border border-[#4C5361]">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search Name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 p-3 text-white font-medium h-12"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- FILTERS --- */}
      <View className="mb-2">
        {/* Classes */}
        <View className="mb-3 px-5">
          <Text className="text-gray-400 text-[10px] font-bold uppercase mb-2 tracking-widest">
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
                className={`mr-2 px-4 py-2 rounded-xl border ${selectedClass === cls ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-[#4C5361]"}`}
              >
                <Text
                  className={`${selectedClass === cls ? "text-[#282C34]" : "text-white"} font-bold text-xs`}
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
            <Text className="text-gray-400 text-[10px] font-bold uppercase mb-2 tracking-widest">
              Filter by Subject
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableSubjects.map((subj) => (
                <TouchableOpacity
                  key={subj}
                  onPress={() => setSelectedSubject(subj)}
                  className={`mr-2 px-4 py-2 rounded-xl border ${selectedSubject === subj ? "bg-blue-600 border-blue-600" : "bg-[#333842] border-[#4C5361]"}`}
                >
                  <Text
                    className={`${selectedSubject === subj ? "text-white" : "text-white"} font-bold text-xs`}
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
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
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
                color="gray"
              />
              <Text className="text-gray-400 mt-4">No students found.</Text>
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
        <View className="flex-1 justify-center items-center bg-black/80 p-5">
          <View className="bg-[#333842] w-full rounded-3xl p-0 border border-[#f49b33] overflow-hidden shadow-2xl">
            {/* Header Pattern */}
            <View className="bg-[#f49b33]/20 h-24 w-full relative justify-center items-center">
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                className="absolute top-4 right-4 bg-[#282C34]/20 p-1 rounded-full"
              >
                <Ionicons name="close" size={24} color="#282C34" />
              </TouchableOpacity>
            </View>

            {/* Avatar Overlap */}
            <View className="items-center -mt-12">
              <View className="w-24 h-24 rounded-full border-4 border-[#333842] bg-[#282C34] items-center justify-center overflow-hidden">
                {selectedStudent?.profileImage ? (
                  <Image
                    source={{ uri: selectedStudent.profileImage }}
                    className="w-full h-full"
                  />
                ) : (
                  <Text className="text-[#f49b33] font-bold text-4xl">
                    {selectedStudent?.name?.charAt(0)}
                  </Text>
                )}
              </View>
            </View>

            {/* Info Content */}
            <View className="p-6 items-center">
              <Text className="text-white text-2xl font-bold text-center">
                {selectedStudent?.name}
              </Text>
              <Text className="text-[#f49b33] font-bold text-sm mt-1">
                Class {selectedStudent?.standard}{" "}
                {selectedStudent?.stream !== "N/A"
                  ? `• ${selectedStudent?.stream}`
                  : ""}
              </Text>

              <View className="w-full h-[1px] bg-[#4C5361] my-4" />

              <View className="w-full">
                {/* Contact */}
                <View className="flex-row items-center mb-3">
                  <View className="bg-[#282C34] p-2 rounded-lg border border-[#4C5361] mr-3">
                    <Ionicons name="call" size={18} color="#f49b33" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs">Phone Number</Text>
                    <TouchableOpacity
                      onPress={() => handleCall(selectedStudent?.phone)}
                    >
                      <Text className="text-blue-400 font-bold text-base underline">
                        {selectedStudent?.phone || "N/A"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subjects */}
                <View className="flex-row items-start">
                  <View className="bg-[#282C34] p-2 rounded-lg border border-[#4C5361] mr-3 mt-1">
                    <Ionicons name="book" size={18} color="#f49b33" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs mb-1">
                      Enrolled Subjects
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {selectedStudent?.enrolledSubjects?.map((sub, i) => (
                        <View
                          key={i}
                          className="bg-[#4C5361] px-2 py-1 rounded"
                        >
                          <Text className="text-white text-xs">{sub}</Text>
                        </View>
                      )) || (
                        <Text className="text-gray-500 italic">
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
