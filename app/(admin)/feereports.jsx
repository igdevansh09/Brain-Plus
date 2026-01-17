import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Linking,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
} from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";
import { db, functions } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";
import { useTheme } from "../../context/ThemeContext";

// --- FEE CARD COMPONENT (Handles Avatar Fetching) ---
const FeeCard = ({ item, onUpdateStatus }) => {
  const { theme } = useTheme();
  const [studentImg, setStudentImg] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAvatar = async () => {
      if (item.studentId) {
        try {
          // Modular: getDoc(doc(db, ...))
          const docSnap = await getDoc(doc(db, "users", item.studentId));
          if (docSnap.exists() && isMounted) {
            setStudentImg(docSnap.data().profileImage);
          }
        } catch (e) {
          // ignore error
        }
      }
    };
    fetchAvatar();
    return () => {
      isMounted = false;
    };
  }, [item.studentId]);

  const handleCallStudent = () => {
    if (!item.studentPhone) return;
    Linking.openURL(`tel:${item.studentPhone}`);
  };

  const isVerifying = item.status === "Verifying";

  // Dynamic Status Badge Colors
  const getStatusColor = (status) => {
    switch (status) {
      case "Paid":
        return { bg: theme.successSoft, text: theme.successBright };
      case "Verifying":
        return { bg: theme.infoSoft, text: theme.infoBright };
      default:
        return { bg: theme.warningSoft, text: theme.warningAlt };
    }
  };

  const statusColors = getStatusColor(item.status);

  return (
    <View
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: isVerifying ? theme.info : theme.border,
        shadowColor: theme.shadow,
      }}
      className="p-4 rounded-2xl mb-4 border shadow-sm"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          {/* AVATAR SECTION */}
          <View
            style={{
              backgroundColor: theme.accentSoft20,
              borderColor: theme.accentSoft30,
            }}
            className="w-10 h-10 rounded-full items-center justify-center mr-3 border overflow-hidden"
          >
            {studentImg ? (
              <Image
                source={{ uri: studentImg }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: theme.accent }} className="font-bold">
                {item.studentName ? item.studentName.charAt(0) : "S"}
              </Text>
            )}
          </View>

          <View>
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-base"
              numberOfLines={1}
            >
              {item.studentName}
            </Text>
            <Text style={{ color: theme.textSecondary }} className="text-xs">
              Class {item.studentClass} • {item.date}
            </Text>
          </View>
        </View>
        <View
          style={{ backgroundColor: statusColors.bg }}
          className="px-3 py-1 rounded-full"
        >
          <Text
            style={{ color: statusColors.text }}
            className="text-[10px] font-bold"
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={{ color: theme.textMuted }} className="text-sm mb-2 italic">
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
          {item.status !== "Paid" && (
            <TouchableOpacity
              onPress={handleCallStudent}
              style={{ backgroundColor: theme.callBlue }}
              className="w-10 h-9 rounded-xl items-center justify-center"
            >
              <Ionicons name="call" size={18} color="white" />
            </TouchableOpacity>
          )}

          {item.status === "Verifying" ? (
            <>
              <TouchableOpacity
                onPress={() => onUpdateStatus(item.id, "Paid")}
                style={{ backgroundColor: theme.approveGreen }}
                className="w-10 h-9 rounded-xl items-center justify-center"
              >
                <Ionicons name="checkmark" size={18} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onUpdateStatus(item.id, "Pending")}
                style={{ backgroundColor: theme.error }}
                className="w-10 h-9 rounded-xl items-center justify-center"
              >
                <Ionicons name="close" size={18} color="white" />
              </TouchableOpacity>
            </>
          ) : item.status === "Pending" ? (
            <TouchableOpacity
              onPress={() => onUpdateStatus(item.id, "Paid")}
              style={{ backgroundColor: theme.approveGreen }}
              className="px-4 py-2 rounded-xl flex-row items-center h-9"
            >
              <Ionicons
                name="card-outline"
                size={16}
                color="white"
                className="mr-2"
              />
              <Text className="text-white font-bold text-xs ml-1">Receive</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const FeeReports = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [fees, setFees] = useState([]);
  const [filteredFees, setFilteredFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassFilter, setSelectedClassFilter] = useState("All");
  const [generating, setGenerating] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  const [confirmAlert, setConfirmAlert] = useState({
    visible: false,
    id: null,
    newStatus: null,
    message: "",
  });

  const [generateConfirm, setGenerateConfirm] = useState({
    visible: false,
    message: "",
  });

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

  // --- REAL-TIME LISTENER (MODULAR) ---
  useEffect(() => {
    // Modular: query(collection(db, ...), orderBy(...))
    const q = query(collection(db, "fees"), orderBy("createdAt", "desc"));

    // Modular: onSnapshot(query, callback)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot) return;
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      list.sort((a, b) => {
        if (a.status === "Verifying") return -1;
        if (b.status === "Verifying") return 1;
        if (a.status === "Pending") return -1;
        return 1;
      });
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

  const totalExpected = filteredFees.reduce(
    (acc, curr) => acc + Number(curr.amount),
    0
  );
  const totalCollected = filteredFees
    .filter((f) => f.status === "Paid")
    .reduce((acc, curr) => acc + Number(curr.amount), 0);
  const collectionRate =
    totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  const handleUpdateStatus = (id, newStatus) => {
    setConfirmAlert({
      visible: true,
      id,
      newStatus,
      message: `Mark fee as ${newStatus}?`,
    });
  };

  const performUpdateStatus = async () => {
    const { id, newStatus } = confirmAlert;
    setConfirmAlert({ ...confirmAlert, visible: false });
    try {
      const updateData = { status: newStatus };
      if (newStatus === "Paid") updateData.paidAt = new Date().toISOString();
      if (newStatus === "Pending") updateData.transactionRef = null;

      // Modular: updateDoc(doc(db, ...))
      const feeRef = doc(db, "fees", id);
      await updateDoc(feeRef, updateData);

      showToast(`Fee marked as ${newStatus}`, "success");
    } catch (e) {
      showToast("Error updating fee", "error");
    }
  };

  const handleGenerateFees = () => {
    setGenerateConfirm({
      visible: true,
      message:
        "This will create fee invoices for all active students for the current month.\n\nAre you sure?",
    });
  };

  const performGenerateFees = async () => {
    setGenerateConfirm({ ...generateConfirm, visible: false });
    setGenerating(true);
    try {
      // Modular: httpsCallable(functionsInstance, name)
      const fn = httpsCallable(functions, "generateMonthlyFees");
      const result = await fn();
      showToast(result.data.message, "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to generate fees.", "error");
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
            className="p-2 rounded-full border mr-4"
          >
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{ color: theme.textPrimary }}
            className="text-2xl font-bold"
          >
            Fee Ledger
          </Text>
        </View>

        {/* THUNDERBOLT BUTTON */}
        <TouchableOpacity
          onPress={handleGenerateFees}
          disabled={generating}
          style={{
            backgroundColor: generating ? theme.bgTertiary : theme.accentSoft20,
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
      </View>

      <View className="px-5 mb-6">
        <View
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          }}
          className="p-5 rounded-3xl border shadow-lg relative overflow-hidden"
        >
          <View className="flex-row justify-between items-end mb-4">
            <View>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs font-bold uppercase tracking-widest mb-1"
              >
                Total Collected
              </Text>
              <Text
                style={{ color: theme.textPrimary }}
                className="text-4xl font-black"
              >
                ₹{totalCollected}
              </Text>
            </View>
            <View className="items-end">
              <Text
                style={{ color: theme.textSecondary }}
                className="text-[10px] mb-1"
              >
                Expected: ₹{totalExpected}
              </Text>
              <Text style={{ color: theme.accent }} className="font-bold">
                {Math.round(collectionRate)}% Paid
              </Text>
            </View>
          </View>
          <View
            style={{ backgroundColor: theme.bgPrimary }}
            className="h-2 w-full rounded-full overflow-hidden"
          >
            <View
              style={{
                width: `${collectionRate}%`,
                backgroundColor: theme.accent,
              }}
              className="h-full"
            />
          </View>
        </View>
      </View>

      <View className="px-5 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_OPTIONS.map((cls) => (
            <TouchableOpacity
              key={cls}
              onPress={() => setSelectedClassFilter(cls)}
              style={{
                backgroundColor:
                  selectedClassFilter === cls
                    ? theme.accent
                    : theme.bgSecondary,
                borderColor:
                  selectedClassFilter === cls ? theme.accent : theme.border,
              }}
              className="mr-2 px-5 py-2 rounded-2xl border"
            >
              <Text
                style={{
                  color:
                    selectedClassFilter === cls
                      ? theme.textDark
                      : theme.textSecondary,
                  fontWeight: selectedClassFilter === cls ? "bold" : "normal",
                }}
              >
                {cls}
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
          data={filteredFees}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeeCard item={item} onUpdateStatus={handleUpdateStatus} />
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="receipt"
                size={80}
                color={theme.textMuted}
              />
              <Text
                style={{ color: theme.textMuted }}
                className="text-center mt-4"
              >
                No records found.
              </Text>
            </View>
          }
        />
      )}
      <CustomAlert
        visible={confirmAlert.visible}
        title={"Confirm Action"}
        message={confirmAlert.message}
        onCancel={() => setConfirmAlert({ ...confirmAlert, visible: false })}
        onConfirm={performUpdateStatus}
      />
      <CustomAlert
        visible={generateConfirm.visible}
        title={"Generate Monthly Fees"}
        message={generateConfirm.message}
        onCancel={() =>
          setGenerateConfirm({ ...generateConfirm, visible: false })
        }
        onConfirm={performGenerateFees}
      />
    </SafeAreaView>
  );
};

export default FeeReports;
 
