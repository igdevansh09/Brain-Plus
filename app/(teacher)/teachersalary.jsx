import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// --- NATIVE SDK IMPORTS (FIXED) ---
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const TeacherSalary = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSalaries, setPendingSalaries] = useState([]);
  const [salaryHistory, setSalaryHistory] = useState([]);

  const colors = {
    bg: "#282C34",
    card: "#333842",
    accent: "#f49b33",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    unpaidRed: "#F44336",
    paidGreen: "#4CAF50",
  };

  const fetchSalaries = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      // NATIVE SDK SYNTAX
      const querySnapshot = await firestore()
        .collection("salaries")
        .where("teacherId", "==", user.uid)
        .get();

      const allSalaries = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const pending = allSalaries.filter((s) => s.status === "Pending");
      const history = allSalaries.filter((s) => s.status === "Paid");

      // Sort
      pending.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateA - dateB;
      });
      history.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });

      setPendingSalaries(pending);
      setSalaryHistory(history);
    } catch (error) {
      console.log("Error fetching salaries:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaries();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSalaries();
    setRefreshing(false);
  }, []);

  const renderHistoryItem = ({ item }) => (
    <View
      key={item.id}
      style={{ backgroundColor: colors.card }}
      className="p-4 rounded-xl mb-3 border border-[#4C5361]"
    >
      <View className="flex-row justify-between mb-2">
        <View>
          <Text
            style={{ color: colors.text }}
            className="text-base font-semibold"
          >
            {item.title}
          </Text>
          <Text style={{ color: colors.subText, fontSize: 12 }}>
            Received:{" "}
            {item.paidAt
              ? new Date(item.paidAt).toLocaleDateString()
              : item.date}
          </Text>
        </View>
        <Text style={{ color: colors.paidGreen }} className="text-lg font-bold">
          ₹{item.amount}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${colors.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

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
          My Salary
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Pending Section */}
        <View className="mb-6">
          <Text
            style={{ color: colors.accent }}
            className="text-xl font-semibold mb-3"
          >
            Pending Payments
          </Text>
          {pendingSalaries.length > 0 ? (
            pendingSalaries.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.unpaidRed,
                }}
                className="p-4 rounded-xl mb-3 border"
              >
                <View className="flex-row justify-between items-center">
                  <Text
                    style={{ color: colors.text }}
                    className="text-lg font-semibold"
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{ color: colors.unpaidRed }}
                    className="text-2xl font-bold"
                  >
                    ₹{item.amount}
                  </Text>
                </View>
                <Text style={{ color: colors.subText, fontSize: 12 }}>
                  Generated: {item.date}
                </Text>
              </View>
            ))
          ) : (
            <View className="p-5 items-center justify-center bg-[#333842] rounded-xl">
              <Text style={{ color: colors.text }}>No pending dues.</Text>
            </View>
          )}
        </View>

        {/* History Section */}
        <View className="mb-8">
          <Text
            style={{ color: colors.accent }}
            className="text-xl font-semibold mb-3"
          >
            Payment History
          </Text>
          {salaryHistory.length > 0 ? (
            salaryHistory.map((item) => renderHistoryItem({ item }))
          ) : (
            <Text
              style={{ color: colors.subText }}
              className="text-center italic"
            >
              No history found.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherSalary;
