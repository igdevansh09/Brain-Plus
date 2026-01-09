import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import CustomToast from "../../components/CustomToast";
import messaging from "@react-native-firebase/messaging";
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

// --- CONSTANTS ---
const ALL_CLASSES = [
  "CS",
  "Prep",
  "1st",
  "2nd",
  "3rd", // Lower
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th", // Middle
  "11th",
  "12th", // Higher
];

// Groups
const LOWER_CLASSES = ["Prep", "1st", "2nd", "3rd"];
const MIDDLE_CLASSES = ["4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const HIGHER_CLASSES = ["11th", "12th"];

// Subject Definitions
const SUB_MIDDLE = ["English", "Hindi", "Maths", "Science", "Social Science"];
const SUB_HIGHER_ALL = [
  "English",
  "Economics",
  "Physics",
  "Chemistry",
  "Maths",
  "Accounts",
  "Business Studies",
  "History",
  "Geography",
  "Political Science",
];

const TeacherSignUp = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get dynamic theme values
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);

  // User Details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  // --- NEW LOGIC: PAIR ENTRY SYSTEM ---
  const [entries, setEntries] = useState([]); // Stores [{ class: '10th', subject: 'Maths' }]

  // Temporary State for the "Input Box"
  const [tempClass, setTempClass] = useState(null);
  const [tempSubject, setTempSubject] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Modal State
  const [modalType, setModalType] = useState(null); // 'class' | 'subject'

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type) => setToast({ visible: true, msg, type });

  // --- EFFECT: Update Subject Options when Class Changes ---
  useEffect(() => {
    if (!tempClass) {
      setAvailableSubjects([]);
      setTempSubject(null);
      return;
    }

    if (tempClass === "CS") {
      setAvailableSubjects([]); // No subject needed
      setTempSubject("N/A"); // Auto-set
    } else if (LOWER_CLASSES.includes(tempClass)) {
      setAvailableSubjects(["All Subjects"]);
      setTempSubject("All Subjects"); // Auto-set
    } else if (MIDDLE_CLASSES.includes(tempClass)) {
      setAvailableSubjects(SUB_MIDDLE);
      setTempSubject(null); // User must choose
    } else if (HIGHER_CLASSES.includes(tempClass)) {
      setAvailableSubjects(SUB_HIGHER_ALL);
      setTempSubject(null); // User must choose
    }
  }, [tempClass]);

  // --- HANDLER: Add Pair to List ---
  const handleAddEntry = () => {
    if (!tempClass) return showToast("Select a Class first", "error");
    if (!tempSubject) return showToast("Select a Subject", "error");

    // Check Duplicate
    const exists = entries.some(
      (e) => e.class === tempClass && e.subject === tempSubject
    );
    if (exists) return showToast("This combination is already added", "error");

    setEntries([...entries, { class: tempClass, subject: tempSubject }]);

    // Reset Input
    setTempClass(null);
    setTempSubject(null);
  };

  // --- HANDLER: Remove Pair ---
  const handleRemoveEntry = (index) => {
    const updated = [...entries];
    updated.splice(index, 1);
    setEntries(updated);
  };

  // --- AUTH HANDLERS ---
  const handleSendOTP = async () => {
    Keyboard.dismiss();
    if (!name.trim()) return showToast("Enter Full Name", "error");
    if (!phone || phone.length !== 10)
      return showToast("Invalid Phone Number", "error");
    if (entries.length === 0)
      return showToast("Add at least one Class-Subject pair", "error");

    setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirmResult(confirmation);
      setStep(2);
      showToast("OTP Sent!", "success");
    } catch (error) {
      console.error(error);
      // --- CUSTOM ERROR HANDLING ---
      if (error.code === "auth/too-many-requests") {
        showToast("Too many attempts. Please try again in 1 hour.", "error");
      } else if (error.code === "auth/invalid-phone-number") {
        showToast("Invalid phone number format.", "error");
      } else if (error.code === "auth/quota-exceeded") {
        showToast("SMS Quota Exceeded. Contact Support.", "error");
      } else {
        showToast("Failed to send OTP. Try again later.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    if (otp.length !== 6) return showToast("Enter 6-digit OTP", "error");
    setLoading(true);

    try {
      const res = await confirmResult.confirm(otp);
      const uid = res.user.uid;

      // 2. FETCH THE TOKEN
      let fcmToken = "";
      try {
        fcmToken = await messaging().getToken();
      } catch (e) {
        console.log("Failed to get FCM token", e);
      }

      const distinctClasses = [...new Set(entries.map((e) => e.class))];

      // 3. SAVE IT
      await firestore()
        .collection("users")
        .doc(uid)
        .set({
          name: name.trim(),
          phone: `+91${phone}`,
          role: "teacher",
          teachingProfile: entries,
          classesTaught: distinctClasses,
          verified: false,
          salary: "0",
          fcmToken: fcmToken, // <--- CRITICAL ADDITION
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      showToast("Registration Success! Wait for Admin Approval.", "success");

      setTimeout(async () => {
        await auth().signOut();
        router.replace("/(auth)/teachersignin");
      }, 500);
    } catch (error) {
      console.error(error);
      showToast("Registration Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bgPrimary}
      />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          {/* Header */}
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text
              style={{ color: theme.textPrimary }}
              className="text-3xl font-bold"
            >
              Teacher Reg.
            </Text>
          </View>

          {step === 1 ? (
            <>
              {/* Basic Info */}
              <Text
                style={{ color: theme.accent }}
                className="mb-1 ml-1 font-semibold"
              >
                Full Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={{
                  backgroundColor: theme.bgSecondary,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl mb-4 border"
                placeholder="Name"
                placeholderTextColor={theme.textMuted}
              />

              <Text
                style={{ color: theme.accent }}
                className="mb-1 ml-1 font-semibold"
              >
                Phone
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                style={{
                  backgroundColor: theme.bgSecondary,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl mb-6 border"
                placeholder="9876543210"
                placeholderTextColor={theme.textMuted}
              />

              {/* --- DESIGN IMPLEMENTATION: SIDE-BY-SIDE INPUTS --- */}
              <Text
                style={{ color: theme.accent }}
                className="mb-2 ml-1 font-semibold"
              >
                Add Teaching Details
              </Text>

              <View className="flex-row justify-between mb-4">
                {/* 1. Class Selector */}
                <TouchableOpacity
                  onPress={() => setModalType("class")}
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                  }}
                  className="flex-1 p-4 rounded-xl border mr-2 justify-center"
                >
                  <Text
                    style={{
                      color: tempClass ? theme.textPrimary : theme.textMuted,
                      fontWeight: tempClass ? "bold" : "normal",
                    }}
                    className="text-center"
                  >
                    {tempClass || "Class"}
                  </Text>
                </TouchableOpacity>

                {/* 2. Subject Selector */}
                <TouchableOpacity
                  onPress={() => {
                    if (!tempClass) showToast("Select Class first", "error");
                    else if (availableSubjects.length > 0)
                      setModalType("subject");
                  }}
                  disabled={availableSubjects.length === 0}
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                    opacity: availableSubjects.length === 0 ? 0.5 : 1,
                  }}
                  className="flex-1 p-4 rounded-xl border ml-2 justify-center"
                >
                  <Text
                    style={{
                      color: tempSubject ? theme.textPrimary : theme.textMuted,
                      fontWeight: tempSubject ? "bold" : "normal",
                    }}
                    className="text-center"
                  >
                    {tempSubject || (tempClass === "CS" ? "N/A" : "Subject")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 3. Add Button (Centered Circle or Block) */}
              <TouchableOpacity
                onPress={handleAddEntry}
                style={{
                  backgroundColor: theme.bgSecondary,
                  borderColor: theme.accent,
                }}
                className="self-center p-3 rounded-full border mb-6"
              >
                <Ionicons name="add" size={28} color={theme.accent} />
              </TouchableOpacity>

              {/* --- ADDED ENTRIES LIST --- */}
              {entries.length > 0 && (
                <View className="mb-6">
                  <Text
                    style={{ color: theme.textMuted }}
                    className="text-xs mb-2 uppercase tracking-widest"
                  >
                    Added Classes
                  </Text>
                  {entries.map((entry, index) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: theme.bgSecondary,
                        borderColor: theme.border,
                      }}
                      className="flex-row items-center justify-between p-3 rounded-lg mb-2 border"
                    >
                      <View className="flex-row items-center">
                        <View
                          style={{ backgroundColor: theme.accent }}
                          className="px-2 py-1 rounded mr-3"
                        >
                          <Text
                            style={{ color: theme.textDark }}
                            className="font-bold text-xs"
                          >
                            {entry.class}
                          </Text>
                        </View>
                        <Text
                          style={{ color: theme.textPrimary }}
                          className="font-semibold"
                        >
                          {entry.subject}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveEntry(index)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={theme.errorBright || "#ff4444"}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                onPress={handleSendOTP}
                disabled={loading}
                style={{
                  backgroundColor: loading ? theme.gray500 : theme.accent,
                }}
                className="p-4 rounded-xl items-center mt-auto shadow-lg"
              >
                {loading ? (
                  <ActivityIndicator color={theme.textDark} />
                ) : (
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
                    Get OTP & Verify
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            // Step 2: OTP
            <>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-center mb-6"
              >
                Enter OTP sent to +91 {phone}
              </Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                style={{
                  backgroundColor: theme.bgSecondary,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl mb-6 text-center text-2xl tracking-widest border"
                placeholder="------"
                placeholderTextColor={theme.textMuted}
                autoFocus
              />
              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                style={{
                  backgroundColor: loading ? theme.gray500 : theme.accent,
                }}
                className="p-4 rounded-xl items-center"
              >
                {loading ? (
                  <ActivityIndicator color={theme.textDark} />
                ) : (
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
                    Verify & Register
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(1)}
                className="mt-4 items-center"
              >
                <Text style={{ color: theme.textMuted }}>Wrong Details?</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- REUSABLE SELECTION MODAL --- */}
      <Modal
        visible={!!modalType}
        transparent
        animationType="fade"
        onRequestClose={() => setModalType(null)}
      >
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center p-6"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="rounded-xl max-h-[70%] border"
          >
            <Text
              style={{
                color: theme.accent,
                borderColor: theme.border,
              }}
              className="text-center font-bold text-lg p-4 border-b capitalize"
            >
              Select {modalType}
            </Text>

            <FlatList
              data={modalType === "class" ? ALL_CLASSES : availableSubjects}
              keyExtractor={(i) => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    if (modalType === "class") {
                      setTempClass(item);
                      // Subject logic will be handled by useEffect
                    } else {
                      setTempSubject(item);
                    }
                    setModalType(null);
                  }}
                  style={{ borderColor: theme.border }}
                  className="p-4 border-b items-center"
                >
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="font-bold text-lg"
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              onPress={() => setModalType(null)}
              style={{ backgroundColor: theme.bgPrimary }}
              className="p-4 items-center rounded-b-xl"
            >
              <Text style={{ color: theme.errorBright }} className="font-bold">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TeacherSignUp;
