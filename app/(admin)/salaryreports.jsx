import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// NATIVE SDK
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

const TeacherSalaryReports = () => {
  const router = useRouter();
  const [salaries, setSalaries] = useState([]);
  const [filteredSalaries, setFilteredSalaries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manual Entry States
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  // Data for Modals
  const [commissionTeachers, setCommissionTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);

  // Filter State
  const [selectedFilter, setSelectedFilter] = useState("All"); // All, Pending, Paid

  // UI Feedback
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

  const FILTER_OPTIONS = ["All", "Pending", "Paid"];

  // --- 1. LISTEN TO SALARIES ---
  useEffect(() => {
    const unsubscribe = firestore()
      .collection("salaries")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        if (!snapshot) return;
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Sort: Pending first
        list.sort((a, b) => (a.status === "Pending" ? -1 : 1));
        setSalaries(list);
        setLoading(false);
      });
    return () => unsubscribe();
  }, []);

  // --- 2. FILTER LOGIC ---
  useEffect(() => {
    if (selectedFilter === "All") {
      setFilteredSalaries(salaries);
    } else {
      setFilteredSalaries(salaries.filter((s) => s.status === selectedFilter));
    }
  }, [selectedFilter, salaries]);

  // --- 3. FETCH COMMISSION TEACHERS (For Manual Entry) ---
  useEffect(() => {
    if (isAdding) {
      const fetchTeachers = async () => {
        setLoadingTeachers(true);
        try {
          const snap = await firestore()
            .collection("users")
            .where("role", "==", "teacher")
            .where("verified", "==", true)
            .where("salaryType", "==", "Commission") // Strict Filter
            .get();

          const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setCommissionTeachers(list);
        } catch (e) {
          console.log(e);
        } finally {
          setLoadingTeachers(false);
        }
      };
      fetchTeachers();
    }
  }, [isAdding]);

  // --- ACTIONS ---
  const handleMarkPaid = (id, name) => {
    setAlert({
      visible: true,
      title: "Confirm Payment",
      msg: `Mark salary for ${name} as PAID?`,
      onConfirm: async () => {
        setAlert({ ...alert, visible: false });
        try {
          await firestore().collection("salaries").doc(id).update({
            status: "Paid",
            paidAt: new Date().toISOString(),
          });
          showToast("Salary marked as paid.", "success");
        } catch (e) {
          showToast("Update failed.", "error");
        }
      },
    });
  };

  const handleCallTeacher = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
    else showToast("Phone number not available", "error");
  };

  const handleRecordManual = async () => {
    if (!selectedTeacher || !title.trim() || !amount.trim()) {
      showToast("Please fill all fields.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await firestore()
        .collection("salaries")
        .add({
          teacherId: selectedTeacher.id,
          teacherName: selectedTeacher.name,
          teacherEmail: selectedTeacher.email,
          teacherPhone: selectedTeacher.phone || "",
          title: title,
          amount: amount,
          status: "Pending",
          date: new Date().toLocaleDateString("en-GB"),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      setIsAdding(false);
      setSelectedTeacher(null);
      setTitle("");
      setAmount("");
      showToast("Commission added successfully!", "success");
    } catch (e) {
      showToast("Failed to record.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // --- CALCULATE STATS ---
  const totalPayout = filteredSalaries
    .filter((s) => s.status === "Paid")
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const pendingPayout = filteredSalaries
    .filter((s) => s.status === "Pending")
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const totalLiability = totalPayout + pendingPayout;
  const payoutRate =
    totalLiability > 0 ? (totalPayout / totalLiability) * 100 : 0;

  // --- RENDER ITEM ---
  const renderSalaryItem = ({ item }) => (
    <View
      className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          {/* Avatar */}
          <View className="w-10 h-10 rounded-full bg-[#f49b33]/20 items-center justify-center mr-3 border border-[#f49b33]/30">
            <Text className="text-[#f49b33] font-bold">
              {item.teacherName.charAt(0)}
            </Text>
          </View>
          <View>
            <Text className="text-white font-bold text-base" numberOfLines={1}>
              {item.teacherName}
            </Text>
            <Text className="text-gray-400 text-xs">{item.date}</Text>
          </View>
        </View>
        {/* Badge */}
        <View
          className={`px-3 py-1 rounded-full ${item.status === "Paid" ? "bg-green-500/20" : "bg-red-500/20"}`}
        >
          <Text
            className={`text-[10px] font-bold ${item.status === "Paid" ? "text-green-400" : "text-red-400"}`}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text className="text-gray-300 text-sm mb-3 italic">{item.title}</Text>

      <View className="flex-row justify-between items-center pt-3 border-t border-[#4C5361]/30">
        <Text className="text-[#f49b33] text-xl font-bold">₹{item.amount}</Text>

        <View className="flex-row items-center gap-2">
          {item.status === "Pending" && (
            <>
              <TouchableOpacity
                onPress={() => handleCallTeacher(item.teacherPhone)}
                className="bg-blue-600 w-10 h-9 rounded-xl items-center justify-center"
              >
                <Ionicons name="call" size={18} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleMarkPaid(item.id, item.teacherName)}
                className="bg-green-600 px-4 py-2 rounded-xl flex-row items-center h-9"
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color="white"
                  className="mr-2"
                />
                <Text className="text-white font-bold text-xs">Pay</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
        <Text className="text-white text-2xl font-bold">Salary Ledger</Text>

        {/* ADD COMMISSION BUTTON */}
        <TouchableOpacity
          onPress={() => setIsAdding(true)}
          className="bg-[#333842] p-2 rounded-full border border-[#f49b33]"
        >
          <Ionicons name="add" size={24} color="#f49b33" />
        </TouchableOpacity>
      </View>

      {/* --- STATS DASHBOARD --- */}
      <View className="px-5 mb-6">
        <View
          className={`${theme.card} p-5 rounded-3xl border ${theme.borderColor} shadow-lg relative overflow-hidden`}
        >
          <View className="flex-row justify-between items-end mb-4">
            <View>
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">
                Total Paid
              </Text>
              <Text className="text-white text-4xl font-black">
                ₹{totalPayout}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-400 text-[10px] mb-1">
                Pending: ₹{pendingPayout}
              </Text>
              <Text className={`${theme.accent} font-bold`}>
                {Math.round(payoutRate)}% Cleared
              </Text>
            </View>
          </View>
          {/* Progress Bar */}
          <View className="h-2 w-full bg-[#282C34] rounded-full overflow-hidden">
            <View
              style={{ width: `${payoutRate}%` }}
              className="h-full bg-[#f49b33]"
            />
          </View>
        </View>
      </View>

      {/* --- FILTERS --- */}
      <View className="px-5 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setSelectedFilter(opt)}
              className={`mr-2 px-5 py-2 rounded-2xl border ${selectedFilter === opt ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-[#4C5361]"}`}
            >
              <Text
                className={`${selectedFilter === opt ? "text-[#282C34] font-bold" : "text-gray-400"}`}
              >
                {opt}
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
          data={filteredSalaries}
          keyExtractor={(item) => item.id}
          renderItem={renderSalaryItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="cash-multiple"
                size={80}
                color="gray"
              />
              <Text className="text-white text-center mt-4">
                No salary records found.
              </Text>
            </View>
          )}
        />
      )}

      {/* --- MANUAL ENTRY MODAL (COMMISSION ONLY) --- */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#333842] rounded-t-3xl border-t border-[#f49b33] p-6 h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">
                Add Commission
              </Text>
              <TouchableOpacity onPress={() => setIsAdding(false)}>
                <Ionicons name="close" size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Teacher Selector */}
              <Text className="text-gray-400 text-xs font-bold uppercase mb-2">
                Select Teacher (Commission Based)
              </Text>
              <TouchableOpacity
                onPress={() => setShowTeacherModal(true)}
                className="bg-[#282C34] p-4 rounded-xl border border-[#4C5361] mb-4 flex-row justify-between items-center"
              >
                <Text
                  className={
                    selectedTeacher ? "text-white font-bold" : "text-gray-500"
                  }
                >
                  {selectedTeacher
                    ? selectedTeacher.name
                    : "Tap to select teacher..."}
                </Text>
                <Ionicons name="chevron-down" size={20} color="gray" />
              </TouchableOpacity>

              {/* Title */}
              <Text className="text-gray-400 text-xs font-bold uppercase mb-2">
                Description
              </Text>
              <TextInput
                placeholder="e.g. 15 Lectures @ ₹500"
                placeholderTextColor="#555"
                value={title}
                onChangeText={setTitle}
                multiline
                className="bg-[#282C34] text-white p-4 rounded-xl border border-[#4C5361] mb-4"
              />

              {/* Amount */}
              <Text className="text-gray-400 text-xs font-bold uppercase mb-2">
                Amount (₹)
              </Text>
              <TextInput
                placeholder="0.00"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                className="bg-[#282C34] text-[#f49b33] font-bold text-xl p-4 rounded-xl border border-[#4C5361] mb-8"
              />

              <TouchableOpacity
                onPress={handleRecordManual}
                disabled={submitting}
                className="bg-[#f49b33] p-4 rounded-xl items-center shadow-lg"
              >
                {submitting ? (
                  <ActivityIndicator color="#282C34" />
                ) : (
                  <Text className="text-[#282C34] font-bold text-lg">
                    Create Payout Slip
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- TEACHER SELECTION MODAL --- */}
      <Modal visible={showTeacherModal} animationType="fade" transparent>
        <View className="flex-1 bg-black/80 justify-center items-center p-5">
          <View className="bg-[#333842] w-full max-h-[70%] rounded-2xl p-5 border border-[#4C5361]">
            <Text className="text-white text-lg font-bold mb-4">
              Select Teacher
            </Text>

            {loadingTeachers ? (
              <ActivityIndicator color="#f49b33" />
            ) : commissionTeachers.length === 0 ? (
              <Text className="text-gray-400 text-center py-10">
                No commission-based teachers found.
              </Text>
            ) : (
              <FlatList
                data={commissionTeachers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedTeacher(item);
                      setShowTeacherModal(false);
                    }}
                    className="p-4 mb-2 bg-[#282C34] rounded-xl border border-[#4C5361] flex-row items-center"
                  >
                    <View className="w-8 h-8 rounded-full bg-[#f49b33]/10 items-center justify-center mr-3">
                      <Text className="text-[#f49b33] font-bold">
                        {item.name.charAt(0)}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-white font-bold">{item.name}</Text>
                      <Text className="text-gray-500 text-xs">
                        {item.phone}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              onPress={() => setShowTeacherModal(false)}
              className="mt-4 py-3 items-center"
            >
              <Text className="text-[#f49b33]">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TeacherSalaryReports;
