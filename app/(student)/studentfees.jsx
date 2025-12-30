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
  Modal,
  Image, // <--- ADDED IMPORT
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// --- NATIVE SDK IMPORTS ---
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";

const StudentFees = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pendingFees, setPendingFees] = useState([]);
  const [historyFees, setHistoryFees] = useState([]);

  // --- PAYMENT MODAL STATE ---
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // --- UI STATE ---
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });

  const colors = {
    bg: "#282C34",
    card: "#333842",
    accent: "#f49b33",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    dueRed: "#F44336",
    paidGreen: "#4CAF50",
    verifyBlue: "#29B6F6",
  };

  const showToast = (msg, type = "success") => {
    setToast({ visible: true, msg, type });
  };

  const fetchFees = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      const querySnapshot = await firestore()
        .collection("fees")
        .where("studentId", "==", user.uid)
        .get();

      const allFees = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const pending = allFees.filter(
        (f) => f.status === "Pending" || f.status === "Verifying"
      );
      const history = allFees.filter((f) => f.status === "Paid");

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

  const openPaymentModal = (fee) => {
    if (fee.status === "Verifying") {
      showToast("Already under verification.", "info");
      return;
    }
    setSelectedFee(fee);
    setPayModalVisible(true);
  };

  const handleSubmitProof = async () => {
    setSubmitting(true);
    try {
      await firestore().collection("fees").doc(selectedFee.id).update({
        status: "Verifying",
        submittedAt: new Date().toISOString(),
      });

      showToast("Submitted for verification!", "success");
      setPayModalVisible(false);
      fetchFees();
    } catch (e) {
      showToast("Submission failed.", "error");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const renderDueFee = ({ item }) => {
    const isVerifying = item.status === "Verifying";
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => openPaymentModal(item)}
        activeOpacity={0.9}
        style={{
          backgroundColor: colors.card,
          borderColor: isVerifying ? colors.verifyBlue : colors.dueRed,
        }}
        className="p-4 rounded-xl mb-3 border"
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
              Due Date: {item.date}
            </Text>
          </View>
          <View className="items-end">
            <Text
              style={{ color: isVerifying ? colors.verifyBlue : colors.dueRed }}
              className="text-2xl font-bold"
            >
              ₹{item.amount}
            </Text>

            {isVerifying ? (
              <View className="bg-blue-500/20 px-2 py-1 rounded mt-1">
                <Text
                  style={{
                    color: colors.verifyBlue,
                    fontSize: 10,
                    fontWeight: "bold",
                  }}
                >
                  WAITING APPROVAL
                </Text>
              </View>
            ) : (
              <View className="bg-red-500/20 px-2 py-1 rounded mt-1">
                <Text
                  style={{
                    color: colors.dueRed,
                    fontSize: 10,
                    fontWeight: "bold",
                  }}
                >
                  TAP TO PAY
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
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
            <View className="p-5 items-center justify-center bg-[#333842] rounded-xl">
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
            historyFees.map((item) => (
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
                    {item.paidAt
                      ? new Date(item.paidAt).toLocaleDateString()
                      : item.date}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    style={{ color: colors.paidGreen }}
                    className="text-lg font-bold"
                  >
                    ₹{item.amount}
                  </Text>
                  <Text
                    style={{
                      color: colors.paidGreen,
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  >
                    PAID
                  </Text>
                </View>
              </View>
            ))
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

      {/* --- OFFLINE PAYMENT MODAL --- */}
      <Modal visible={payModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-center p-5">
          <View className="bg-[#333842] p-6 rounded-2xl border border-[#f49b33]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">
                Scan to Pay: ₹{selectedFee?.amount}
              </Text>
              <TouchableOpacity onPress={() => setPayModalVisible(false)}>
                <Ionicons name="close" size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-400 text-sm mb-4">
              1. Take the screenshot of the QR Code below with any UPI App.{"\n"}
              2. Complete the payment.{"\n"}
              3. Click &quot;Submit&quot; below.
            </Text>

            {/* --- QR CODE DISPLAY --- */}
            <View className="bg-white p-4 rounded-xl mb-4 items-center justify-center self-center overflow-hidden">
              {/* MAKE SURE TO ADD 'qr_code.png' TO ASSETS/IMAGES */}
              <Image
                source={require("../../assets/images/qr_code.png")}
                style={{ width: 200, height: 200 }}
                resizeMode="contain"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmitProof}
              disabled={submitting}
              className="w-full bg-[#f49b33] p-4 rounded-xl items-center"
            >
              {submitting ? (
                <ActivityIndicator color="#282C34" />
              ) : (
                <Text className="text-[#282C34] font-bold text-lg">
                  Submit
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default StudentFees;