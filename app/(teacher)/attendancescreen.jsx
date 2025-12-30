import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert"; // IMPORTED

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
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Lists
  const [students, setStudents] = useState([]);
  const [isLocked, setIsLocked] = useState(false);

  // Toast
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm: null,
    type: "default", // default, warning, error
  });

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    green: "#4CAF50",
    red: "#F44336",
    disabled: "#607D8B",
  };

  // --- 1. FETCH TEACHER PROFILE ---
  useEffect(() => {
    const fetchTeacherData = async () => {
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
        console.log("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherData();
  }, []);

  // --- 2. HANDLE CLASS CHANGE ---
  const handleClassChange = (cls, profileData = teachingProfile) => {
    setSelectedClass(cls);
    const relevantSubjects = profileData
      .filter((item) => item.class === cls)
      .map((item) => item.subject);

    setAvailableSubjects(relevantSubjects);
    if (relevantSubjects.length > 0) {
      setSelectedSubject(relevantSubjects[0]);
    } else {
      setSelectedSubject(null);
    }
  };

  // --- 3. FETCH DATA (STUDENTS & ATTENDANCE) ---
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    loadStudentsAndStatus();
  }, [selectedClass, selectedSubject, currentDate]);

  const loadStudentsAndStatus = async () => {
    setFetchingStudents(true);
    setStudents([]);
    try {
      // A. Get Students
      const studentSnap = await firestore()
        .collection("users")
        .where("role", "==", "student")
        .where("standard", "==", selectedClass)
        .get();

      let studentList = studentSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Unknown",
        rollNo: doc.data().rollNo || "N/A",
        status: "Present",
        ...doc.data(),
      }));

      // B. Check Existing Attendance
      const dateStr = formatDate(currentDate);
      const docId = `${selectedClass}_${selectedSubject}_${dateStr}`;

      const attendanceDoc = await firestore()
        .collection("attendance")
        .doc(docId)
        .get();

      if (attendanceDoc.exists) {
        const data = attendanceDoc.data();
        const records = data?.records || {};

        studentList = studentList.map((s) => ({
          ...s,
          status: records[s.id] || "Absent",
        }));
        setIsLocked(true); // Locks if record exists
      } else {
        setIsLocked(false);
      }

      studentList.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studentList);
    } catch (error) {
      console.log("Load Error:", error);
    } finally {
      setFetchingStudents(false);
    }
  };

  // --- HANDLERS ---
  const formatDate = (date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  const getFormattedDateDisplay = () => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return currentDate.toLocaleDateString("en-US", options);
  };

  const onChangeDate = (event, selectedDate) => {
    const date = selectedDate || currentDate;
    setShowDatePicker(Platform.OS === "ios");
    setCurrentDate(date);
  };

  const toggleStatus = (id) => {
    if (isLocked) {
      showToast("Unlock to edit attendance.", "warning");
      return;
    }
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "Present" ? "Absent" : "Present" }
          : s
      )
    );
  };

  const markAllPresent = () => {
    if (isLocked) return;
    setStudents((prev) => prev.map((s) => ({ ...s, status: "Present" })));
    showToast("All marked Present");
  };

  // --- REPLACED Alert.alert WITH CustomAlert ---
  const handleUnlock = () => {
    setAlertConfig({
      visible: true,
      title: "Unlock Attendance?",
      message:
        "This will allow you to modify the previously submitted attendance.",
      confirmText: "Unlock",
      cancelText: "Cancel",
      type: "warning",
      onConfirm: () => {
        setIsLocked(false);
        setAlertConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleSubmit = async () => {
    if (students.length === 0) return;

    setAlertConfig({
      visible: true,
      title: "Submit Attendance?",
      message: `Class: ${selectedClass}\nSubject: ${selectedSubject}\nDate: ${formatDate(currentDate)}`,
      confirmText: "Submit",
      cancelText: "Cancel",
      type: "default",
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false })); // Close alert first
        setSubmitting(true);
        try {
          const dateStr = formatDate(currentDate);
          const docId = `${selectedClass}_${selectedSubject}_${dateStr}`;

          const recordMap = {};
          let presentCount = 0;
          let absentCount = 0;

          students.forEach((s) => {
            recordMap[s.id] = s.status;
            if (s.status === "Present") presentCount++;
            else absentCount++;
          });

          await firestore()
            .collection("attendance")
            .doc(docId)
            .set({
              date: dateStr,
              timestamp: firestore.FieldValue.serverTimestamp(),
              classId: selectedClass,
              subject: selectedSubject,
              teacherId: auth().currentUser.uid,
              records: recordMap,
              summary: {
                present: presentCount,
                absent: absentCount,
                total: students.length,
              },
            });

          setIsLocked(true);
          showToast("Attendance Submitted!", "success");
        } catch (e) {
          showToast("Submission failed.", "error");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  // --- RENDERERS ---
  const renderStudent = ({ item }) => {
    const isPresent = item.status === "Present";
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => toggleStatus(item.id)}
        className={`flex-row items-center p-4 mb-3 rounded-2xl border ${isPresent ? "bg-[#333842] border-green-500/30" : "bg-[#333842] border-red-500/30"}`}
      >
        {/* Avatar */}
        <View
          className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isPresent ? "bg-green-500/20" : "bg-red-500/20"}`}
        >
          <Text
            className={`font-bold ${isPresent ? "text-green-400" : "text-red-400"}`}
          >
            {item.name.charAt(0)}
          </Text>
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="text-white font-bold text-base">{item.name}</Text>

        </View>

        {/* Toggle Status */}
        <View
          className={`px-3 py-1 rounded-full border ${isPresent ? "bg-green-500/10 border-green-500" : "bg-red-500/10 border-red-500"}`}
        >
          <Text
            className={`text-xs font-bold ${isPresent ? "text-green-400" : "text-red-400"}`}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* --- HEADER --- */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Mark Attendance</Text>
        <View className="w-10" />
      </View>

      {/* --- DATE BANNER (CLICKABLE) --- */}
      <View className="px-5 mb-6">
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="bg-[#f49b33]/10 border border-[#f49b33]/30 p-4 rounded-xl flex-row justify-between items-center"
        >
          <View>
            <Text className="text-[#f49b33] text-xs font-bold uppercase tracking-widest">
              Session Date
            </Text>
            <Text className="text-white font-bold text-lg">
              {getFormattedDateDisplay()}
            </Text>
          </View>
          <Ionicons name="calendar" size={28} color="#f49b33" />
        </TouchableOpacity>
      </View>

      {/* --- DATE PICKER --- */}
      {showDatePicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          onChange={onChangeDate}
          maximumDate={new Date()} // Prevent future attendance
        />
      )}

      {/* --- SELECTORS --- */}
      <View className="px-5 mb-2">
        {/* Class Scroll */}
        <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">
          Select Class
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
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

        {/* Subject Scroll */}
        {selectedClass && (
          <>
            <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">
              Select Subject
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-2"
            >
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
          </>
        )}
      </View>

      {/* --- STATS & ACTIONS --- */}
      {selectedClass && selectedSubject && !loading && (
        <View className="px-5 flex-row justify-between items-center py-2 border-b border-[#4C5361]/50 mb-2">
          <Text className="text-gray-400 text-xs">
            Total Students:{" "}
            <Text className="text-white font-bold">{students.length}</Text>
          </Text>
          {!isLocked && (
            <TouchableOpacity
              onPress={markAllPresent}
              className="flex-row items-center"
            >
              <Text className="text-[#f49b33] text-xs font-bold mr-1">
                Mark All Present
              </Text>
              <Ionicons
                name="checkmark-done-circle"
                size={16}
                color="#f49b33"
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* --- LIST --- */}
      {loading || fetchingStudents ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#f49b33" />
          <Text className="text-gray-500 text-xs mt-2">
            Loading Class Data...
          </Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudent}
          contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
          ListEmptyComponent={() => (
            <View className="items-center mt-10 opacity-50">
              <MaterialCommunityIcons
                name="account-group"
                size={60}
                color="gray"
              />
              <Text className="text-gray-400 mt-2">
                No students found for this subject.
              </Text>
            </View>
          )}
        />
      )}

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
              <Text className="text-white font-bold ml-2">
                Attendance Locked (Tap to Edit)
              </Text>
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
