import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";

const TeacherLeaveRequest = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // User Data
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [history, setHistory] = useState([]);

  // Form State
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState("");

  // Date Picker State
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Toast
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    borderColor: "border-[#4C5361]",
    info: "#29B6F6",
  };

  // --- 1. FETCH PROFILE & HISTORY ---
  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    // A. Fetch Profile
    const fetchProfile = async () => {
      try {
        const docSnap = await firestore().collection("users").doc(uid).get();
        if (docSnap.exists) {
          setTeacherProfile(docSnap.data());
        }
      } catch (e) {
        console.log("Profile Error:", e);
      }
    };
    fetchProfile();

    // B. Real-time History Listener
    const unsubscribe = firestore()
      .collection("teacher_leaves")
      .where("teacherId", "==", uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) return;
          const list = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setHistory(list);
          setLoading(false);
        },
        (error) => {
          console.log("History Error:", error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, []);

  // --- HANDLERS ---
  const handleStartDateChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === "ios");
    if (selectedDate) {
      setStartDate(selectedDate);
      if (selectedDate > endDate) setEndDate(selectedDate);
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === "ios");
    if (selectedDate) {
      if (selectedDate < startDate) {
        showToast("End date cannot be before start date", "error");
        setEndDate(startDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const formatDate = (date) => date.toLocaleDateString("en-GB");

  const getDuration = () => {
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      showToast("Please provide a reason.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await firestore()
        .collection("teacher_leaves")
        .add({
          teacherId: auth().currentUser.uid,
          teacherName: teacherProfile?.name || "Unknown Teacher",
          phone: teacherProfile?.phone || "",
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          reason: reason.trim(),
          duration: getDuration(),
          status: "Informed",
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      showToast("Admin Notified Successfully!", "success");
      setReason("");
      setStartDate(new Date());
      setEndDate(new Date());
    } catch (error) {
      showToast("Failed to submit request.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDER HISTORY CARD ---
  const renderLeaveItem = ({ item }) => {
    // Safety check for Timestamp to prevent crashes on new items
    const dateDisplay = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleDateString("en-GB")
      : "Just Now";

    return (
      <View
        className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: `${theme.info}20` }}
              className="p-2 rounded-full mr-3"
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={theme.info}
              />
            </View>
            <View>
              <Text className="text-white font-bold text-base">
                Notification Sent
              </Text>
              <Text className="text-gray-400 text-xs">
                Posted: {dateDisplay}
              </Text>
            </View>
          </View>
          <View className="bg-[#282C34] px-3 py-1 rounded-lg border border-[#4C5361]">
            <Text className="text-[#f49b33] font-bold text-xs">
              {item.duration || 1} Days
            </Text>
          </View>
        </View>

        <View className="flex-row items-center my-2 pl-1">
          <Text className="text-white font-bold">{item.startDate}</Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color="#666"
            style={{ marginHorizontal: 8 }}
          />
          <Text className="text-white font-bold">{item.endDate}</Text>
        </View>

        <Text className="text-gray-400 text-sm italic mt-1 border-l-2 border-[#f49b33] pl-2">
          &quot;{item.reason}&quot;
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${theme.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* --- HEADER --- */}
      <View className="px-5 pt-10 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Inform Absence</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {/* --- APPLICATION FORM --- */}
          <View
            className={`${theme.card} p-5 rounded-3xl border ${theme.borderColor} mb-8 shadow-lg`}
          >
            <Text className="text-[#f49b33] text-xs font-bold uppercase mb-4 tracking-widest">
              New Notice
            </Text>

            {/* Date Row */}
            <View className="flex-row justify-between mb-4">
              {/* Start Date */}
              <View className="flex-1 mr-2">
                <Text className="text-gray-400 text-xs mb-2 ml-1">From</Text>
                <TouchableOpacity
                  onPress={() => setShowStartPicker(true)}
                  className="bg-[#282C34] p-3 rounded-xl border border-[#4C5361] flex-row items-center"
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#f49b33"
                    className="mr-2"
                  />
                  <Text className="text-white font-bold">
                    {formatDate(startDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* End Date */}
              <View className="flex-1 ml-2">
                <Text className="text-gray-400 text-xs mb-2 ml-1">To</Text>
                <TouchableOpacity
                  onPress={() => setShowEndPicker(true)}
                  className="bg-[#282C34] p-3 rounded-xl border border-[#4C5361] flex-row items-center"
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#f49b33"
                    className="mr-2"
                  />
                  <Text className="text-white font-bold">
                    {formatDate(endDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Reason Input */}
            <Text className="text-gray-400 text-xs mb-2 ml-1">
              Reason for Absence
            </Text>
            <TextInput
              placeholder="E.g. Medical emergency, Urgent work..."
              placeholderTextColor="#666"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              style={{ textAlignVertical: "top" }}
              className="bg-[#282C34] text-white p-4 rounded-xl border border-[#4C5361] mb-6 text-sm"
            />

            {/* Summary & Submit */}
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-gray-500 text-xs">Total Duration</Text>
                <Text className="text-white font-bold text-lg">
                  {getDuration()} Days
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                className="bg-[#f49b33] py-3 px-6 rounded-xl flex-row items-center shadow-md"
              >
                {submitting ? (
                  <ActivityIndicator color="#282C34" size="small" />
                ) : (
                  <>
                    <Text className="text-[#282C34] font-bold mr-2">
                      Notify Admin
                    </Text>
                    <Ionicons name="paper-plane" size={16} color="#282C34" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* --- HISTORY SECTION --- */}
          <View className="flex-row items-center mb-4">
            <MaterialCommunityIcons
              name="history"
              size={20}
              color="#f49b33"
              className="mr-2"
            />
            <Text className="text-white font-bold text-lg">
              Past Notifications
            </Text>
          </View>

          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderLeaveItem}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={() => (
              <View className="items-center py-10 opacity-30">
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={60}
                  color="gray"
                />
                <Text className="text-gray-400 mt-2">
                  No leave history found.
                </Text>
              </View>
            )}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
          minimumDate={new Date()}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
          minimumDate={startDate}
        />
      )}
    </SafeAreaView>
  );
};

export default TeacherLeaveRequest;
