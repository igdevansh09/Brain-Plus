import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";

const theme = {
  bg: "bg-[#282C34]",
  card: "bg-[#333842]",
  accent: "text-[#f49b33]",
  accentBg: "bg-[#f49b33]",
  text: "text-white",
  subText: "text-gray-400",
  borderColor: "border-[#4C5361]",
  success: "#4CAF50",
  warning: "#FFC107",
};

const FeeReports = () => {
  const router = useRouter();
  const [fees, setFees] = useState([]);
  const [filteredFees, setFilteredFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedClassFilter, setSelectedClassFilter] = useState("All");

  const [alert, setAlert] = useState({
    visible: false,
    title: "",
    msg: "",
    onConfirm: null,
  });
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });

  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  const FILTER_OPTIONS = [
    "All",
    "Prep",
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th",
    "9th",
    "10th",
    "11th",
    "12th",
    "CS",
  ];

  // --- NATIVE LISTENER ---
  useEffect(() => {
    const unsubscribe = firestore()
      .collection("fees")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        if (!snapshot) return;
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        list.sort((a, b) => (a.status === "Pending" ? -1 : 1));
        setFees(list);
        setLoading(false);
      });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedClassFilter === "All") setFilteredFees(fees);
    else
      setFilteredFees(
        fees.filter((f) => f.studentClass === selectedClassFilter)
      );
  }, [selectedClassFilter, fees]);

  // --- CALCULATE STATS ---
  const totalExpected = filteredFees.reduce(
    (acc, curr) => acc + Number(curr.amount),
    0
  );
  const totalCollected = filteredFees
    .filter((f) => f.status === "Paid")
    .reduce((acc, curr) => acc + Number(curr.amount), 0);
  const collectionRate =
    totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  const handleMarkPaid = (feeId, studentName) => {
    setAlert({
      visible: true,
      title: "Confirm Payment",
      msg: `Mark fee for ${studentName} as PAID?`,
      onConfirm: async () => {
        setAlert({ ...alert, visible: false });
        try {
          await firestore()
            .collection("fees")
            .doc(feeId)
            .update({ status: "Paid", paidAt: new Date().toISOString() });
          showToast("Status updated to Paid.", "success");
        } catch (e) {
          showToast("Error updating fee", "error");
        }
      },
    });
  };

  const handleAutoGenerate = () => {
    const date = new Date();
    const currentTitle = `Tuition Fee - ${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
    setAlert({
      visible: true,
      title: "Generate Fees?",
      msg: `Generate "${currentTitle}" for all verified students?`,
      onConfirm: async () => {
        setAlert({ ...alert, visible: false });
        setGenerating(true);
        try {
          const studentsSnap = await firestore()
            .collection("users")
            .where("role", "==", "student")
            .where("verified", "==", true)
            .get();
          const feesSnap = await firestore()
            .collection("fees")
            .where("title", "==", currentTitle)
            .get();
          const billedIds = feesSnap.docs.map((doc) => doc.data().studentId);
          const batch = firestore().batch();
          let count = 0;

          studentsSnap.forEach((doc) => {
            if (!billedIds.includes(doc.id)) {
              const student = doc.data();
              const newRef = firestore().collection("fees").doc();
              batch.set(newRef, {
                studentId: doc.id,
                studentName: student.name,
                studentClass: student.standard || "N/A",
                title: currentTitle,
                amount: student.monthlyFeeAmount || "5000",
                status: "Pending",
                date: new Date().toLocaleDateString("en-GB"),
                createdAt: firestore.FieldValue.serverTimestamp(),
              });
              count++;
            }
          });

          if (count > 0) {
            await batch.commit();
            showToast(`Billed ${count} students.`, "success");
          } else showToast("All students already billed.", "warning");
        } catch (e) {
          showToast(e.message, "error");
        } finally {
          setGenerating(false);
        }
      },
    });
  };

  const renderFeeItem = ({ item }) => (
    <View
      className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-[#f49b33]/20 items-center justify-center mr-3 border border-[#f49b33]/30">
            <Text className="text-[#f49b33] font-bold">
              {item.studentName.charAt(0)}
            </Text>
          </View>
          <View>
            <Text className="text-white font-bold text-base" numberOfLines={1}>
              {item.studentName}
            </Text>
            <Text className="text-gray-400 text-xs">
              Class {item.studentClass} • {item.date}
            </Text>
          </View>
        </View>
        <View
          className={`px-3 py-1 rounded-full ${item.status === "Paid" ? "bg-green-500/20" : "bg-yellow-500/20"}`}
        >
          <Text
            className={`text-[10px] font-bold ${item.status === "Paid" ? "text-green-400" : "text-yellow-400"}`}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text className="text-gray-300 text-sm mb-3 italic">{item.title}</Text>

      <View className="flex-row justify-between items-center pt-3 border-t border-[#4C5361]/30">
        <Text className="text-[#f49b33] text-xl font-bold">₹{item.amount}</Text>
        {item.status === "Pending" && (
          <TouchableOpacity
            onPress={() => handleMarkPaid(item.id, item.studentName)}
            className="bg-green-600 px-4 py-2 rounded-xl flex-row items-center"
          >
            <Ionicons
              name="card-outline"
              size={16}
              color="white"
              className="mr-2"
            />
            <Text className="text-white font-bold text-xs ml-1">Receive</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />
      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.msg}
        onCancel={() => setAlert({ ...alert, visible: false })}
        onConfirm={alert.onConfirm}
      />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* --- HEADER --- */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Fee Ledger</Text>
        <View className="w-10" />
      </View>

      {/* --- REVENUE DASHBOARD --- */}
      <View className="px-5 mb-6">
        <View
          className={`${theme.card} p-5 rounded-3xl border ${theme.borderColor} shadow-lg relative overflow-hidden`}
        >
          <View className="flex-row justify-between items-end mb-4">
            <View>
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">
                Total Collected
              </Text>
              <Text className="text-white text-4xl font-black">
                ₹{totalCollected}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-400 text-[10px] mb-1">
                Expected: ₹{totalExpected}
              </Text>
              <Text className={`${theme.accent} font-bold`}>
                {Math.round(collectionRate)}% Paid
              </Text>
            </View>
          </View>
          {/* Progress Bar */}
          <View className="h-2 w-full bg-[#282C34] rounded-full overflow-hidden">
            <View
              style={{ width: `${collectionRate}%` }}
              className="h-full bg-[#f49b33]"
            />
          </View>
        </View>
      </View>

      {/* --- FILTERS --- */}
      <View className="px-5 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_OPTIONS.map((cls) => (
            <TouchableOpacity
              key={cls}
              onPress={() => setSelectedClassFilter(cls)}
              className={`mr-2 px-5 py-2 rounded-2xl border ${selectedClassFilter === cls ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-[#4C5361]"}`}
            >
              <Text
                className={`${selectedClassFilter === cls ? "text-[#282C34] font-bold" : "text-gray-400"}`}
              >
                {cls}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
      ) : (
        <FlatList
          data={filteredFees}
          keyExtractor={(item) => item.id}
          renderItem={renderFeeItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons name="receipt" size={80} color="gray" />
              <Text className="text-white text-center mt-4">
                No records found for this class.
              </Text>
            </View>
          )}
        />
      )}

      {/* --- FAB AUTO GENERATE --- */}
      <TouchableOpacity
        onPress={handleAutoGenerate}
        disabled={generating}
        className="absolute bottom-8 right-8 bg-[#f49b33] w-16 h-16 rounded-2xl items-center justify-center shadow-xl"
      >
        {generating ? (
          <ActivityIndicator size="small" color="#282C34" />
        ) : (
          <Ionicons name="flash" size={30} color="#282C34" />
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default FeeReports;
