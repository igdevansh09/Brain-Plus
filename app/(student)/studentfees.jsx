import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
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
  updateDoc,
} from "firebase/firestore";

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";

const StudentFees = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pendingFees, setPendingFees] = useState([]);
  const [historyFees, setHistoryFees] = useState([]);
  const [studentData, setStudentData] = useState(null);

  // --- UI STATE ---
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertData, setAlertData] = useState({ title: "", message: "" });
  const [pendingPaymentItem, setPendingPaymentItem] = useState(null);

  const colors = {
    bg: "#282C34",
    card: "#333842",
    accent: "#f49b33",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    dueRed: "#F44336",
    paidGreen: "#4CAF50",
  };

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchFees = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setStudentData(userDoc.data());
      }

      const q = query(
        collection(db, "fees"),
        where("studentId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const allFees = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const pending = allFees.filter((f) => f.status === "Pending");
      const history = allFees.filter((f) => f.status === "Paid");

      pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setPendingFees(pending);
      setHistoryFees(history);
    } catch (error) {
      console.log("Error fetching fees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFees();
    setRefreshing(false);
  }, []);

  const initiatePayment = (fee) => {
    setPendingPaymentItem(fee);
    setAlertData({
      title: "Pay Fee",
      message: `Proceed to pay ₹${fee.amount} for ${fee.title}?`,
    });
    setAlertVisible(true);
  };

  const processPayment = () => {
    setAlertVisible(false);
    if (!pendingPaymentItem) return;

    showToast("Payment integration removed.", "info");
  };

  const renderDueFee = ({ item }) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => initiatePayment(item)}
      activeOpacity={0.8}
      style={{ backgroundColor: colors.card, borderColor: colors.dueRed }}
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
            Due since: {item.date}
          </Text>
        </View>
        <View className="items-end">
          <Text style={{ color: colors.dueRed }} className="text-2xl font-bold">
            ₹{item.amount}
          </Text>
          <View className="bg-red-500/20 px-2 py-1 rounded mt-1">
            <Text
              style={{ color: colors.dueRed, fontSize: 10, fontWeight: "bold" }}
            >
              TAP TO PAY
            </Text>
          </View>
        </View>
      </View>
      <View className="mt-2 pt-2 border-t border-[#4C5361] flex-row justify-between items-center">
        <Text
          style={{ color: colors.dueRed, fontStyle: "italic", fontSize: 12 }}
        >
          Status: Pending
        </Text>
        <Text style={{ color: colors.subText, fontSize: 10 }}>
          Online Payment
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderHistoryFee = ({ item }) => (
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
        <Text style={{ color: colors.subText }} className="text-sm">
          Paid on:{" "}
          {item.paidAt ? new Date(item.paidAt).toLocaleDateString() : item.date}
        </Text>
      </View>
      <View className="items-end">
        <Text style={{ color: colors.paidGreen }} className="text-lg font-bold">
          ₹{item.amount}
        </Text>
        <Text
          style={{ color: colors.paidGreen, fontSize: 10, fontWeight: "bold" }}
        >
          PAID
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

      <CustomToast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertData.title}
        message={alertData.message}
        confirmText="Pay Now"
        cancelText="Cancel"
        type="warning"
        onCancel={() => setAlertVisible(false)}
        onConfirm={processPayment}
      />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={{ color: colors.text }}
          className="text-2xl font-semibold ml-4"
        >
          Fee Status
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
            Pending Dues
          </Text>

          {pendingFees.length > 0 ? (
            pendingFees.map((item) => renderDueFee({ item }))
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
                No Dues
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
          {historyFees.length > 0 ? (
            historyFees.map((item) => renderHistoryFee({ item }))
          ) : (
            <Text
              style={{ color: colors.subText }}
              className="text-center italic"
            >
              No payment history found.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default StudentFees;
