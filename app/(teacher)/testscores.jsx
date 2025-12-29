import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image, // Added Image import
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";

const TeacherScoreSubmission = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [teachingProfile, setTeachingProfile] = useState([]);
  const [uniqueClasses, setUniqueClasses] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Selections
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // Exam Details
  const [examTitle, setExamTitle] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [examDate, setExamDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Students List
  const [students, setStudents] = useState([]);

  // UI Feedback
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    green: "#4CAF50",
    red: "#F44336",
    borderColor: "border-[#4C5361]",
  };

  // --- 1. FETCH PROFILE ---
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const uid = auth().currentUser?.uid;
        if (!uid) return;

        const teacherDoc = await firestore().collection("users").doc(uid).get();
        if (teacherDoc.exists) {
          const data = teacherDoc.data();
          const profile = data.teachingProfile || [];

          if (profile.length > 0) {
            setTeachingProfile(profile);
            const classes = [...new Set(profile.map((item) => item.class))];
            setUniqueClasses(classes);
            if (classes.length > 0) handleClassChange(classes[0], profile);
          } else {
            // Fallback
            const classes = data.classesTaught || [];
            const subjects = data.subjects || [];
            setUniqueClasses(classes);
            setTeachingProfile(
              classes.flatMap((c) =>
                subjects.map((s) => ({ class: c, subject: s }))
              )
            );
            if (classes.length > 0) {
              setSelectedClass(classes[0]);
              setAvailableSubjects(subjects);
              if (subjects.length > 0) setSelectedSubject(subjects[0]);
            }
          }
        }
      } catch (error) {
        console.log("Profile Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // --- 2. HANDLE CLASS CHANGE ---
  const handleClassChange = (cls, profileData = teachingProfile) => {
    setSelectedClass(cls);
    const relevant = profileData
      .filter((item) => item.class === cls)
      .map((item) => item.subject);

    setAvailableSubjects(relevant);
    if (relevant.length > 0) setSelectedSubject(relevant[0]);
    else setSelectedSubject(null);
  };

  // --- 3. FETCH STUDENTS ---
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    fetchStudents();
  }, [selectedClass, selectedSubject]);

  const fetchStudents = async () => {
    setFetchingStudents(true);
    try {
      const q = firestore()
        .collection("users")
        .where("role", "==", "student")
        .where("standard", "==", selectedClass);

      const snapshot = await q.get();
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Unknown",
        rollNo: doc.data().rollNo || "N/A",
        profileImage: doc.data().profileImage || null, // Fetch profile image
        score: "",
        ...doc.data(),
      }));

      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);
    } catch (error) {
      console.log("Fetch Error:", error);
      showToast("Failed to load students", "error");
    } finally {
      setFetchingStudents(false);
    }
  };

  // --- HANDLERS ---
  const handleScoreChange = (text, studentId) => {
    const newScore = text.replace(/[^0-9]/g, "");
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, score: newScore } : s))
    );
  };

  const getFormattedDate = (date) => {
    return date.toLocaleDateString("en-GB");
  };

  const onChangeDate = (event, selectedDate) => {
    const date = selectedDate || examDate;
    setShowDatePicker(Platform.OS === "ios");
    setExamDate(date);
  };

  const handlePublish = async () => {
    if (!examTitle.trim()) {
      showToast("Please enter an Exam Title", "error");
      return;
    }
    if (!maxScore.trim()) {
      showToast("Please enter Max Score", "error");
      return;
    }

    const maxVal = parseInt(maxScore);
    let hasError = false;
    let filledCount = 0;
    const resultsMap = {};

    students.forEach((s) => {
      if (s.score.trim() !== "") {
        const val = parseInt(s.score);
        if (val > maxVal) hasError = true;
        resultsMap[s.id] = val;
        filledCount++;
      }
    });

    if (hasError) {
      showToast("Some scores exceed the Max Score!", "error");
      return;
    }
    if (filledCount === 0) {
      showToast("Please enter at least one score.", "error");
      return;
    }

    setAlertConfig({
      visible: true,
      title: "Publish Scores?",
      message: `Exam: ${examTitle}\nMax Score: ${maxScore}\nStudents Graded: ${filledCount}/${students.length}`,
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        setSubmitting(true);
        try {
          await firestore()
            .collection("exam_results")
            .add({
              examTitle: examTitle.trim(),
              maxScore: maxVal,
              classId: selectedClass,
              subject: selectedSubject,
              teacherId: auth().currentUser.uid,
              date: getFormattedDate(examDate),
              createdAt: firestore.FieldValue.serverTimestamp(),
              results: resultsMap,
              studentCount: filledCount,
            });

          showToast("Results Published Successfully!", "success");
          setExamTitle("");
          setStudents((prev) => prev.map((s) => ({ ...s, score: "" })));
        } catch (e) {
          showToast("Publish failed. Try again.", "error");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  // --- RENDER STUDENT ROW (UPDATED WITH AVATAR) ---
  const renderStudentRow = ({ item }) => {
    const scoreVal = parseInt(item.score || "0");
    const maxVal = parseInt(maxScore || "100");
    const isOverLimit = item.score !== "" && scoreVal > maxVal;
    const isFilled = item.score !== "";

    return (
      <View
        className={`${theme.card} p-3 rounded-xl mb-3 flex-row justify-between items-center border ${isOverLimit ? "border-red-500" : isFilled ? "border-green-500/50" : theme.borderColor}`}
      >
        <View className="flex-row items-center flex-1">
          {/* AVATAR */}
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden border ${isFilled ? "border-[#f49b33]" : "border-[#4C5361]"} bg-[#282C34]`}
          >
            {item.profileImage ? (
              <Image
                source={{ uri: item.profileImage }}
                className="w-full h-full"
              />
            ) : (
              <Text
                className={`font-bold ${isFilled ? "text-[#f49b33]" : "text-gray-400"}`}
              >
                {item.name.charAt(0)}
              </Text>
            )}
          </View>

          <View>
            <Text className="text-white font-bold text-base">{item.name}</Text>
          </View>
        </View>

        <View className="relative">
          <TextInput
            placeholder="-"
            placeholderTextColor="#666"
            value={item.score}
            onChangeText={(text) => handleScoreChange(text, item.id)}
            keyboardType="numeric"
            maxLength={4}
            className={`w-16 h-12 rounded-lg text-center text-lg font-bold border ${isOverLimit ? "bg-red-500/10 border-red-500 text-red-500" : "bg-[#282C34] border-[#4C5361] text-white"}`}
          />
          {isOverLimit && (
            <View className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5">
              <Ionicons name="alert" size={12} color="white" />
            </View>
          )}
        </View>
      </View>
    );
  };

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
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText="Publish"
        cancelText="Cancel"
        onConfirm={alertConfig.onConfirm}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* --- HEADER --- */}
      <View className="px-5 pt-10 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Upload Scores</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5 pt-2"
          showsVerticalScrollIndicator={false}
        >
          {/* --- EXAM CONFIG CARD --- */}
          <View
            className={`${theme.card} p-4 rounded-2xl border ${theme.borderColor} mb-6`}
          >
            <Text className="text-gray-400 text-xs font-bold uppercase mb-3 tracking-widest">
              Exam Details
            </Text>

            <View className="flex-row gap-3 mb-3">
              <TextInput
                placeholder="Exam Name (e.g. Unit Test 1)"
                placeholderTextColor="#666"
                value={examTitle}
                onChangeText={setExamTitle}
                className="flex-1 bg-[#282C34] text-white p-3 rounded-xl border border-[#4C5361] font-bold"
              />
              <TextInput
                placeholder="Max"
                placeholderTextColor="#666"
                value={maxScore}
                onChangeText={(text) =>
                  setMaxScore(text.replace(/[^0-9]/g, ""))
                }
                keyboardType="numeric"
                maxLength={3}
                className="w-20 bg-[#282C34] text-[#f49b33] p-3 rounded-xl border border-[#4C5361] font-bold text-center"
              />
            </View>

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center bg-[#282C34] p-3 rounded-xl border border-[#4C5361]"
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color="#f49b33"
                className="mr-2"
              />
              <Text className="text-white font-semibold">
                {getFormattedDate(examDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={examDate}
              mode="date"
              display="default"
              onChange={onChangeDate}
              maximumDate={new Date()}
            />
          )}

          {/* --- SELECTORS --- */}
          <View className="mb-4">
            <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">
              Class & Subject
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-3"
            >
              {uniqueClasses.map((cls) => (
                <TouchableOpacity
                  key={cls}
                  onPress={() => handleClassChange(cls)}
                  className={`mr-3 px-5 py-2 rounded-xl border ${selectedClass === cls ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-[#4C5361]"}`}
                >
                  <Text
                    className={`font-bold ${selectedClass === cls ? "text-[#282C34]" : "text-gray-400"}`}
                  >
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedClass && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {availableSubjects.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSelectedSubject(sub)}
                    className={`mr-3 px-5 py-2 rounded-xl border ${selectedSubject === sub ? "bg-blue-500 border-blue-500" : "bg-[#333842] border-[#4C5361]"}`}
                  >
                    <Text
                      className={`font-bold ${selectedSubject === sub ? "text-white" : "text-gray-400"}`}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* --- STUDENT LIST --- */}
          <View className="flex-row justify-between items-end mb-2 border-b border-[#4C5361]/50 pb-2 mx-1">
            <Text className="text-white font-bold text-lg">Student Marks</Text>
            <Text className="text-gray-400 text-xs">
              Total: {students.length}
            </Text>
          </View>

          {fetchingStudents ? (
            <ActivityIndicator color="#f49b33" className="mt-10" />
          ) : (
            <FlatList
              data={students}
              keyExtractor={(item) => item.id}
              renderItem={renderStudentRow}
              scrollEnabled={false}
              ListEmptyComponent={() => (
                <View className="items-center py-10 opacity-30">
                  <MaterialCommunityIcons
                    name="clipboard-text-off"
                    size={50}
                    color="gray"
                  />
                  <Text className="text-gray-400 mt-2">No students found.</Text>
                </View>
              )}
            />
          )}

          <View className="h-32" />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- SUBMIT BUTTON (SHIFTED UP) --- */}
      {!loading && !fetchingStudents && students.length > 0 && (
        <View className="absolute bottom-12 left-5 right-5">
          <TouchableOpacity
            onPress={handlePublish}
            disabled={submitting}
            className="bg-[#f49b33] py-4 rounded-2xl flex-row justify-center items-center shadow-lg"
          >
            {submitting ? (
              <ActivityIndicator color="#282C34" />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload"
                  size={20}
                  color="#282C34"
                  className="mr-2"
                />
                <Text className="text-[#282C34] font-bold text-lg">
                  Publish Results
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default TeacherScoreSubmission;
