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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";
import { db, functions } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";
import { useTheme } from "../../context/ThemeContext";

// --- SALARY CARD COMPONENT ---
const SalaryCard = ({ item, onInitiatePayment }) => {
  const { theme } = useTheme();
  const [teacherImg, setTeacherImg] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAvatar = async () => {
      if (item.teacherId) {
        try {
          // Modular: getDoc
          const docRef = doc(db, "users", item.teacherId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && isMounted) {
            setTeacherImg(docSnap.data().profileImage);
          }
        } catch (e) {}
      }
    };
    fetchAvatar();
    return () => {
      isMounted = false;
    };
  }, [item.teacherId]);

  return (
    <View
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }}
      className="p-4 rounded-2xl mb-4 border shadow-sm"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          {/* AVATAR */}
          <View
            style={{
              backgroundColor: theme.accentSoft20,
              borderColor: theme.accentSoft30,
            }}
            className="w-10 h-10 rounded-full items-center justify-center mr-3 border overflow-hidden"
          >
            {teacherImg ? (
              <Image
                source={{ uri: teacherImg }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: theme.accent }} className="font-bold">
                {item.teacherName ? item.teacherName.charAt(0) : "T"}
              </Text>
            )}
          </View>
          <View>
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-base"
              numberOfLines={1}
            >
              {item.teacherName}
            </Text>
            <Text style={{ color: theme.textSecondary }} className="text-xs">
              {item.date}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor:
              item.status === "Paid" ? theme.successSoft : theme.errorSoft,
          }}
          className="px-3 py-1 rounded-full"
        >
          <Text
            style={{
              color:
                item.status === "Paid"
                  ? theme.successBright
                  : theme.errorBright,
            }}
            className="text-[10px] font-bold"
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={{ color: theme.textMuted }} className="text-sm mb-3 italic">
        {item.title}
      </Text>

      <View
        style={{ borderColor: theme.border }}
        className="flex-row justify-between items-center pt-3 border-t"
      >
        <Text style={{ color: theme.accent }} className="text-xl font-bold">
          ₹{item.amount}
        </Text>

        <View className="flex-row items-center gap-2">
          {item.status === "Pending" ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  if (item.teacherPhone)
                    Linking.openURL(`tel:${item.teacherPhone}`);
                }}
                style={{ backgroundColor: theme.info }}
                className="w-10 h-9 rounded-xl items-center justify-center"
              >
                <Ionicons name="call" size={18} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onInitiatePayment(item.id)}
                style={{ backgroundColor: theme.approveGreen }}
                className="px-4 py-2 rounded-xl flex-row items-center h-9"
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color="white"
                  className="mr-2"
                />
                <Text className="text-white font-bold text-xs">Mark Paid</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const TeacherSalaryReports = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [salaries, setSalaries] = useState([]);
  const [filteredSalaries, setFilteredSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // States
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedSalaryId, setSelectedSalaryId] = useState(null);

  const [generateConfirm, setGenerateConfirm] = useState({
    visible: false,
    message: "",
  });

  const [commissionTeachers, setCommissionTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });
  const FILTER_OPTIONS = ["All", "Pending", "Paid"];

  // --- 1. REAL-TIME LISTENER (MODULAR) ---
  useEffect(() => {
    // Modular: query(collection, orderBy)
    const q = query(collection(db, "salaries"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot) return;
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      list.sort((a, b) => (a.status === "Pending" ? -1 : 1));
      setSalaries(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedFilter === "All") setFilteredSalaries(salaries);
    else
      setFilteredSalaries(salaries.filter((s) => s.status === selectedFilter));
  }, [selectedFilter, salaries]);

  // --- 2. FETCH TEACHERS (MODULAR) ---
  useEffect(() => {
    if (isAdding) {
      const fetchTeachers = async () => {
        setLoadingTeachers(true);
        try {
          // Modular: query + getDocs
          const q = query(
            collection(db, "users"),
            where("role", "==", "teacher"),
            where("verified", "==", true),
            where("salaryType", "==", "Commission")
          );
          const snap = await getDocs(q);
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

  const initiatePayment = (id) => {
    setSelectedSalaryId(id);
    setPayModalVisible(true);
  };

  const confirmPayment = async () => {
    try {
      // Modular: updateDoc
      const salaryRef = doc(db, "salaries", selectedSalaryId);
      await updateDoc(salaryRef, {
        status: "Paid",
        paidAt: new Date().toISOString(),
      });
      setPayModalVisible(false);
      showToast("Salary marked as paid.", "success");
    } catch (e) {
      showToast("Update failed.", "error");
    }
  };

  const handleRecordManual = async () => {
    if (!selectedTeacher || !title.trim() || !amount.trim()) {
      showToast("Please fill all fields.", "error");
      return;
    }
    setSubmitting(true);
    try {
      // Modular: addDoc + serverTimestamp
      await addDoc(collection(db, "salaries"), {
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.name || "Unknown",
        teacherEmail: selectedTeacher.email || "N/A",
        teacherPhone: selectedTeacher.phone || "",
        title: title.trim(),
        amount: amount.trim(),
        status: "Pending",
        date: new Date().toLocaleDateString("en-GB"),
        createdAt: serverTimestamp(),
      });

      setIsAdding(false);
      setSelectedTeacher(null);
      setTitle("");
      setAmount("");
      showToast("Commission added!", "success");
    } catch (e) {
      console.log(e);
      showToast("Failed to record. Check console.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateSalaries = () => {
    setGenerateConfirm({
      visible: true,
      message:
        "This will create salary slips for all fixed-salary teachers for the current month.\n\nAre you sure?",
    });
  };

  const performGenerateSalaries = async () => {
    setGenerateConfirm({ ...generateConfirm, visible: false });
    setGenerating(true);
    try {
      // Modular: httpsCallable
      const fn = httpsCallable(functions, "generateMonthlySalaries");
      const result = await fn();
      showToast(result.data.message, "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to generate salaries.", "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
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

      {/* --- HEADER --- */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="p-2 rounded-full border"
          >
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{ color: theme.textPrimary }}
            className="text-2xl font-bold ml-4"
          >
            Salary Ledger
          </Text>
        </View>

        <View className="flex-row gap-3">
          {/* THUNDERBOLT BUTTON */}
          <TouchableOpacity
            onPress={handleGenerateSalaries}
            disabled={generating}
            style={{
              backgroundColor: generating
                ? theme.bgTertiary
                : theme.accentSoft20,
              borderColor: theme.border,
            }}
            className="p-2 rounded-full border"
          >
            {generating ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Ionicons name="flash" size={24} color={theme.accent} />
            )}
          </TouchableOpacity>

          {/* ADD BUTTON */}
          <TouchableOpacity
            onPress={() => setIsAdding(true)}
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="p-2 rounded-full border"
          >
            <Ionicons name="add" size={24} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="px-5 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setSelectedFilter(opt)}
              style={{
                backgroundColor:
                  selectedFilter === opt ? theme.accent : theme.bgSecondary,
                borderColor:
                  selectedFilter === opt ? theme.accent : theme.border,
              }}
              className="mr-2 px-5 py-2 rounded-2xl border"
            >
              <Text
                style={{
                  color:
                    selectedFilter === opt
                      ? theme.textDark
                      : theme.textSecondary,
                  fontWeight: selectedFilter === opt ? "bold" : "normal",
                }}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.accent}
          className="mt-10"
        />
      ) : (
        <FlatList
          data={filteredSalaries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SalaryCard item={item} onInitiatePayment={initiatePayment} />
          )}
          contentContainerStyle={{ padding: 20 }}
        />
      )}

      {/* --- MANUAL ENTRY MODAL --- */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-end"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="rounded-t-3xl border-t p-6 h-[80%]"
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ color: theme.textPrimary }}
                className="text-xl font-bold"
              >
                Add Commission
              </Text>
              <TouchableOpacity onPress={() => setIsAdding(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs font-bold uppercase mb-2"
              >
                Select Teacher
              </Text>
              <TouchableOpacity
                onPress={() => setShowTeacherModal(true)}
                style={{
                  backgroundColor: theme.bgPrimary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl border mb-4 flex-row justify-between items-center"
              >
                <Text
                  style={{
                    color: selectedTeacher
                      ? theme.textPrimary
                      : theme.textMuted,
                    fontWeight: selectedTeacher ? "bold" : "normal",
                  }}
                >
                  {selectedTeacher ? selectedTeacher.name : "Tap to select..."}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
              <TextInput
                placeholder="Description"
                placeholderTextColor={theme.placeholder}
                value={title}
                onChangeText={setTitle}
                style={{
                  backgroundColor: theme.bgPrimary,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                }}
                className="p-4 rounded-xl border mb-4"
              />
              <TextInput
                placeholder="Amount (₹)"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                style={{
                  backgroundColor: theme.bgPrimary,
                  borderColor: theme.border,
                  color: theme.accent,
                }}
                className="font-bold text-xl p-4 rounded-xl border mb-8"
              />
              <TouchableOpacity
                onPress={handleRecordManual}
                disabled={submitting}
                style={{ backgroundColor: theme.accent }}
                className="p-4 rounded-xl items-center shadow-lg"
              >
                {submitting ? (
                  <ActivityIndicator color={theme.textDark} />
                ) : (
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
                    Create Payout
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- TEACHER SELECTION MODAL --- */}
      <Modal visible={showTeacherModal} animationType="fade" transparent>
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center items-center p-5"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="w-full max-h-[70%] rounded-2xl p-5 border"
          >
            <Text
              style={{ color: theme.textPrimary }}
              className="text-lg font-bold mb-4"
            >
              Select Teacher
            </Text>
            <FlatList
              data={commissionTeachers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTeacher(item);
                    setShowTeacherModal(false);
                  }}
                  style={{
                    backgroundColor: theme.bgPrimary,
                    borderColor: theme.border,
                  }}
                  className="p-4 mb-2 rounded-xl border flex-row items-center"
                >
                  <View
                    style={{ backgroundColor: theme.accentSoft10 }}
                    className="w-8 h-8 rounded-full items-center justify-center mr-3 overflow-hidden"
                  >
                    {item.profileImage ? (
                      <Image
                        source={{ uri: item.profileImage }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={{ color: theme.accent }}
                        className="font-bold"
                      >
                        {item.name ? item.name.charAt(0) : "T"}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="font-bold"
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setShowTeacherModal(false)}
              className="mt-4 py-3 items-center"
            >
              <Text style={{ color: theme.accent }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- CONFIRM PAYMENT MODAL --- */}
      <Modal visible={payModalVisible} transparent animationType="fade">
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center p-6"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="p-6 rounded-2xl border"
          >
            <Text
              style={{ color: theme.textPrimary }}
              className="text-lg font-bold mb-4"
            >
              Confirm Payout
            </Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => setPayModalVisible(false)}
                style={{
                  backgroundColor: theme.bgPrimary,
                  borderColor: theme.border,
                }}
                className="flex-1 p-3 rounded-xl items-center border"
              >
                <Text
                  style={{ color: theme.textSecondary }}
                  className="font-bold"
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmPayment}
                style={{ backgroundColor: theme.approveGreen }}
                className="flex-1 p-3 rounded-xl items-center"
              >
                <Text className="text-white font-bold">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <CustomAlert
        visible={generateConfirm.visible}
        title={"Generate Monthly Salaries"}
        message={generateConfirm.message}
        onCancel={() =>
          setGenerateConfirm({ ...generateConfirm, visible: false })
        }
        onConfirm={performGenerateSalaries}
      />
    </SafeAreaView>
  );
};

export default TeacherSalaryReports;
