import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import initialized instances
// --- REFACTOR END ---

import CustomToast from "../../components/CustomToast";

const StudentFees = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
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

  const showToast = (msg, type = "success") => {
    setToast({ visible: true, msg, type });
  };

  // --- FETCH FEES (MODULAR) ---
  const fetchFees = async () => {
    try {
      // Modular: Access currentUser property directly
      const user = auth.currentUser;
      if (!user) return;

      // Modular: query(collection, where)
      const q = query(
        collection(db, "fees"),
        where("studentId", "==", user.uid)
      );

      // Modular: getDocs
      const querySnapshot = await getDocs(q);

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

  // --- SUBMIT PROOF (MODULAR) ---
  const handleSubmitProof = async () => {
    setSubmitting(true);
    try {
      // Modular: updateDoc(doc(db, ...))
      const feeRef = doc(db, "fees", selectedFee.id);
      await updateDoc(feeRef, {
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
          backgroundColor: theme.bgSecondary,
          borderColor: isVerifying ? theme.verifyBlue : theme.dueRed,
        }}
        className="p-4 rounded-xl mb-3 border"
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-1 pr-3">
            <Text
              style={{ color: theme.textPrimary }}
              className="text-lg font-semibold"
            >
              {item.title}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
              Due Date: {item.date}
            </Text>
          </View>
          <View className="items-end">
            <Text
              style={{ color: isVerifying ? theme.verifyBlue : theme.dueRed }}
              className="text-2xl font-bold"
            >
              ₹{item.amount}
            </Text>

            {isVerifying ? (
              <View
                style={{ backgroundColor: theme.infoSoft }}
                className="px-2 py-1 rounded mt-1"
              >
                <Text
                  style={{
                    color: theme.verifyBlue,
                    fontSize: 10,
                    fontWeight: "bold",
                  }}
                >
                  WAITING APPROVAL
                </Text>
              </View>
            ) : (
              <View
                style={{ backgroundColor: theme.errorSoft }}
                className="px-2 py-1 rounded mt-1"
              >
                <Text
                  style={{
                    color: theme.dueRed,
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
        style={{ backgroundColor: theme.bgPrimary }}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.bgPrimary }}
    >
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
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
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        <View className="mb-6">
          <Text
            style={{ color: theme.accent }}
            className="text-xl font-semibold mb-3"
          >
            Pending Dues
          </Text>
          {pendingFees.length > 0 ? (
            pendingFees.map((item) => renderDueFee({ item }))
          ) : (
            <View
              style={{ backgroundColor: theme.bgSecondary }}
              className="p-5 items-center justify-center rounded-xl"
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={40}
                color={theme.paidGreen}
              />
              <Text
                style={{ color: theme.textPrimary }}
                className="mt-2 text-lg font-semibold"
              >
                No Dues
              </Text>
            </View>
          )}
        </View>

        <View className="mb-8">
          <Text
            style={{ color: theme.accent }}
            className="text-xl font-semibold mb-3"
          >
            Payment History
          </Text>
          {historyFees.length > 0 ? (
            historyFees.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: theme.bgSecondary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl mb-3 flex-row justify-between items-center border"
              >
                <View>
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="text-base font-semibold"
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{ color: theme.textSecondary }}
                    className="text-sm"
                  >
                    Paid on:{" "}
                    {item.paidAt
                      ? new Date(item.paidAt).toLocaleDateString()
                      : item.date}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    style={{ color: theme.paidGreen }}
                    className="text-lg font-bold"
                  >
                    ₹{item.amount}
                  </Text>
                  <Text
                    style={{
                      color: theme.paidGreen,
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
              style={{ color: theme.textMuted }}
              className="text-center italic"
            >
              No payment history found.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* --- OFFLINE PAYMENT MODAL --- */}
      <Modal visible={payModalVisible} animationType="slide" transparent>
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center p-5"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="p-6 rounded-2xl border"
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text
                style={{ color: theme.textPrimary }}
                className="text-xl font-bold"
              >
                Scan to Pay: ₹{selectedFee?.amount}
              </Text>
              <TouchableOpacity onPress={() => setPayModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text
              style={{ color: theme.textSecondary }}
              className="text-sm mb-4"
            >
              1. Take the screenshot of the QR Code below with any UPI App.
              {"\n"}
              2. Complete the payment.{"\n"}
              3. Click &quot;Submit&quot; below.
            </Text>

            {/* --- QR CODE DISPLAY --- */}
            <View className="bg-white p-4 rounded-xl mb-4 items-center justify-center self-center overflow-hidden">
              <Image
                source={require("../../assets/images/qr_code.png")}
                style={{ width: 200, height: 200 }}
                resizeMode="contain"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmitProof}
              disabled={submitting}
              style={{ backgroundColor: theme.accent }}
              className="w-full p-4 rounded-xl items-center"
            >
              {submitting ? (
                <ActivityIndicator color={theme.textDark} />
              ) : (
                <Text
                  style={{ color: theme.textDark }}
                  className="font-bold text-lg"
                >
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