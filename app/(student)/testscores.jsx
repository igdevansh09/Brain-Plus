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
import { useTheme } from "../../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

const TestScores = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");

  // --- 1. DATA FETCHING (MODULAR) ---
  const fetchScores = async () => {
    try {
      // Modular: auth.currentUser
      const user = auth.currentUser;
      if (!user) return;

      console.log("Fetching profile for:", user.uid);

      // A. Get Student's Class (Standard) first
      // Modular: doc + getDoc
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const studentClass = userDoc.data()?.standard;

      if (!studentClass) {
        console.log("Student has no class assigned.");
        setLoading(false);
        return;
      }

      console.log("Fetching exams for class:", studentClass);

      // B. Fetch Exams for this Class from 'exam_results'
      // Modular: query + getDocs
      const q = query(
        collection(db, "exam_results"),
        where("classId", "==", studentClass)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log("No exams found for class:", studentClass);
      }

      // C. Filter and Extract THIS student's score
      const data = snapshot.docs
        .map((docSnap) => {
          const exam = docSnap.data();
          // The teacher saves scores in a map: { "uid123": 85, "uid456": 90 }
          const myScore = exam.results ? exam.results[user.uid] : null;

          // Only show exams where this student has a score
          if (myScore !== null && myScore !== undefined && myScore !== "") {
            return {
              id: docSnap.id,
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
          // Handle Firestore Timestamp if present (rare case here but good safety)
          if (str.toDate) return str.toDate();
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
    return theme.error;
  };

  const renderItem = useCallback(
    ({ item }) => {
      const obt = parseFloat(item.marksObtained) || 0;
      const tot = parseFloat(item.totalMarks) || 100;
      const percentage = (obt / tot) * 100;
      const color = getGradeColor(percentage);

      return (
        <View
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="rounded-2xl p-4 mb-4 border"
        >
          <View className="flex-row justify-between items-start mb-2">
            <View>
              <Text
                style={{ color: theme.textPrimary }}
                className="font-bold text-lg"
              >
                {item.testName}
              </Text>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs mt-1"
              >
                {item.subject} • {item.date}
              </Text>
            </View>
            <View className="items-end">
              <Text
                style={{ color: theme.textPrimary }}
                className="font-bold text-xl"
              >
                {obt}
                <Text style={{ color: theme.textMuted }} className="text-sm">
                  /{tot}
                </Text>
              </Text>
              <Text style={{ color: color }} className="text-xs font-bold">
                {percentage.toFixed(0)}%
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View
            style={{ backgroundColor: theme.bgTertiary }}
            className="h-2 rounded-full overflow-hidden mt-2"
          >
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
    },
    [theme]
  );

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
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="p-2 rounded-full border mr-4"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-2xl font-bold"
        >
          Test Scores
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Performance Summary */}
        <View
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          }}
          className="p-5 rounded-2xl border mb-6 shadow-lg"
        >
          <Text
            style={{ color: theme.textSecondary }}
            className="text-xs font-bold uppercase mb-4 tracking-widest"
          >
            Overall Performance
          </Text>
          <View className="flex-row justify-between items-center">
            <View
              style={{ borderColor: theme.border }}
              className="items-center flex-1 border-r"
            >
              <Text
                style={{ color: theme.accent }}
                className="text-3xl font-bold"
              >
                {stats.average}%
              </Text>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs mt-1"
              >
                Average Score
              </Text>
            </View>
            <View className="items-center flex-1">
              <Text
                style={{ color: theme.textPrimary }}
                className="text-xl font-bold text-center"
                numberOfLines={1}
              >
                {stats.bestSubject}
              </Text>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs mt-1"
              >
                Best Subject
              </Text>
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
                style={{
                  backgroundColor:
                    selectedSubject === item ? theme.accent : theme.bgSecondary,
                  borderColor:
                    selectedSubject === item ? theme.accent : theme.border,
                }}
                className="px-5 py-2 rounded-full mr-3 border"
              >
                <Text
                  style={{
                    color:
                      selectedSubject === item
                        ? theme.textDark
                        : theme.textSecondary,
                  }}
                  className="font-bold"
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
                color={theme.textMuted}
              />
              <Text
                style={{ color: theme.textMuted }}
                className="mt-3 font-medium"
              >
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
 
