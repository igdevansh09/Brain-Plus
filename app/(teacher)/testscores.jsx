// ... (Imports same as before)
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../../config/firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
} from "firebase/firestore";

const TeacherScoreSubmission = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [myClasses, setMyClasses] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [students, setStudents] = useState([]);

  const [examTitle, setExamTitle] = useState("");
  const [maxScore, setMaxScore] = useState("100");

  const colors = {
    BG: "#282C34",
    CARD: "#333842",
    ACCENT: "#f49b33",
    TEXT: "#FFFFFF",
    SUB_TEXT: "#BBBBBB",
    INPUT_BORDER: "#616A7D",
    SUBMIT: "#4CAF50",
    ERROR: "#F44336",
  };

  useEffect(() => {
    const fetchTeacherClasses = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const teacherDoc = await getDoc(doc(db, "users", user.uid));
          if (teacherDoc.exists()) {
            const data = teacherDoc.data();
            setMyClasses(data.classesTaught || []);
            if (data.classesTaught?.length > 0)
              setSelectedClass(data.classesTaught[0]);
            setMySubjects(data.subjects || []);
            if (data.subjects?.length > 0) setSelectedSubject(data.subjects[0]);
          }
        }
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherClasses();
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedClass || !selectedSubject) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("standard", "==", selectedClass),
          where("enrolledSubjects", "array-contains", selectedSubject) 
        );

        const querySnapshot = await getDocs(q);
        const studentList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "Unknown",
          score: "",
          ...doc.data(),
        }));
        setStudents(studentList);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedClass, selectedSubject]);

  const handleScoreChange = (text, studentId) => {
    const newScore = text.replace(/[^0-9]/g, "");
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, score: newScore } : s))
    );
  };

  const handlePublish = async () => {
    if (!examTitle.trim() || !maxScore.trim()) {
      Alert.alert("Error", "Please enter Exam details.");
      return;
    }
    const maxScoreVal = parseInt(maxScore);
    const resultsMap = {};
    let hasError = false;

    students.forEach((s) => {
      if (s.score.trim() !== "") {
        const scoreVal = parseInt(s.score);
        if (scoreVal > maxScoreVal) hasError = true;
        resultsMap[s.id] = scoreVal;
      }
    });

    if (hasError) {
      Alert.alert("Error", "Some scores exceed Max Score.");
      return;
    }
    if (Object.keys(resultsMap).length === 0) {
      Alert.alert("Error", "Enter at least one score.");
      return;
    }

    Alert.alert("Confirm Publish", `Publish scores for "${examTitle}"?`, [
      { text: "Cancel" },
      {
        text: "Publish",
        onPress: async () => {
          try {
            await addDoc(collection(db, "exam_results"), {
              examTitle,
              maxScore: maxScoreVal,
              classId: selectedClass,
              subject: selectedSubject,
              teacherId: auth.currentUser.uid,
              date: new Date().toLocaleDateString("en-GB"),
              createdAt: new Date().toISOString(),
              results: resultsMap,
            });
            Alert.alert("Success", "Results published!");
            setExamTitle("");
            setStudents(students.map((s) => ({ ...s, score: "" })));
          } catch (error) {
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  const renderStudentRow = ({ item, index }) => {
    const scoreInt = parseInt(item.score || "0");
    const maxInt = parseInt(maxScore || "100");
    const isValid = scoreInt <= maxInt;

    return (
      <View
        style={{ backgroundColor: colors.CARD }}
        className={`p-3 rounded-xl mb-3 flex-row justify-between items-center border-l-4 ${
          !isValid
            ? "border-red-500"
            : item.score
              ? "border-green-500"
              : "border-gray-500"
        }`}
      >
        <View className="flex-1 pr-3">
          <Text
            style={{ color: colors.TEXT }}
            className="text-base font-medium"
          >
            {index + 1}. {item.name}
          </Text>
        </View>
        <View style={{ width: 80 }}>
          <TextInput
            placeholder="-"
            placeholderTextColor={colors.SUB_TEXT}
            value={item.score}
            onChangeText={(text) => handleScoreChange(text, item.id)}
            keyboardType="numeric"
            maxLength={4}
            style={{
              backgroundColor: colors.BG,
              color: colors.TEXT,
              borderColor: isValid ? colors.INPUT_BORDER : colors.ERROR,
              textAlign: "center",
              borderWidth: 1,
            }}
            className="p-2 rounded-lg text-base font-bold"
          />
        </View>
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
          Score Submission
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
        <Text
          style={{ color: colors.ACCENT }}
          className="text-xl font-semibold mb-4"
        >
          New Exam Entry
        </Text>

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
                  const curr = mySubjects.indexOf(selectedSubject);
                  setSelectedSubject(
                    mySubjects[(curr + 1) % mySubjects.length]
                  );
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

        <Text style={{ color: colors.SUB_TEXT }} className="text-sm mb-2">
          Exam Name
        </Text>
        <TextInput
          placeholder="E.g. Mid-Term Maths"
          placeholderTextColor={colors.SUB_TEXT}
          value={examTitle}
          onChangeText={setExamTitle}
          style={{
            backgroundColor: colors.CARD,
            color: colors.TEXT,
            borderColor: colors.INPUT_BORDER,
          }}
          className="p-3 rounded-lg border mb-4 text-base"
        />

        <Text style={{ color: colors.SUB_TEXT }} className="text-sm mb-2">
          Max Score
        </Text>
        <TextInput
          placeholder="100"
          placeholderTextColor={colors.SUB_TEXT}
          value={maxScore}
          onChangeText={(text) => setMaxScore(text.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          style={{
            backgroundColor: colors.CARD,
            color: colors.TEXT,
            borderColor: colors.INPUT_BORDER,
          }}
          className="p-3 rounded-lg border mb-4 text-base"
        />

        <View className="flex-row justify-between items-center px-3 py-2 border-b border-t border-[#4C5361] mb-2">
          <Text
            style={{ color: colors.SUB_TEXT }}
            className="text-sm font-semibold"
          >
            Student Name
          </Text>
          <Text
            style={{ color: colors.SUB_TEXT }}
            className="text-sm font-semibold"
          >
            Marks
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.ACCENT}
            className="mt-4"
          />
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            renderItem={renderStudentRow}
            scrollEnabled={false}
            ListEmptyComponent={() => (
              <Text className="text-gray-500 text-center mt-4">
                No students found.
              </Text>
            )}
          />
        )}

        <TouchableOpacity
          onPress={handlePublish}
          style={{ backgroundColor: colors.ACCENT }}
          className="py-3 rounded-xl items-center mt-8 mb-10"
        >
          <Text style={{ color: colors.BG }} className="text-lg font-bold">
            Publish Results
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
export default TeacherScoreSubmission;
