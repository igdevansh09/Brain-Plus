import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// --- NATIVE SDK IMPORTS ---
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const TestScores = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");

  // Theme Constants
  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    accentBg: "bg-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    border: "border-[#4C5361]",
    success: "#4CAF50",
    warning: "#FFC107",
    danger: "#FF5252",
  };

  // --- 1. DATA FETCHING (CORRECTED) ---
  const fetchScores = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      console.log("Fetching profile for:", user.uid);

      // A. Get Student's Class (Standard) first
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      const studentClass = userDoc.data()?.standard;

      if (!studentClass) {
        console.log("Student has no class assigned.");
        setLoading(false);
        return;
      }

      console.log("Fetching exams for class:", studentClass);

      // B. Fetch Exams for this Class from 'exam_results'
      const snapshot = await firestore()
        .collection("exam_results") // Correct Collection Name
        .where("classId", "==", studentClass)
        .get();

      if (snapshot.empty) {
        console.log("No exams found for class:", studentClass);
      }

      // C. Filter and Extract THIS student's score
      const data = snapshot.docs
        .map((doc) => {
          const exam = doc.data();
          // The teacher saves scores in a map: { "uid123": 85, "uid456": 90 }
          const myScore = exam.results ? exam.results[user.uid] : null;

          // Only show exams where this student has a score
          if (myScore !== null && myScore !== undefined && myScore !== "") {
            return {
              id: doc.id,
              testName: exam.examTitle || "Untitled Test",
              subject: exam.subject || "General",
              totalMarks: exam.maxScore || 100,
              marksObtained: myScore,
              date: exam.date, // Stored as "DD/MM/YYYY" string
            };
          }
          return null;
        })
        .filter((item) => item !== null); // Remove nulls

      // D. Sort by Date (Handling DD/MM/YYYY string)
      data.sort((a, b) => {
        const parseDate = (str) => {
          if (!str) return new Date(0);
          if (str.toDate) return str.toDate(); // Handle Firestore Timestamp if present
          const parts = str.split("/");
          if (parts.length === 3)
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          return new Date(0);
        };
        return parseDate(b.date) - parseDate(a.date);
      });

      console.log("Scores found:", data.length);
      setScores(data);
    } catch (error) {
      console.error("Error fetching scores:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  // --- 2. COMPUTED DATA ---
  const filteredScores = useMemo(() => {
    if (selectedSubject === "All") return scores;
    return scores.filter((s) => s.subject === selectedSubject);
  }, [selectedSubject, scores]);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(scores.map((s) => s.subject));
    return ["All", ...Array.from(subjects)];
  }, [scores]);

  const stats = useMemo(() => {
    if (filteredScores.length === 0) return { average: 0, bestSubject: "N/A" };

    const totalPercentage = filteredScores.reduce((sum, item) => {
      const obt = parseFloat(item.marksObtained) || 0;
      const tot = parseFloat(item.totalMarks) || 100;
      return sum + (obt / tot) * 100;
    }, 0);

    // Best Subject Logic
    const subjectPerformance = {};
    scores.forEach((s) => {
      const obt = parseFloat(s.marksObtained) || 0;
      const tot = parseFloat(s.totalMarks) || 100;
      const pct = (obt / tot) * 100;
      if (!subjectPerformance[s.subject]) subjectPerformance[s.subject] = [];
      subjectPerformance[s.subject].push(pct);
    });

    let bestSub = "N/A";
    let maxAvg = -1;

    Object.keys(subjectPerformance).forEach((sub) => {
      const avg =
        subjectPerformance[sub].reduce((a, b) => a + b, 0) /
        subjectPerformance[sub].length;
      if (avg > maxAvg) {
        maxAvg = avg;
        bestSub = sub;
      }
    });

    return {
      average: (totalPercentage / filteredScores.length).toFixed(1),
      bestSubject: bestSub,
    };
  }, [filteredScores, scores]);

  // --- 3. RENDER HELPERS ---
  const getGradeColor = (percentage) => {
    if (percentage >= 75) return theme.success;
    if (percentage >= 50) return theme.warning;
    return theme.danger;
  };

  const renderItem = useCallback(({ item }) => {
    const obt = parseFloat(item.marksObtained) || 0;
    const tot = parseFloat(item.totalMarks) || 100;
    const percentage = (obt / tot) * 100;
    const color = getGradeColor(percentage);

    return (
      <View
        className={`${theme.card} rounded-2xl p-4 mb-4 border ${theme.border}`}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View>
            <Text className={`${theme.text} font-bold text-lg`}>
              {item.testName}
            </Text>
            <Text className={`${theme.subText} text-xs mt-1`}>
              {item.subject} • {item.date}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-white font-bold text-xl">
              {obt}
              <Text className="text-gray-500 text-sm">/{tot}</Text>
            </Text>
            <Text style={{ color: color }} className="text-xs font-bold">
              {percentage.toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-[#282C34] rounded-full overflow-hidden mt-2">
          <View
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: color,
            }}
            className="h-full rounded-full"
          />
        </View>
      </View>
    );
  }, []);

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

      {/* Header */}
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361] mr-4"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Test Scores</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Performance Summary */}
        <View
          className={`${theme.card} p-5 rounded-2xl border ${theme.border} mb-6 shadow-lg`}
        >
          <Text className="text-gray-400 text-xs font-bold uppercase mb-4 tracking-widest">
            Overall Performance
          </Text>
          <View className="flex-row justify-between items-center">
            <View className="items-center flex-1 border-r border-[#4C5361]">
              <Text className={`${theme.accent} text-3xl font-bold`}>
                {stats.average}%
              </Text>
              <Text className="text-gray-400 text-xs mt-1">Average Score</Text>
            </View>
            <View className="items-center flex-1">
              <Text
                className="text-white text-xl font-bold text-center"
                numberOfLines={1}
              >
                {stats.bestSubject}
              </Text>
              <Text className="text-gray-400 text-xs mt-1">Best Subject</Text>
            </View>
          </View>
        </View>

        {/* Subject Filters */}
        <View className="mb-6">
          <FlatList
            horizontal
            data={uniqueSubjects}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedSubject(item)}
                className={`px-5 py-2 rounded-full mr-3 border ${
                  selectedSubject === item
                    ? "bg-[#f49b33] border-[#f49b33]"
                    : "bg-[#333842] border-[#4C5361]"
                }`}
              >
                <Text
                  className={`font-bold ${
                    selectedSubject === item
                      ? "text-[#282C34]"
                      : "text-gray-400"
                  }`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Scores List */}
        <View className="pb-10">
          {filteredScores.length > 0 ? (
            <FlatList
              data={filteredScores}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              scrollEnabled={false}
            />
          ) : (
            <View className="items-center py-10 opacity-50">
              <MaterialCommunityIcons
                name="clipboard-text-off-outline"
                size={60}
                color="gray"
              />
              <Text className="text-gray-400 mt-3 font-medium">
                No test records found.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TestScores;
