import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  RefreshControl,
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
} from "firebase/firestore";

const StudentTestScores = () => {
  const router = useRouter();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const colors = {
    bg: "#282C34",
    card: "#333842",
    accent: "#f49b33",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    pass: "#4CAF50",
    fail: "#F44336",
  };

  const fetchScores = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) return;

      const studentClass = userDoc.data().standard;

      if (studentClass) {
        const q = query(
          collection(db, "exam_results"),
          where("classId", "==", studentClass)
        );

        const querySnapshot = await getDocs(q);
        const myResults = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.results && data.results[user.uid] !== undefined) {
            myResults.push({
              id: doc.id,
              examTitle: data.examTitle,
              date: data.date,
              maxScore: data.maxScore,
              myScore: data.results[user.uid],
              createdAt: data.createdAt,
            });
          }
        });

        myResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setScores(myResults);
      }
    } catch (error) {
      console.log("Error fetching scores:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchScores();
    setRefreshing(false);
  }, []);

  const renderScoreCard = ({ item }) => {
    const percentage = (item.myScore / item.maxScore) * 100;
    const isPass = percentage >= 33; 
    const resultColor = isPass ? colors.pass : colors.fail;

    return (
      <View
        style={{ backgroundColor: colors.card, borderLeftColor: resultColor }}
        className="p-4 rounded-xl mb-3 flex-row justify-between border-l-4"
      >
        <View className="flex-1 pr-3">
          <Text
            style={{ color: colors.text }}
            className="text-lg font-semibold"
          >
            {item.examTitle}
          </Text>
          <Text style={{ color: colors.subText }} className="text-xs mt-1">
            Date: {item.date}
          </Text>
          <Text
            style={{ color: resultColor }}
            className="text-xs font-bold mt-2"
          >
            {isPass ? "PASS" : "FAIL"}
          </Text>
        </View>

        <View className="items-end justify-center">
          <Text style={{ color: colors.text }} className="text-3xl font-bold">
            {item.myScore}
          </Text>
          <Text style={{ color: colors.subText }} className="text-xs">
            / {item.maxScore}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      className="pt-8"
    >
      <StatusBar backgroundColor={colors.bg} barStyle="light-content" />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <Ionicons
          name="arrow-back"
          size={24}
          color={colors.text}
          onPress={() => router.back()}
        />
        <Text
          style={{ color: colors.text }}
          className="text-2xl font-semibold ml-4"
        >
          Test Scores
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.accent}
          className="mt-10"
        />
      ) : (
        <FlatList
          data={scores}
          keyExtractor={(item) => item.id}
          renderItem={renderScoreCard}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={() => (
            <View className="items-center justify-center mt-20">
              <Ionicons
                name="bar-chart-outline"
                size={50}
                color={colors.subText}
              />
              <Text className="text-gray-500 text-center mt-4">
                No test results available yet.
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default StudentTestScores;
