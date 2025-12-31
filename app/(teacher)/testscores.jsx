import React, { useState, useEffect, useCallback } from "react";
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
  Image,
  Modal, // <--- Added Modal
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";

dayjs.extend(customParseFormat);

// --- THEME ---
const theme = {
  bg: "bg-[#282C34]",
  card: "bg-[#333842]",
  accent: "text-[#f49b33]",
  accentBg: "bg-[#f49b33]",
  text: "text-white",
  subText: "text-gray-400",
  green: "#4CAF50",
  red: "#F44336",
  borderColor: "border-[#4C5361]",
};

// --- HELPER: CUSTOM CALENDAR COMPONENT ---
const CustomCalendar = ({
  selectedDate,
  onSelectDate,
  markedDates = [], // Array of "DD/MM/YYYY" strings
  onClose,
}) => {
  const [currentMonth, setCurrentMonth] = useState(dayjs(selectedDate));

  const generateDays = () => {
    const startOfMonth = currentMonth.startOf("month");
    const endOfMonth = currentMonth.endOf("month");
    const startDay = startOfMonth.day();
    const daysInMonth = currentMonth.daysInMonth();

    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(startOfMonth.date(i));
    return days;
  };

  const days = generateDays();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const changeMonth = (dir) => {
    setCurrentMonth(currentMonth.add(dir, "month"));
  };

  return (
    <View className="flex-1 justify-center items-center bg-black/80 p-6">
      <View
        className={`${theme.card} w-full rounded-2xl p-4 border ${theme.borderColor}`}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4 border-b border-[#4C5361] pb-4">
          <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2">
            <Ionicons name="chevron-back" size={24} color="#f49b33" />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg">
            {currentMonth.format("MMMM YYYY")}
          </Text>
          <TouchableOpacity
            onPress={() => changeMonth(1)}
            disabled={currentMonth.add(1, "month").isAfter(dayjs())}
            className="p-2"
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={
                currentMonth.add(1, "month").isAfter(dayjs())
                  ? "#555"
                  : "#f49b33"
              }
            />
          </TouchableOpacity>
        </View>

        {/* Days Header */}
        <View className="flex-row justify-between mb-2">
          {weekDays.map((d) => (
            <Text
              key={d}
              className="text-gray-500 w-[14%] text-center text-xs font-bold"
            >
              {d}
            </Text>
          ))}
        </View>

        {/* Grid */}
        <View className="flex-row flex-wrap mb-4">
          {days.map((date, index) => {
            if (!date)
              return <View key={`empty-${index}`} className="w-[14%] h-10" />;

            const dateStr = date.format("DD/MM/YYYY");
            const isSelected = date.isSame(dayjs(selectedDate), "day");
            const isMarked = markedDates.includes(dateStr);
            const isFuture = date.isAfter(dayjs(), "day");

            return (
              <TouchableOpacity
                key={dateStr}
                disabled={isFuture}
                onPress={() => onSelectDate(date.toDate())}
                className="w-[14%] h-10 justify-center items-center relative mb-1"
              >
                <View
                  className={`w-8 h-8 rounded-full justify-center items-center ${
                    isSelected
                      ? "bg-[#f49b33]"
                      : isMarked
                        ? "bg-[#333842] border border-green-500/50"
                        : "bg-transparent"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected
                        ? "text-[#282C34]"
                        : isFuture
                          ? "text-gray-600"
                          : "text-white"
                    }`}
                  >
                    {date.date()}
                  </Text>
                </View>
                {isMarked && !isSelected && (
                  <View className="absolute bottom-0 w-1 h-1 bg-green-500 rounded-full" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View className="flex-row justify-center items-center mb-4 gap-4">
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
            <Text className="text-gray-400 text-[10px]">Uploaded</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-[#f49b33] mr-2" />
            <Text className="text-gray-400 text-[10px]">Selected</Text>
          </View>
        </View>

        {/* Close Button */}
        <TouchableOpacity
          onPress={onClose}
          className="bg-[#282C34] py-3 rounded-xl border border-[#4C5361] items-center"
        >
          <Text className="text-red-400 font-bold">Close Calendar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- MAIN SCREEN ---
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

  // Calendar State
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [markedDates, setMarkedDates] = useState([]);

  // "View Only" Mode
  const [existingData, setExistingData] = useState(null);

  // Students List
  const [students, setStudents] = useState([]);

  // UI Feedback
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

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

  // --- 2. FETCH MARKED DATES ---
  const fetchMarkedDates = useCallback(async () => {
    if (!selectedClass || !selectedSubject) return;
    try {
      const snap = await firestore()
        .collection("exam_results")
        .where("classId", "==", selectedClass)
        .where("subject", "==", selectedSubject)
        .get();

      const dates = snap.docs.map((doc) => doc.data().date);
      setMarkedDates(dates);
    } catch (e) {
      console.log("Error fetching markers", e);
    }
  }, [selectedClass, selectedSubject]);

  // --- 3. TRIGGER FETCHES ---
  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchMarkedDates();
      fetchData();
    }
  }, [selectedClass, selectedSubject, examDate]);

  const handleClassChange = (cls, profileData = teachingProfile) => {
    setSelectedClass(cls);
    const relevant = profileData
      .filter((item) => item.class === cls)
      .map((item) => item.subject);

    setAvailableSubjects(relevant);
    if (relevant.length > 0) setSelectedSubject(relevant[0]);
    else setSelectedSubject(null);
  };

  const getFormattedDate = (date) => dayjs(date).format("DD/MM/YYYY");

  const fetchData = async () => {
    setFetchingStudents(true);
    try {
      const dateStr = getFormattedDate(examDate);

      // A. Check for Existing Results
      const resQuery = firestore()
        .collection("exam_results")
        .where("classId", "==", selectedClass)
        .where("subject", "==", selectedSubject)
        .where("date", "==", dateStr);

      const resSnap = await resQuery.get();
      let savedData = null;

      if (!resSnap.empty) {
        savedData = resSnap.docs[0].data();
        setExistingData(savedData);
        setExamTitle(savedData.examTitle);
        setMaxScore(savedData.maxScore.toString());
      } else {
        setExistingData(null);
        if (existingData) {
          setExamTitle("");
          setMaxScore("100");
        }
      }

      // B. Fetch Students
      const q = firestore()
        .collection("users")
        .where("role", "==", "student")
        .where("standard", "==", selectedClass);

      const snapshot = await q.get();
      const list = snapshot.docs.map((doc) => {
        const d = doc.data();
        let existingScore = "";
        if (
          savedData &&
          savedData.results &&
          savedData.results[doc.id] !== undefined
        ) {
          existingScore = savedData.results[doc.id].toString();
        }

        return {
          id: doc.id,
          name: d.name || "Unknown",
          rollNo: d.rollNo || "N/A",
          profileImage: d.profileImage || null,
          score: existingScore,
          ...d,
        };
      });

      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);
    } catch (error) {
      console.log("Fetch Error:", error);
      showToast("Failed to load data", "error");
    } finally {
      setFetchingStudents(false);
    }
  };

  const handleScoreChange = (text, studentId) => {
    if (existingData) return;
    const newScore = text.replace(/[^0-9]/g, "");
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, score: newScore } : s))
    );
  };

  const handleDateSelection = (date) => {
    setExamDate(date);
    setCalendarVisible(false); // Close Modal
  };

  const handlePublish = async () => {
    if (!examTitle.trim()) return showToast("Enter Exam Title", "error");
    if (!maxScore.trim()) return showToast("Enter Max Score", "error");

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

    if (hasError) return showToast("Some scores exceed Max Score!", "error");
    if (filledCount === 0)
      return showToast("Enter at least one score.", "error");

    setAlertConfig({
      visible: true,
      title: "Publish Scores?",
      message: `Exam: ${examTitle}\nStudents: ${filledCount}/${students.length}`,
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

          showToast("Published Successfully!", "success");
          fetchMarkedDates();
          fetchData();
        } catch (e) {
          showToast("Publish failed.", "error");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

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
          <Text className="text-white font-bold text-base">{item.name}</Text>
        </View>

        <View className="relative">
          {existingData ? (
            <View className="w-16 h-12 justify-center items-center bg-[#282C34] rounded-lg border border-[#4C5361]">
              <Text
                className={`text-lg font-bold ${isFilled ? "text-[#f49b33]" : "text-gray-600"}`}
              >
                {item.score || "-"}
              </Text>
            </View>
          ) : (
            <TextInput
              placeholder="-"
              placeholderTextColor="#666"
              value={item.score}
              onChangeText={(text) => handleScoreChange(text, item.id)}
              keyboardType="numeric"
              maxLength={4}
              className={`w-16 h-12 rounded-lg text-center text-lg font-bold border ${isOverLimit ? "bg-red-500/10 border-red-500 text-red-500" : "bg-[#282C34] border-[#4C5361] text-white"}`}
            />
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

      {/* --- CALENDAR MODAL --- */}
      <Modal
        visible={calendarVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <CustomCalendar
          selectedDate={examDate}
          markedDates={markedDates}
          onSelectDate={handleDateSelection}
          onClose={() => setCalendarVisible(false)}
        />
      </Modal>

      {/* HEADER */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">
          {existingData ? "View Scores" : "Upload Scores"}
        </Text>
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
          {/* EXAM CONFIG CARD (Reverted to Original) */}
          <View
            className={`${theme.card} p-4 rounded-2xl border ${theme.borderColor} mb-6`}
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                Exam Details
              </Text>
              {existingData && (
                <View className="bg-green-500/20 px-2 py-1 rounded">
                  <Text className="text-green-400 text-[10px] font-bold uppercase">
                    PUBLISHED
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row gap-3 mb-3">
              <TextInput
                placeholder="Exam Name"
                placeholderTextColor="#666"
                value={examTitle}
                onChangeText={setExamTitle}
                editable={!existingData}
                className={`flex-1 bg-[#282C34] p-3 rounded-xl border border-[#4C5361] font-bold ${existingData ? "text-gray-400" : "text-white"}`}
              />
              <TextInput
                placeholder="Max"
                placeholderTextColor="#666"
                value={maxScore}
                onChangeText={(text) =>
                  setMaxScore(text.replace(/[^0-9]/g, ""))
                }
                editable={!existingData}
                keyboardType="numeric"
                maxLength={3}
                className={`w-20 bg-[#282C34] p-3 rounded-xl border border-[#4C5361] font-bold text-center ${existingData ? "text-gray-400" : "text-[#f49b33]"}`}
              />
            </View>

            {/* DATE BUTTON (Triggers Modal) */}
            <TouchableOpacity
              onPress={() => setCalendarVisible(true)}
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

          {/* CLASS SELECTOR */}
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

          {/* STUDENTS */}
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

      {/* SUBMIT BUTTON */}
      {!loading &&
        !fetchingStudents &&
        students.length > 0 &&
        !existingData && (
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
