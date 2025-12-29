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

  // --- 1. DATA FETCHING ---
  const fetchScores = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      // Assuming 'test_results' collection has fields: studentId, subject, testName, marksObtained, totalMarks, date
      const snapshot = await firestore()
        .collection("test_results")
        .where("studentId", "==", user.uid)
        .orderBy("date", "desc")
        .get();

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setScores(data);
    } catch (error) {
      console.log("Error fetching scores:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  // --- 2. COMPUTED DATA (MEMOIZED) ---
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
      return sum + (item.marksObtained / item.totalMarks) * 100;
    }, 0);

    // Calculate Best Subject based on average percentage per subject
    const subjectPerformance = {};
    scores.forEach((s) => {
      const pct = (s.marksObtained / s.totalMarks) * 100;
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
    const percentage = (item.marksObtained / item.totalMarks) * 100;
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
              {item.subject} •{" "}
              {new Date(
                item.date?.toDate ? item.date.toDate() : item.date
              ).toLocaleDateString()}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-white font-bold text-xl">
              {item.marksObtained}
              <Text className="text-gray-500 text-sm">/{item.totalMarks}</Text>
            </Text>
            <Text style={{ color: color }} className="text-xs font-bold">
              {percentage.toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="h-2 bg-[#282C34] rounded-full overflow-hidden mt-2">
          <View
            style={{ width: `${percentage}%`, backgroundColor: color }}
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
    <SafeAreaView className={`flex-1 ${theme.bg} pt-8`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      {/* Header */}
      <View className="px-5 pt-4 pb-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361] mr-4"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Test Scores</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Performance Summary Card */}
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
