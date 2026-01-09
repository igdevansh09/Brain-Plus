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
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";

const ApplyLeave = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get dynamic theme values
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // User Data
  const [studentProfile, setStudentProfile] = useState(null);
  const [history, setHistory] = useState([]);

  // Form State
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState("");

  // Date Picker State
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Toast / Alert
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    confirmText: "",
    type: "warning",
    onConfirm: null,
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // --- 1. FETCH PROFILE & HISTORY ---
  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    const fetchProfile = async () => {
      try {
        const docSnap = await firestore().collection("users").doc(uid).get();
        if (docSnap.exists) setStudentProfile(docSnap.data());
      } catch (e) {
        console.log("Profile Error:", e);
      }
    };
    fetchProfile();

    const unsubscribe = firestore()
      .collection("leaves")
      .where("studentId", "==", uid)
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
        (err) => {
          console.log("History Error:", err);
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
        .collection("leaves")
        .add({
          studentId: auth().currentUser.uid,
          studentName:
            studentProfile?.name || auth().currentUser.displayName || "Student",
          phone: studentProfile?.phone || "",
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          reason: reason.trim(),
          duration: getDuration(),
          status: "Pending",
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      showToast("Application submitted!", "success");
      setReason("");
      setStartDate(new Date());
      setEndDate(new Date());
    } catch (error) {
      console.error(error);
      showToast("Failed to submit request.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    setAlertConfig({
      visible: true,
      title: "Delete Request",
      message: "Are you sure you want to delete this pending request?",
      confirmText: "Delete",
      type: "warning",
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        await firestore().collection("leaves").doc(id).delete();
        showToast("Request deleted", "success");
      },
    });
  };

  // --- RENDER HISTORY ITEM ---
  const renderLeaveItem = ({ item }) => {
    const dateDisplay = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleDateString("en-GB")
      : "Just Now";
    return (
      <View
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        }}
        className="p-4 rounded-2xl mb-4 border shadow-sm"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: theme.infoSoft }}
              className="p-2 rounded-full mr-3"
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={theme.infoBright}
              />
            </View>
            <View>
              <Text
                style={{ color: theme.textPrimary }}
                className="font-bold text-base"
              >
                Leave Request
              </Text>
              <Text style={{ color: theme.textSecondary }} className="text-xs">
                Posted: {dateDisplay}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <View
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
              }}
              className="px-3 py-1 rounded-lg border mr-2"
            >
              <Text
                style={{ color: theme.accent }}
                className="font-bold text-xs"
              >
                {item.duration || 1} Days
              </Text>
            </View>
            {item.status === "Pending" && (
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                style={{
                  backgroundColor: theme.errorSoft,
                  borderColor: theme.error,
                }}
                className="w-10 h-10 rounded-xl items-center justify-center border border-opacity-30"
              >
                <Ionicons name="trash-outline" size={20} color={theme.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="flex-row items-center my-2 pl-1">
          <Text style={{ color: theme.textPrimary }} className="font-bold">
            {item.startDate}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={theme.textMuted}
            style={{ marginHorizontal: 8 }}
          />
          <Text style={{ color: theme.textPrimary }} className="font-bold">
            {item.endDate}
          </Text>
        </View>

        <Text
          style={{
            color: theme.textSecondary,
            borderLeftColor: theme.accent,
          }}
          className="text-sm italic mt-1 border-l-2 pl-2"
        >
          &quot;{item.reason}&quot;
        </Text>
      </View>
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
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* --- HEADER --- */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="p-2 rounded-full border"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-xl font-bold"
        >
          Submit Leave
        </Text>
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
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            }}
            className="p-5 rounded-3xl border mb-8 shadow-lg"
          >
            <Text
              style={{ color: theme.accent }}
              className="text-xs font-bold uppercase mb-4 tracking-widest"
            >
              New Request
            </Text>

            <View className="flex-row justify-between mb-4">
              <View className="flex-1 mr-2">
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs mb-2 ml-1"
                >
                  From
                </Text>
                <TouchableOpacity
                  onPress={() => setShowStartPicker(true)}
                  style={{
                    backgroundColor: theme.bgTertiary,
                    borderColor: theme.border,
                  }}
                  className="p-3 rounded-xl border flex-row items-center"
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={theme.accent}
                    className="mr-2"
                  />
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="font-bold"
                  >
                    {formatDate(startDate)}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-1 ml-2">
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs mb-2 ml-1"
                >
                  To
                </Text>
                <TouchableOpacity
                  onPress={() => setShowEndPicker(true)}
                  style={{
                    backgroundColor: theme.bgTertiary,
                    borderColor: theme.border,
                  }}
                  className="p-3 rounded-xl border flex-row items-center"
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={theme.accent}
                    className="mr-2"
                  />
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="font-bold"
                  >
                    {formatDate(endDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs mb-2 ml-1"
            >
              Reason for Leave
            </Text>
            <TextInput
              placeholder="E.g. Medical emergency, Urgent work..."
              placeholderTextColor={theme.placeholder}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              style={{
                textAlignVertical: "top",
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
                color: theme.textPrimary,
              }}
              className="p-4 rounded-xl border mb-6 text-sm"
            />

            <View className="flex-row items-center justify-between">
              <View>
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs"
                >
                  Total Duration
                </Text>
                <Text
                  style={{ color: theme.textPrimary }}
                  className="font-bold text-lg"
                >
                  {getDuration()} Days
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={{
                  backgroundColor: theme.accent,
                  shadowColor: theme.shadow,
                }}
                className="py-3 px-6 rounded-xl flex-row items-center shadow-md"
              >
                {submitting ? (
                  <ActivityIndicator color={theme.textDark} size="small" />
                ) : (
                  <>
                    <Text
                      style={{ color: theme.textDark }}
                      className="font-bold mr-2"
                    >
                      Notify Teacher
                    </Text>
                    <Ionicons
                      name="paper-plane"
                      size={16}
                      color={theme.textDark}
                    />
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
              color={theme.accent}
              className="mr-2"
            />
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-lg"
            >
              My Applications
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
                  color={theme.textMuted}
                />
                <Text style={{ color: theme.textMuted }} className="mt-2">
                  No leave applications yet.
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

export default ApplyLeave;
