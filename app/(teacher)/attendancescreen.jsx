import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  ScrollView,
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
            <Text className="text-gray-400 text-[10px]">Recorded</Text>
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
const TeacherAttendance = () => {
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
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calendar State
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [markedDates, setMarkedDates] = useState([]);

  // Attendance State
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({}); // { uid: 'Present' | 'Absent' }
  const [isLocked, setIsLocked] = useState(false); // If already submitted for this date

  // Toast & Alert
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
        .collection("attendance")
        .where("classId", "==", selectedClass)
        .where("subject", "==", selectedSubject)
        .get();

      const dates = snap.docs.map((doc) => doc.data().date);
      setMarkedDates(dates);
    } catch (e) {
      console.log("Error fetching attendance markers", e);
    }
  }, [selectedClass, selectedSubject]);

  // --- 3. TRIGGER FETCHES ---
  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchMarkedDates();
      fetchAttendanceForDate();
    }
  }, [selectedClass, selectedSubject, currentDate]);

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

  const fetchAttendanceForDate = async () => {
    setFetchingStudents(true);
    try {
      const dateStr = getFormattedDate(currentDate);

      // A. Check for existing attendance record
      const attQuery = firestore()
        .collection("attendance")
        .where("classId", "==", selectedClass)
        .where("subject", "==", selectedSubject)
        .where("date", "==", dateStr);

      const attSnap = await attQuery.get();
      let savedRecords = null;

      if (!attSnap.empty) {
        savedRecords = attSnap.docs[0].data().records; // { uid: 'Present' }
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }

      // B. Fetch Students
      const q = firestore()
        .collection("users")
        .where("role", "==", "student")
        .where("standard", "==", selectedClass);

      const snapshot = await q.get();
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      // C. Set Initial State
      const initialMap = {};
      list.forEach((student) => {
        if (savedRecords && savedRecords[student.id]) {
          initialMap[student.id] = savedRecords[student.id];
        } else {
          initialMap[student.id] = "Present"; // Default to Present
        }
      });
      setAttendanceData(initialMap);
    } catch (error) {
      console.log("Fetch Error:", error);
      showToast("Failed to load data", "error");
    } finally {
      setFetchingStudents(false);
    }
  };

  const toggleAttendance = (studentId) => {
    if (isLocked) return; // Prevent edit if locked
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === "Present" ? "Absent" : "Present",
    }));
  };

  const handleDateSelection = (date) => {
    setCurrentDate(date);
    setCalendarVisible(false); // Close Modal
  };

  const handleUnlock = () => {
    setAlertConfig({
      visible: true,
      title: "Unlock Attendance?",
      message: "You are about to modify a past record. Proceed?",
      onConfirm: () => {
        setIsLocked(false);
        setAlertConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleSubmit = async () => {
    const absentCount = Object.values(attendanceData).filter(
      (s) => s === "Absent"
    ).length;
    const total = students.length;

    setAlertConfig({
      visible: true,
      title: "Submit Attendance?",
      message: `Total: ${total}\nPresent: ${total - absentCount}\nAbsent: ${absentCount}`,
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        setSubmitting(true);
        try {
          const dateStr = getFormattedDate(currentDate);

          // Check if doc exists to update or create
          const q = firestore()
            .collection("attendance")
            .where("classId", "==", selectedClass)
            .where("subject", "==", selectedSubject)
            .where("date", "==", dateStr);

          const snap = await q.get();

          const payload = {
            classId: selectedClass,
            subject: selectedSubject,
            date: dateStr,
            teacherId: auth().currentUser.uid,
            records: attendanceData,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          };

          if (!snap.empty) {
            await firestore()
              .collection("attendance")
              .doc(snap.docs[0].id)
              .update(payload);
          } else {
            await firestore()
              .collection("attendance")
              .add({
                ...payload,
                createdAt: firestore.FieldValue.serverTimestamp(),
              });
          }

          showToast("Attendance Saved!", "success");
          setIsLocked(true);
          fetchMarkedDates(); // Refresh calendar dots
        } catch (error) {
          showToast("Failed to save.", "error");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const renderStudentRow = ({ item }) => {
    const status = attendanceData[item.id] || "Present";
    const isPresent = status === "Present";

    return (
      <TouchableOpacity
        onPress={() => toggleAttendance(item.id)}
        activeOpacity={isLocked ? 1 : 0.7}
        className={`${theme.card} p-3 rounded-xl mb-3 flex-row justify-between items-center border ${
          isPresent ? "border-green-500/30" : "border-red-500/50 bg-red-500/5"
        }`}
      >
        <View className="flex-row items-center flex-1">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden border ${
              isPresent ? "border-[#f49b33]" : "border-red-400"
            } bg-[#282C34]`}
          >
            {item.profileImage ? (
              <Image
                source={{ uri: item.profileImage }}
                className="w-full h-full"
              />
            ) : (
              <Text
                className={`font-bold ${isPresent ? "text-[#f49b33]" : "text-red-400"}`}
              >
                {item.name.charAt(0)}
              </Text>
            )}
          </View>
          <View>
            <Text
              className={`font-bold text-base ${isPresent ? "text-white" : "text-red-300"}`}
            >
              {item.name}
            </Text>
          </View>
        </View>

        <View
          className={`px-4 py-2 rounded-lg border ${
            isPresent
              ? "bg-green-500/10 border-green-500/50"
              : "bg-red-500/10 border-red-500/50"
          }`}
        >
          <Text
            className={`font-bold text-xs ${
              isPresent ? "text-green-400" : "text-red-400"
            }`}
          >
            {status.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
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
        confirmText="Confirm"
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
          selectedDate={currentDate}
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
        <Text className="text-white text-xl font-bold">Attendance</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1 px-5 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* TOP CARD: DATE & CLASS */}
        <View
          className={`${theme.card} p-4 rounded-2xl border ${theme.borderColor} mb-6`}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">
              Session Details
            </Text>
            {isLocked && (
              <View className="bg-green-500/20 px-2 py-1 rounded">
                <Text className="text-green-400 text-[10px] font-bold uppercase">
                  RECORDED
                </Text>
              </View>
            )}
          </View>

          {/* DATE BUTTON (Triggers Modal) */}
          <TouchableOpacity
            onPress={() => setCalendarVisible(true)}
            className="flex-row items-center bg-[#282C34] p-3 rounded-xl border border-[#4C5361] mb-4"
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color="#f49b33"
              className="mr-2"
            />
            <Text className="text-white font-semibold flex-1">
              {getFormattedDate(currentDate)}
            </Text>
            <Ionicons name="chevron-down" size={16} color="gray" />
          </TouchableOpacity>

          {/* CLASS SELECTOR */}
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

        {/* STUDENTS LIST */}
        <View className="flex-row justify-between items-end mb-2 border-b border-[#4C5361]/50 pb-2 mx-1">
          <Text className="text-white font-bold text-lg">Class Register</Text>
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
                  name="account-off"
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

      {/* --- SUBMIT / UNLOCK BUTTON --- */}
      {!loading && !fetchingStudents && students.length > 0 && (
        <View className="absolute bottom-12 left-5 right-5">
          {isLocked ? (
            <TouchableOpacity
              onPress={handleUnlock}
              className="bg-gray-700 py-4 rounded-2xl flex-row justify-center items-center border border-gray-500 shadow-lg"
            >
              <Ionicons
                name="lock-open"
                size={20}
                color="#fff"
                className="mr-2"
              />
              <Text className="text-white font-bold ml-2">Unlock & Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              className="bg-[#f49b33] py-4 rounded-2xl flex-row justify-center items-center shadow-lg"
            >
              {submitting ? (
                <ActivityIndicator color="#282C34" />
              ) : (
                <>
                  <Ionicons name="save" size={20} color="#282C34" />
                  <Text className="text-[#282C34] font-bold text-lg ml-2">
                    Submit Attendance
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

export default TeacherAttendance;
