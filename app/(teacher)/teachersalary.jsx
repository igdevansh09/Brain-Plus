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
import { auth, db } from "../../config/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

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
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "salaries"),
        where("teacherId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const allSalaries = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const pending = allSalaries.filter((s) => s.status === "Pending");
      const history = allSalaries.filter((s) => s.status === "Paid");

      pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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

  const renderPendingItem = ({ item }) => (
    <View
      key={item.id}
      style={{ backgroundColor: colors.card, borderColor: colors.unpaidRed }}
      className="p-4 rounded-xl mb-3 border border-1"
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-1 pr-3">
          <Text
            style={{ color: colors.text }}
            className="text-lg font-semibold"
          >
            {item.title}
          </Text>
          <Text style={{ color: colors.subText, fontSize: 12 }}>
            Generated: {item.date}
          </Text>
        </View>
        <Text
          style={{ color: colors.unpaidRed }}
          className="text-2xl font-bold"
        >
          ₹{item.amount}
        </Text>
      </View>
      <View className="mt-2 pt-2 border-t border-[#4C5361] flex-row justify-between items-center">
        <Text
          style={{ color: colors.unpaidRed, fontStyle: "italic", fontSize: 12 }}
        >
          Status: Unpaid
        </Text>
        <Text style={{ color: colors.subText, fontSize: 10 }}>
          Contact Admin
        </Text>
      </View>
    </View>
  );

  const renderHistoryItem = ({ item }) => (
    <View
      key={item.id}
      style={{ backgroundColor: colors.card }}
      className="p-4 rounded-xl mb-3 flex-row justify-between items-center border border-[#4C5361]"
    >
      <View>
        <Text
          style={{ color: colors.text }}
          className="text-base font-semibold"
        >
          {item.title}
        </Text>
        <Text style={{ color: colors.subText, fontSize: 12 }}>
          Received:{" "}
          {item.paidAt ? new Date(item.paidAt).toLocaleDateString() : item.date}
        </Text>
      </View>
      <View className="items-end">
        <Text style={{ color: colors.paidGreen }} className="text-lg font-bold">
          ₹{item.amount}
        </Text>
        <View className="bg-green-900/30 px-2 py-0.5 rounded mt-1">
          <Text
            style={{
              color: colors.paidGreen,
              fontSize: 10,
              fontWeight: "bold",
            }}
          >
            CREDITED
          </Text>
        </View>
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
        <View className="mb-6">
          <Text
            style={{ color: colors.accent }}
            className="text-xl font-semibold mb-3"
          >
            Pending Payments
          </Text>
          {pendingSalaries.length > 0 ? (
            pendingSalaries.map((item) => renderPendingItem({ item }))
          ) : (
            <View
              className="p-5 items-center justify-center"
              style={{ backgroundColor: colors.card, borderRadius: 12 }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={40}
                color={colors.paidGreen}
              />
              <Text
                style={{ color: colors.text }}
                className="mt-2 text-lg font-semibold"
              >
                All Cleared
              </Text>
              <Text style={{ color: colors.subText }} className="text-xs">
                No pending dues from the institute.
              </Text>
            </View>
          )}
        </View>

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
              No payment history yet.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherSalary;
