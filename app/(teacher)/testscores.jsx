import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useTheme } from "../../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";

dayjs.extend(customParseFormat);

// --- HELPER: CUSTOM CALENDAR COMPONENT ---
const CustomCalendar = ({
  selectedDate,
  onSelectDate,
  markedDates = [],
  onClose,
}) => {
  const { theme } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(dayjs(selectedDate));

  const generateDays = () => {
    const startOfMonth = currentMonth.startOf("month");
    const daysInMonth = currentMonth.daysInMonth();
    const startDay = startOfMonth.day();

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
    <View
      style={{ backgroundColor: theme.blackSoft80 }}
      className="flex-1 justify-center items-center p-6"
    >
      <View
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
        }}
        className="w-full rounded-2xl p-4 border"
      >
        {/* Header */}
        <View
          style={{ borderColor: theme.border }}
          className="flex-row justify-between items-center mb-4 border-b pb-4"
        >
          <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2">
            <Ionicons name="chevron-back" size={24} color={theme.accent} />
          </TouchableOpacity>
          <Text
            style={{ color: theme.textPrimary }}
            className="font-bold text-lg"
          >
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
                  ? theme.textMuted
                  : theme.accent
              }
            />
          </TouchableOpacity>
        </View>

        {/* Days Header */}
        <View className="flex-row justify-between mb-2">
          {weekDays.map((d) => (
            <Text
              key={d}
              style={{ color: theme.textSecondary }}
              className="w-[14%] text-center text-xs font-bold"
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
                  style={{
                    backgroundColor: isSelected
                      ? theme.accent
                      : isMarked
                        ? theme.bgTertiary
                        : "transparent",
                    borderColor:
                      isMarked && !isSelected ? theme.success : "transparent",
                    borderWidth: isMarked && !isSelected ? 1 : 0,
                  }}
                  className="w-8 h-8 rounded-full justify-center items-center"
                >
                  <Text
                    style={{
                      color: isSelected
                        ? theme.textDark
                        : isFuture
                          ? theme.textMuted
                          : theme.textPrimary,
                    }}
                    className="text-xs font-bold"
                  >
                    {date.date()}
                  </Text>
                </View>
                {isMarked && !isSelected && (
                  <View
                    style={{ backgroundColor: theme.success }}
                    className="absolute bottom-0 w-1 h-1 rounded-full"
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View className="flex-row justify-center items-center mb-4 gap-4">
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: theme.success }}
              className="w-2 h-2 rounded-full mr-2"
            />
            <Text
              style={{ color: theme.textSecondary }}
              className="text-[10px]"
            >
              Uploaded
            </Text>
          </View>
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: theme.accent }}
              className="w-2 h-2 rounded-full mr-2"
            />
            <Text
              style={{ color: theme.textSecondary }}
              className="text-[10px]"
            >
              Selected
            </Text>
          </View>
        </View>

        {/* Close Button */}
        <TouchableOpacity
          onPress={onClose}
          style={{
            backgroundColor: theme.bgTertiary,
            borderColor: theme.border,
          }}
          className="py-3 rounded-xl border items-center"
        >
          <Text style={{ color: theme.errorBright }} className="font-bold">
            Close Calendar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- MAIN SCREEN ---
const TeacherScoreSubmission = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
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

  // --- 1. FETCH PROFILE (MODULAR) ---
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        // Modular: doc + getDoc
        const teacherDocRef = doc(db, "users", uid);
        const teacherDoc = await getDoc(teacherDocRef);

        if (teacherDoc.exists()) {
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

  // --- 2. FETCH MARKED DATES (MODULAR) ---
  const fetchMarkedDates = useCallback(async () => {
    if (!selectedClass || !selectedSubject) return;
    try {
      // Modular: query + getDocs
      const q = query(
        collection(db, "exam_results"),
        where("classId", "==", selectedClass),
        where("subject", "==", selectedSubject)
      );
      const snap = await getDocs(q);

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

  // --- FETCH DATA FOR DATE (MODULAR) ---
  const fetchData = async () => {
    setFetchingStudents(true);
    try {
      const dateStr = getFormattedDate(examDate);

      // A. Check for Existing Results (Modular)
      const resQuery = query(
        collection(db, "exam_results"),
        where("classId", "==", selectedClass),
        where("subject", "==", selectedSubject),
        where("date", "==", dateStr)
      );

      const resSnap = await getDocs(resQuery);
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

      // B. Fetch Students (Modular)
      const userQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("standard", "==", selectedClass)
      );

      const snapshot = await getDocs(userQuery);
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
          // Modular: addDoc + serverTimestamp
          await addDoc(collection(db, "exam_results"), {
            examTitle: examTitle.trim(),
            maxScore: maxVal,
            classId: selectedClass,
            subject: selectedSubject,
            teacherId: auth.currentUser.uid,
            date: getFormattedDate(examDate),
            createdAt: serverTimestamp(),
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
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: isOverLimit
            ? theme.error
            : isFilled
              ? theme.successSoft
              : theme.border,
        }}
        className="p-3 rounded-xl mb-3 flex-row justify-between items-center border"
      >
        <View className="flex-row items-center flex-1">
          <View
            style={{
              backgroundColor: theme.bgTertiary,
              borderColor: isFilled ? theme.accent : theme.border,
            }}
            className="w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden border"
          >
            {item.profileImage ? (
              <Image
                source={{ uri: item.profileImage }}
                className="w-full h-full"
              />
            ) : (
              <Text
                style={{ color: isFilled ? theme.accent : theme.textMuted }}
                className="font-bold"
              >
                {item.name.charAt(0)}
              </Text>
            )}
          </View>
          <Text
            style={{ color: theme.textPrimary }}
            className="font-bold text-base"
          >
            {item.name}
          </Text>
        </View>

        <View className="relative">
          {existingData ? (
            <View
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
              }}
              className="w-16 h-12 justify-center items-center rounded-lg border"
            >
              <Text
                style={{
                  color: isFilled ? theme.accent : theme.textSecondary,
                }}
                className="text-lg font-bold"
              >
                {item.score || "-"}
              </Text>
            </View>
          ) : (
            <TextInput
              placeholder="-"
              placeholderTextColor={theme.placeholder}
              value={item.score}
              onChangeText={(text) => handleScoreChange(text, item.id)}
              keyboardType="numeric"
              maxLength={4}
              style={{
                backgroundColor: isOverLimit
                  ? theme.errorSoft
                  : theme.bgTertiary,
                borderColor: isOverLimit ? theme.error : theme.border,
                color: isOverLimit ? theme.errorBright : theme.textPrimary,
              }}
              className="w-16 h-12 rounded-lg text-center text-lg font-bold border"
            />
          )}
        </View>
      </View>
    );
  };

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
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
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
          {/* EXAM CONFIG CARD */}
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="p-4 rounded-2xl border mb-6"
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs font-bold uppercase tracking-widest"
              >
                Exam Details
              </Text>
              {existingData && (
                <View
                  style={{ backgroundColor: theme.successSoft }}
                  className="px-2 py-1 rounded"
                >
                  <Text
                    style={{ color: theme.successBright }}
                    className="text-[10px] font-bold uppercase"
                  >
                    PUBLISHED
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row gap-3 mb-3">
              <TextInput
                placeholder="Exam Name"
                placeholderTextColor={theme.placeholder}
                value={examTitle}
                onChangeText={setExamTitle}
                editable={!existingData}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                  color: existingData ? theme.textSecondary : theme.textPrimary,
                }}
                className="flex-1 p-3 rounded-xl border font-bold"
              />
              <TextInput
                placeholder="Max"
                placeholderTextColor={theme.placeholder}
                value={maxScore}
                onChangeText={(text) =>
                  setMaxScore(text.replace(/[^0-9]/g, ""))
                }
                editable={!existingData}
                keyboardType="numeric"
                maxLength={3}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                  color: existingData ? theme.textSecondary : theme.accent,
                }}
                className="w-20 p-3 rounded-xl border font-bold text-center"
              />
            </View>

            {/* DATE BUTTON (Triggers Modal) */}
            <TouchableOpacity
              onPress={() => setCalendarVisible(true)}
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
              }}
              className="flex-row items-center p-3 rounded-xl border"
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={theme.accent}
                className="mr-2"
              />
              <Text
                style={{ color: theme.textPrimary }}
                className="font-semibold"
              >
                {getFormattedDate(examDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* CLASS SELECTOR */}
          <View className="mb-4">
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs font-bold uppercase mb-2 ml-1"
            >
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
                  style={{
                    backgroundColor:
                      selectedClass === cls ? theme.accent : theme.bgTertiary,
                    borderColor:
                      selectedClass === cls ? theme.accent : theme.border,
                  }}
                  className="mr-3 px-5 py-2 rounded-xl border"
                >
                  <Text
                    style={{
                      color:
                        selectedClass === cls
                          ? theme.textDark
                          : theme.textSecondary,
                    }}
                    className="font-bold"
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
                    style={{
                      backgroundColor:
                        selectedSubject === sub ? theme.info : theme.bgTertiary,
                      borderColor:
                        selectedSubject === sub ? theme.info : theme.border,
                    }}
                    className="mr-3 px-5 py-2 rounded-xl border"
                  >
                    <Text
                      style={{
                        color:
                          selectedSubject === sub
                            ? theme.white
                            : theme.textSecondary,
                      }}
                      className="font-bold"
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* STUDENTS */}
          <View
            style={{ borderColor: theme.borderSoft }}
            className="flex-row justify-between items-end mb-2 border-b pb-2 mx-1"
          >
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-lg"
            >
              Student Marks
            </Text>
            <Text style={{ color: theme.textSecondary }} className="text-xs">
              Total: {students.length}
            </Text>
          </View>

          {fetchingStudents ? (
            <ActivityIndicator color={theme.accent} className="mt-10" />
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
                    color={theme.textMuted}
                  />
                  <Text style={{ color: theme.textMuted }} className="mt-2">
                    No students found.
                  </Text>
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
              style={{
                backgroundColor: theme.accent,
                shadowColor: theme.shadow,
              }}
              className="py-4 rounded-2xl flex-row justify-center items-center shadow-lg"
            >
              {submitting ? (
                <ActivityIndicator color={theme.textDark} />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload"
                    size={20}
                    color={theme.textDark}
                    className="mr-2"
                  />
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
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
