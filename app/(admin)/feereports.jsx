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
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
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

// --- FEE CARD COMPONENT (Handles Avatar Fetching) ---
const FeeCard = ({ item, onUpdateStatus }) => {
  const [studentImg, setStudentImg] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAvatar = async () => {
      if (item.studentId) {
        try {
          const docSnap = await firestore()
            .collection("users")
            .doc(item.studentId)
            .get();
          if (docSnap.exists && isMounted) {
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

  return (
    <View
      className={`${theme.card} p-4 rounded-2xl mb-4 border ${isVerifying ? "border-blue-500" : theme.borderColor} shadow-sm`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          {/* AVATAR SECTION */}
          <View className="w-10 h-10 rounded-full bg-[#f49b33]/20 items-center justify-center mr-3 border border-[#f49b33]/30 overflow-hidden">
            {studentImg ? (
              <Image
                source={{ uri: studentImg }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-[#f49b33] font-bold">
                {item.studentName ? item.studentName.charAt(0) : "S"}
              </Text>
            )}
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
          className={`px-3 py-1 rounded-full ${item.status === "Paid" ? "bg-green-500/20" : isVerifying ? "bg-blue-500/20" : "bg-yellow-500/20"}`}
        >
          <Text
            className={`text-[10px] font-bold ${item.status === "Paid" ? "text-green-400" : isVerifying ? "text-blue-400" : "text-yellow-400"}`}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text className="text-gray-300 text-sm mb-2 italic">{item.title}</Text>

      <View className="flex-row justify-between items-center pt-3 border-t border-[#4C5361]/30">
        <Text className="text-[#f49b33] text-xl font-bold">₹{item.amount}</Text>

        <View className="flex-row items-center gap-2">
          {item.status !== "Paid" && (
            <TouchableOpacity
              onPress={handleCallStudent}
              className="bg-blue-600 w-10 h-9 rounded-xl items-center justify-center"
            >
              <Ionicons name="call" size={18} color="white" />
            </TouchableOpacity>
          )}

          {item.status === "Verifying" ? (
            <>
              <TouchableOpacity
                onPress={() => onUpdateStatus(item.id, "Paid")}
                className="bg-green-600 w-10 h-9 rounded-xl items-center justify-center"
              >
                <Ionicons name="checkmark" size={18} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onUpdateStatus(item.id, "Pending")}
                className="bg-red-600 w-10 h-9 rounded-xl items-center justify-center"
              >
                <Ionicons name="close" size={18} color="white" />
              </TouchableOpacity>
            </>
          ) : item.status === "Pending" ? (
            <TouchableOpacity
              onPress={() => onUpdateStatus(item.id, "Paid")}
              className="bg-green-600 px-4 py-2 rounded-xl flex-row items-center h-9"
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
  const [fees, setFees] = useState([]);
  const [filteredFees, setFilteredFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassFilter, setSelectedClassFilter] = useState("All");

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
    Alert.alert("Confirm Action", `Mark fee as ${newStatus}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const updateData = { status: newStatus };
            if (newStatus === "Paid")
              updateData.paidAt = new Date().toISOString();
            if (newStatus === "Pending") updateData.transactionRef = null;

            await firestore().collection("fees").doc(id).update(updateData);
            showToast(`Fee marked as ${newStatus}`, "success");
          } catch (e) {
            showToast("Error updating fee", "error");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

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
          <View className="h-2 w-full bg-[#282C34] rounded-full overflow-hidden">
            <View
              style={{ width: `${collectionRate}%` }}
              className="h-full bg-[#f49b33]"
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

      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
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
              <MaterialCommunityIcons name="receipt" size={80} color="gray" />
              <Text className="text-white text-center mt-4">
                No records found.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default FeeReports;
