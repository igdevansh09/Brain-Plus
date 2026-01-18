import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useTheme } from "../../context/ThemeContext";
import ScreenWrapper from "../../components/ScreenWrapper"; // <--- IMPORTED
import CustomHeader from "../../components/CustomHeader"; // <--- IMPORTED

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig";
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
              Recorded
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
const TeacherAttendance = () => {
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

  // --- 1. FETCH PROFILE (MODULAR) ---
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const teacherDocRef = doc(db, "users", user.uid);
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
                subjects.map((s) => ({ class: c, subject: s })),
              ),
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
      const q = query(
        collection(db, "attendance"),
        where("classId", "==", selectedClass),
        where("subject", "==", selectedSubject),
      );
      const snap = await getDocs(q);

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

  // --- FETCH ATTENDANCE FOR DATE (MODULAR) ---
  const fetchAttendanceForDate = async () => {
    setFetchingStudents(true);
    try {
      const dateStr = getFormattedDate(currentDate);

      // A. Check for existing attendance record
      const attQuery = query(
        collection(db, "attendance"),
        where("classId", "==", selectedClass),
        where("subject", "==", selectedSubject),
        where("date", "==", dateStr),
      );

      const attSnap = await getDocs(attQuery);
      let savedRecords = null;

      if (!attSnap.empty) {
        savedRecords = attSnap.docs[0].data().records; // { uid: 'Present' }
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }

      // B. Fetch Students
      const userQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("standard", "==", selectedClass),
      );

      const snapshot = await getDocs(userQuery);
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
      (s) => s === "Absent",
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

          // Check if doc exists to update or create (Modular)
          const q = query(
            collection(db, "attendance"),
            where("classId", "==", selectedClass),
            where("subject", "==", selectedSubject),
            where("date", "==", dateStr),
          );

          const snap = await getDocs(q);

          const payload = {
            classId: selectedClass,
            subject: selectedSubject,
            date: dateStr,
            teacherId: auth.currentUser.uid,
            records: attendanceData,
            updatedAt: serverTimestamp(),
          };

          if (!snap.empty) {
            // Update existing
            const docRef = doc(db, "attendance", snap.docs[0].id);
            await updateDoc(docRef, payload);
          } else {
            // Create new
            await addDoc(collection(db, "attendance"), {
              ...payload,
              createdAt: serverTimestamp(),
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
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: isPresent ? theme.successSoft : theme.errorSoft,
        }}
        className={`p-3 rounded-xl mb-3 flex-row justify-between items-center border ${
          isPresent ? "" : "bg-red-500/5"
        }`}
      >
        <View className="flex-row items-center flex-1">
          <View
            style={{
              borderColor: isPresent ? theme.accent : theme.error,
              backgroundColor: theme.bgTertiary,
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
                style={{ color: isPresent ? theme.accent : theme.error }}
                className="font-bold"
              >
                {item.name.charAt(0)}
              </Text>
            )}
          </View>
          <View>
            <Text
              style={{
                color: isPresent ? theme.textPrimary : theme.errorBright,
              }}
              className="font-bold text-base"
            >
              {item.name}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: isPresent ? theme.successSoft : theme.errorSoft,
            borderColor: isPresent ? theme.success : theme.error,
          }}
          className="px-4 py-2 rounded-lg border border-opacity-50"
        >
          <Text
            style={{
              color: isPresent ? theme.successBright : theme.errorBright,
            }}
            className="font-bold text-xs"
          >
            {status.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View
        style={{
          backgroundColor: theme.bgPrimary,
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    // FIX: Using ScreenWrapper with 'edges' prop to remove top padding space
    <ScreenWrapper scrollable={false} edges={["left", "right", "bottom"]}>
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

      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/* TOP CARD: DATE & CLASS */}
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
              Session Details
            </Text>
            {isLocked && (
              <View
                style={{ backgroundColor: theme.successSoft }}
                className="px-2 py-1 rounded"
              >
                <Text
                  style={{ color: theme.successBright }}
                  className="text-[10px] font-bold uppercase"
                >
                  RECORDED
                </Text>
              </View>
            )}
          </View>

          {/* DATE BUTTON (Triggers Modal) */}
          <TouchableOpacity
            onPress={() => setCalendarVisible(true)}
            style={{
              backgroundColor: theme.bgTertiary,
              borderColor: theme.border,
            }}
            className="flex-row items-center p-3 rounded-xl border mb-4"
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={theme.accent}
              className="mr-2"
            />
            <Text
              style={{ color: theme.textPrimary }}
              className="font-semibold flex-1"
            >
              {getFormattedDate(currentDate)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
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

        {/* STUDENTS LIST */}
        <View
          style={{ borderColor: theme.border }}
          className="flex-row justify-between items-end mb-2 border-b pb-2 mx-1"
        >
          <Text
            style={{ color: theme.textPrimary }}
            className="font-bold text-lg"
          >
            Class Register
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
                <Ionicons
                  name="account-off"
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

      {/* --- SUBMIT / UNLOCK BUTTON --- */}
      {!loading && !fetchingStudents && students.length > 0 && (
        <View className="absolute bottom-12 left-5 right-5">
          {isLocked ? (
            <TouchableOpacity
              onPress={handleUnlock}
              style={{
                backgroundColor: theme.bgSecondary,
                borderColor: theme.border,
              }}
              className="py-4 rounded-2xl flex-row justify-center items-center border shadow-lg"
            >
              <Ionicons
                name="lock-open"
                size={20}
                color={theme.textPrimary}
                className="mr-2"
              />
              <Text
                style={{ color: theme.textPrimary }}
                className="font-bold ml-2"
              >
                Unlock & Edit
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{ backgroundColor: theme.accent }}
              className="py-4 rounded-2xl flex-row justify-center items-center shadow-lg"
            >
              {submitting ? (
                <ActivityIndicator color={theme.textDark} />
              ) : (
                <>
                  <Ionicons name="save" size={20} color={theme.textDark} />
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg ml-2"
                  >
                    Submit Attendance
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScreenWrapper>
  );
};

export default TeacherAttendance;
