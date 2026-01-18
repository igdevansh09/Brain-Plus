import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import ScreenWrapper from "../../components/ScreenWrapper"; // <--- IMPORTED
import CustomHeader from "../../components/CustomHeader"; // <--- IMPORTED

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  query,
  where,
  getDocs,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

const TeacherSalary = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSalaries, setPendingSalaries] = useState([]);
  const [salaryHistory, setSalaryHistory] = useState([]);

  // --- FETCH SALARIES (MODULAR) ---
  const fetchSalaries = async () => {
    try {
      // Modular: Access currentUser property directly
      const user = auth.currentUser;
      if (!user) return;

      // Modular: query(collection, where)
      const q = query(
        collection(db, "salaries"),
        where("teacherId", "==", user.uid),
      );

      // Modular: getDocs
      const querySnapshot = await getDocs(q);

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
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: theme.border,
      }}
      className="p-4 rounded-xl mb-3 border"
    >
      <View className="flex-row justify-between mb-2">
        <View>
          <Text
            style={{ color: theme.textPrimary }}
            className="text-base font-semibold"
          >
            {item.title}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            Received:{" "}
            {item.paidAt
              ? new Date(item.paidAt).toLocaleDateString()
              : item.date}
          </Text>
        </View>
        <Text
          style={{ color: theme.successBright }}
          className="text-lg font-bold"
        >
          ₹{item.amount}
        </Text>
      </View>
    </View>
  );

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

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {/* Pending Section */}
        <View className="mb-6">
          <Text
            style={{ color: theme.accent }}
            className="text-xl font-semibold mb-3"
          >
            Pending Payments
          </Text>
          {pendingSalaries.length > 0 ? (
            pendingSalaries.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: theme.bgSecondary,
                  borderColor: theme.error,
                }}
                className="p-4 rounded-xl mb-3 border"
              >
                <View className="flex-row justify-between items-center">
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="text-lg font-semibold"
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{ color: theme.errorBright }}
                    className="text-2xl font-bold"
                  >
                    ₹{item.amount}
                  </Text>
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  Generated: {item.date}
                </Text>
              </View>
            ))
          ) : (
            <View
              style={{ backgroundColor: theme.bgSecondary }}
              className="p-5 items-center justify-center rounded-xl"
            >
              <Text style={{ color: theme.textMuted }}>No pending dues.</Text>
            </View>
          )}
        </View>

        {/* History Section */}
        <View className="mb-8">
          <Text
            style={{ color: theme.accent }}
            className="text-xl font-semibold mb-3"
          >
            Payment History
          </Text>
          {salaryHistory.length > 0 ? (
            salaryHistory.map((item) => renderHistoryItem({ item }))
          ) : (
            <Text
              style={{ color: theme.textMuted }}
              className="text-center italic"
            >
              No history found.
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default TeacherSalary;
