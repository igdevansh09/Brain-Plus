import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { auth, db } from "../../config/firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

const TeacherAttendance = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [myClasses, setMyClasses] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [students, setStudents] = useState([]);
  const [isLocked, setIsLocked] = useState(false);

  const colors = {
    BG: "#282C34",
    CARD: "#333842",
    ACCENT: "#f49b33",
    TEXT: "#FFFFFF",
    SUB_TEXT: "#BBBBBB",
    INPUT_BORDER: "#616A7D",
    PRESENT: "#4CAF50",
    ABSENT: "#F44336",
    LOCKED: "#607D8B",
  };

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const teacherDoc = await getDoc(doc(db, "users", user.uid));
          if (teacherDoc.exists()) {
            const data = teacherDoc.data();
            const classes = data.classesTaught || [];
            setMyClasses(classes);
            if (classes.length > 0) setSelectedClass(classes[0]);

            const subjects = data.subjects || [];
            setMySubjects(subjects);
            if (subjects.length > 0) setSelectedSubject(subjects[0]);
          }
        }
      } catch (error) {
        console.log("Error fetching teacher profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherData();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedClass || !selectedSubject) return;

      setLoading(true);
      try {
        const q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("standard", "==", selectedClass),
          where("enrolledSubjects", "array-contains", selectedSubject)
        );

        const studentSnapshot = await getDocs(q);
        let studentList = studentSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Unknown",
          status: "Present",
          ...doc.data(),
        }));

        const dateStr = formatDate(attendanceDate);
        const attendanceDocId = `${selectedClass}_${selectedSubject}_${dateStr}`;
        const attendanceDoc = await getDoc(
          doc(db, "attendance", attendanceDocId)
        );

        if (attendanceDoc.exists()) {
          const record = attendanceDoc.data().records;
          studentList = studentList.map((s) => ({
            ...s,
            status: record[s.id] || "Present",
          }));
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }

        setStudents(studentList);
      } catch (error) {
        console.log("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedClass, selectedSubject, attendanceDate]);

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || attendanceDate;
    setShowDatePicker(Platform.OS === "ios");
    setAttendanceDate(currentDate);
  };

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const toggleStatus = (studentId, currentStatus) => {
    if (isLocked) {
      Alert.alert(
        "Locked",
        "Attendance for this session has already been submitted."
      );
      return;
    }
    const nextStatus = currentStatus === "Present" ? "Absent" : "Present";
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: nextStatus } : s))
    );
  };

  const handleSubmitAttendance = async () => {
    if (students.length === 0) return;

    Alert.alert(
      "Confirm Submission",
      `Mark ${selectedSubject} attendance for ${selectedClass} on ${formatDate(attendanceDate)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            try {
              const dateString = formatDate(attendanceDate);
              const docId = `${selectedClass}_${selectedSubject}_${dateString}`;

              const attendanceRecord = {};
              students.forEach((s) => {
                attendanceRecord[s.id] = s.status;
              });

              await setDoc(doc(db, "attendance", docId), {
                date: dateString,
                classId: selectedClass,
                subject: selectedSubject,
                teacherId: auth.currentUser.uid,
                records: attendanceRecord,
                createdAt: new Date().toISOString(),
              });

              setIsLocked(true);
              Alert.alert("Success", "Subject attendance recorded.");
            } catch (error) {
              Alert.alert("Error", "Failed to save attendance.");
            }
          },
        },
      ]
    );
  };

  const renderStudentRow = ({ item }) => {
    const isPresent = item.status === "Present";
    const statusColor = isLocked
      ? colors.LOCKED
      : isPresent
        ? colors.PRESENT
        : colors.ABSENT;

    return (
      <View
        style={{ backgroundColor: colors.CARD, borderLeftColor: statusColor }}
        className="p-3 rounded-xl mb-3 flex-row justify-between items-center border-l-4"
      >
        <View className="flex-1">
          <Text
            style={{ color: colors.TEXT }}
            className="text-base font-medium"
          >
            {item.name}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => toggleStatus(item.id, item.status)}
          disabled={isLocked}
          style={{
            backgroundColor: isLocked
              ? "transparent"
              : isPresent
                ? `${colors.PRESENT}30`
                : `${colors.ABSENT}30`,
            borderColor: statusColor,
            opacity: isLocked ? 0.6 : 1,
          }}
          className="px-4 py-2 rounded-full border"
        >
          <Text style={{ color: statusColor }} className="text-sm font-bold">
            {item.status.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.BG }}
      className="pt-8"
    >
      <StatusBar backgroundColor={colors.BG} barStyle="light-content" />
      <View className="px-4 pb-4 py-7 flex-row items-center">
        <Ionicons
          name="arrow-back"
          size={24}
          color={colors.TEXT}
          onPress={() => router.back()}
        />
        <Text
          style={{ color: colors.TEXT }}
          className="text-2xl font-semibold ml-4"
        >
          Attendance
        </Text>
      </View>

      <View className="px-4 mb-4">
        <View className="flex-row justify-between mb-4">
          <View style={{ width: "48%" }}>
            <Text style={{ color: colors.SUB_TEXT }} className="text-xs mb-1">
              Class
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (myClasses.length > 1) {
                  const currentIndex = myClasses.indexOf(selectedClass);
                  const nextIndex = (currentIndex + 1) % myClasses.length;
                  setSelectedClass(myClasses[nextIndex]);
                }
              }}
              style={{
                borderColor: colors.INPUT_BORDER,
                backgroundColor: colors.CARD,
              }}
              className="p-3 rounded-lg border flex-row justify-between items-center"
            >
              <Text
                style={{ color: colors.TEXT }}
                numberOfLines={1}
                className="text-base font-semibold"
              >
                {selectedClass || "..."}
              </Text>
              <Ionicons name="caret-down" size={14} color={colors.SUB_TEXT} />
            </TouchableOpacity>
          </View>
          <View style={{ width: "48%" }}>
            <Text style={{ color: colors.SUB_TEXT }} className="text-xs mb-1">
              Subject
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (mySubjects.length > 1) {
                  const currentIndex = mySubjects.indexOf(selectedSubject);
                  const nextIndex = (currentIndex + 1) % mySubjects.length;
                  setSelectedSubject(mySubjects[nextIndex]);
                }
              }}
              style={{
                borderColor: colors.INPUT_BORDER,
                backgroundColor: colors.CARD,
              }}
              className="p-3 rounded-lg border flex-row justify-between items-center"
            >
              <Text
                style={{ color: colors.TEXT }}
                numberOfLines={1}
                className="text-base font-semibold"
              >
                {selectedSubject || "..."}
              </Text>
              <Ionicons name="caret-down" size={14} color={colors.SUB_TEXT} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-2">
          <Text style={{ color: colors.SUB_TEXT }} className="text-xs mb-1">
            Date
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={{
              borderColor: colors.INPUT_BORDER,
              backgroundColor: colors.CARD,
            }}
            className="p-3 rounded-lg border flex-row items-center justify-between"
          >
            <Text
              style={{ color: colors.TEXT }}
              className="text-base font-semibold"
            >
              {formatDate(attendanceDate)}
            </Text>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.SUB_TEXT}
            />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={attendanceDate}
              mode="date"
              display="default"
              onChange={onChangeDate}
            />
          )}
        </View>

        {isLocked && (
          <View className="bg-gray-700 p-2 rounded mt-2 items-center flex-row justify-center">
            <Ionicons name="lock-closed" size={14} color="#BBBBBB" />
            <Text style={{ color: "#BBBBBB", fontSize: 12, marginLeft: 4 }}>
              Attendance Locked
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.ACCENT}
          className="mt-10"
        />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentRow}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <Text className="text-white text-center mt-10">
              No students found in {selectedClass} taking {selectedSubject}.
            </Text>
          )}
          ListFooterComponent={() =>
            !isLocked &&
            students.length > 0 && (
              <TouchableOpacity
                onPress={handleSubmitAttendance}
                style={{ backgroundColor: colors.ACCENT }}
                className="py-3 rounded-xl items-center mt-4"
              >
                <Text
                  style={{ color: colors.BG }}
                  className="text-lg font-bold"
                >
                  Submit Attendance
                </Text>
              </TouchableOpacity>
            )
          }
        />
      )}
    </SafeAreaView>
  );
};

export default TeacherAttendance;
