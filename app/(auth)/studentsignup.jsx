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
// Refactor: Modular Imports
import { signInWithPhoneNumber, signOut } from "@react-native-firebase/auth";
import { doc, setDoc, serverTimestamp } from "@react-native-firebase/firestore";
import { getToken } from "@react-native-firebase/messaging";
import { auth, db, messaging } from "../../config/firebaseConfig";

import CustomToast from "../../components/CustomToast";
import { useTheme } from "../../context/ThemeContext";

// --- CONSTANTS ---
const CLASSES = [
  "CS",
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
];
const STREAMS = ["Science", "Commerce", "Arts"];

const SUB_GENERAL = ["English", "Hindi", "Maths", "Science", "Social Science"];
const SUB_SCIENCE = [
  "Physics",
  "Chemistry",
  "Maths",
  "Biology",
  "English",
  "CS",
];
const SUB_COMMERCE = [
  "Accounts",
  "Business Studies",
  "Economics",
  "Maths",
  "English",
];
const SUB_ARTS = [
  "History",
  "Geography",
  "Political Science",
  "Economics",
  "English",
  "Hindi",
];

const StudentSignUp = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  const [modalType, setModalType] = useState(null); // 'class' | 'stream'
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [isSubjectLocked, setIsSubjectLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type) => setToast({ visible: true, msg, type });

  // --- EFFECT: Handle Class/Stream Changes ---
  useEffect(() => {
    if (!selectedClass) {
      setAvailableSubjects([]);
      setIsSubjectLocked(false);
      setLockMessage("");
      return;
    }

    if (selectedClass === "CS") {
      setIsSubjectLocked(true);
      setLockMessage("No subjects needed for CS.");
      setSelectedSubjects(["N/A"]);
      setSelectedStream("N/A");
    } else if (["Prep", "1st", "2nd", "3rd"].includes(selectedClass)) {
      setIsSubjectLocked(true);
      setLockMessage("Course covers All Subjects.");
      setSelectedSubjects(["All Subjects"]);
      setSelectedStream("N/A");
    } else if (
      ["4th", "5th", "6th", "7th", "8th", "9th", "10th"].includes(selectedClass)
    ) {
      setIsSubjectLocked(false);
      setLockMessage("");
      setAvailableSubjects(SUB_GENERAL);
      setSelectedStream("N/A");
      setSelectedSubjects([]);
    } else if (["11th", "12th"].includes(selectedClass)) {
      setIsSubjectLocked(false);
      setLockMessage("");
      if (selectedStream === "Science") setAvailableSubjects(SUB_SCIENCE);
      else if (selectedStream === "Commerce")
        setAvailableSubjects(SUB_COMMERCE);
      else if (selectedStream === "Arts") setAvailableSubjects(SUB_ARTS);
      else setAvailableSubjects([]);
      setSelectedSubjects([]);
    }
  }, [selectedClass, selectedStream]);

  const toggleSubject = (subject) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects((prev) => prev.filter((s) => s !== subject));
    } else {
      setSelectedSubjects((prev) => [...prev, subject]);
    }
  };

  const handleSendOTP = async () => {
    Keyboard.dismiss();
    if (!name.trim()) return showToast("Enter Full Name", "error");
    if (!phone || phone.length !== 10)
      return showToast("Invalid Phone Number", "error");
    if (!selectedClass) return showToast("Select your Class", "error");
    if (["11th", "12th"].includes(selectedClass) && !selectedStream) {
      return showToast("Select your Stream", "error");
    }
    if (!isSubjectLocked && selectedSubjects.length === 0) {
      return showToast("Select at least one subject", "error");
    }

    setLoading(true);
    try {
      // Modular: signInWithPhoneNumber
      const confirmation = await signInWithPhoneNumber(auth, `+91${phone}`);
      setConfirmResult(confirmation);
      setStep(2);
      showToast("OTP Sent!", "success");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/too-many-requests") {
        showToast("Too many attempts. Please try again in 1 hour.", "error");
      }else if (error.code === "auth/invalid-phone-number") {
        showToast("Invalid phone number format.", "error");
      } else if (error.code === "auth/quota-exceeded") {
        showToast("SMS Quota Exceeded. Contact Support.", "error")
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

      // 2. FETCH THE TOKEN (Modular)
      let fcmToken = "";
      try {
        fcmToken = await getToken(messaging);
      } catch (e) {
        console.log("Failed to get FCM token", e);
      }

      // 3. SAVE TO FIRESTORE (Modular)
      await setDoc(doc(db, "users", uid), {
        name: name.trim(),
        phone: `+91${phone}`,
        role: "student",
        standard: selectedClass,
        stream: selectedStream || "N/A",
        enrolledSubjects: selectedSubjects,
        verified: false,
        monthlyFeeAmount: "0",
        fcmToken: fcmToken,
        createdAt: serverTimestamp(),
      });

      showToast("Registration Success! Wait for Admin Approval.", "success");

      setTimeout(async () => {
        await signOut(auth);
        router.replace("/(auth)/studentsignin");
      }, 500);
    } catch (error) {
      console.error(error);
      showToast("Registration Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: theme.bgPrimary, flex: 1 }}>
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
          <View className="flex-row items-center mb-6">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text
              style={{ color: theme.textPrimary }}
              className="text-3xl font-bold"
            >
              Student Reg.
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
                placeholder="Student Name"
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
                className="p-4 rounded-xl mb-4 border"
                placeholder="9876543210"
                placeholderTextColor={theme.textMuted}
              />

              {/* Class Selector */}
              <Text
                style={{ color: theme.accent }}
                className="mb-1 ml-1 font-semibold"
              >
                Class
              </Text>
              <TouchableOpacity
                onPress={() => setModalType("class")}
                style={{
                  backgroundColor: theme.bgSecondary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl border mb-4"
              >
                <Text
                  style={{
                    color: selectedClass ? theme.textPrimary : theme.textMuted,
                    fontWeight: selectedClass ? "bold" : "normal",
                  }}
                >
                  {selectedClass || "Select Class"}
                </Text>
              </TouchableOpacity>

              {["11th", "12th"].includes(selectedClass) && (
                <>
                  <Text
                    style={{ color: theme.accent }}
                    className="mb-1 ml-1 font-semibold"
                  >
                    Stream
                  </Text>
                  <View className="flex-row justify-between mb-4">
                    {STREAMS.map((stm) => (
                      <TouchableOpacity
                        key={stm}
                        onPress={() => setSelectedStream(stm)}
                        style={{
                          backgroundColor:
                            selectedStream === stm
                              ? theme.accent
                              : theme.bgSecondary,
                          borderColor:
                            selectedStream === stm
                              ? theme.accent
                              : theme.border,
                        }}
                        className="flex-1 p-3 rounded-xl border mr-2 items-center"
                      >
                        <Text
                          style={{
                            color:
                              selectedStream === stm
                                ? theme.textDark
                                : theme.textPrimary,
                            fontWeight: "bold",
                          }}
                        >
                          {stm}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Subject Selection Grid */}
              <Text
                style={{ color: theme.accent }}
                className="mb-2 ml-1 font-semibold"
              >
                Subjects to Enroll
              </Text>

              {isSubjectLocked ? (
                <View
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                  }}
                  className="p-4 rounded-xl border mb-6 opacity-80"
                >
                  <Text
                    style={{ color: theme.textMuted }}
                    className="italic text-center"
                  >
                    {lockMessage}
                  </Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap mb-6">
                  {availableSubjects.length > 0 ? (
                    availableSubjects.map((sub) => {
                      const isSelected = selectedSubjects.includes(sub);
                      return (
                        <TouchableOpacity
                          key={sub}
                          onPress={() => toggleSubject(sub)}
                          style={{
                            backgroundColor: isSelected
                              ? theme.accent
                              : theme.bgSecondary,
                            borderColor: isSelected
                              ? theme.accent
                              : theme.border,
                          }}
                          className="mr-2 mb-2 px-4 py-2 rounded-full border"
                        >
                          <Text
                            style={{
                              color: isSelected
                                ? theme.textDark
                                : theme.textPrimary,
                              fontWeight: "bold",
                            }}
                          >
                            {sub}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text
                      style={{ color: theme.textMuted }}
                      className="italic ml-2"
                    >
                      Select Class{" "}
                      {["11th", "12th"].includes(selectedClass)
                        ? "& Stream"
                        : ""}{" "}
                      first.
                    </Text>
                  )}
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
                    Get OTP
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

      {/* Class Selection Modal */}
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
              className="text-center font-bold text-lg p-4 border-b"
            >
              Select Class
            </Text>
            <FlatList
              data={CLASSES}
              keyExtractor={(i) => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedClass(item);
                    setModalType(null);
                  }}
                  style={{ borderColor: theme.border }}
                  className="p-4 border-b items-center"
                >
                  <Text
                    style={{
                      color:
                        selectedClass === item
                          ? theme.accent
                          : theme.textPrimary,
                      fontSize: 18,
                      fontWeight: selectedClass === item ? "bold" : "normal",
                    }}
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

export default StudentSignUp;
 
