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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import CustomToast from "../../components/CustomToast";
import messaging from "@react-native-firebase/messaging";

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

// Subject Pools
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);

  // Form Data
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  // UI State
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
    // Reset Logic on Class Change
    if (!selectedClass) {
      setAvailableSubjects([]);
      setIsSubjectLocked(false);
      setLockMessage("");
      return;
    }

    // 1. CS Logic
    if (selectedClass === "CS") {
      setIsSubjectLocked(true);
      setLockMessage("No subjects needed for CS.");
      setSelectedSubjects(["N/A"]);
      setSelectedStream("N/A");
    }
    // 2. Prep to 3rd Logic
    else if (["Prep", "1st", "2nd", "3rd"].includes(selectedClass)) {
      setIsSubjectLocked(true);
      setLockMessage("Course covers All Subjects.");
      setSelectedSubjects(["All Subjects"]);
      setSelectedStream("N/A");
    }
    // 3. 4th to 10th Logic
    else if (
      ["4th", "5th", "6th", "7th", "8th", "9th", "10th"].includes(selectedClass)
    ) {
      setIsSubjectLocked(false);
      setLockMessage("");
      setAvailableSubjects(SUB_GENERAL);
      setSelectedStream("N/A");
      // Clear previous selections if they don't match
      setSelectedSubjects([]);
    }
    // 4. 11th & 12th Logic
    else if (["11th", "12th"].includes(selectedClass)) {
      setIsSubjectLocked(false);
      setLockMessage("");

      // Populate subjects based on Stream
      if (selectedStream === "Science") setAvailableSubjects(SUB_SCIENCE);
      else if (selectedStream === "Commerce")
        setAvailableSubjects(SUB_COMMERCE);
      else if (selectedStream === "Arts") setAvailableSubjects(SUB_ARTS);
      else setAvailableSubjects([]); // Wait for stream selection

      setSelectedSubjects([]);
    }
  }, [selectedClass, selectedStream]);

  // --- HANDLER: Toggle Subject (Multi-Select) ---
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

    // Stream check
    if (["11th", "12th"].includes(selectedClass) && !selectedStream) {
      return showToast("Select your Stream", "error");
    }

    // Subject check (if not locked)
    if (!isSubjectLocked && selectedSubjects.length === 0) {
      return showToast("Select at least one subject", "error");
    }

    setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirmResult(confirmation);
      setStep(2);
      showToast("OTP Sent!", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to send OTP", "error");
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

      // 2. FETCH THE TOKEN (Handle errors gracefully)
      let fcmToken = "";
      try {
        fcmToken = await messaging().getToken();
      } catch (e) {
        console.log("Failed to get FCM token", e);
      }

      // 3. SAVE IT TO FIRESTORE
      await firestore()
        .collection("users")
        .doc(uid)
        .set({
          name: name.trim(),
          phone: `+91${phone}`,
          role: "student",
          standard: selectedClass,
          stream: selectedStream || "N/A",
          enrolledSubjects: selectedSubjects,
          verified: false,
          monthlyFeeAmount: "0",
          fcmToken: fcmToken, // <--- CRITICAL ADDITION
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      showToast("Registration Success! Wait for Admin Approval.", "success");

      setTimeout(async () => {
        await auth().signOut();
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
    <SafeAreaView className="flex-1 bg-[#282C34]">
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
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-3xl font-bold">Student Reg.</Text>
          </View>

          {step === 1 ? (
            <>
              {/* Basic Info */}
              <Text className="text-[#f49b33] mb-1 ml-1 font-semibold">
                Full Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                className="bg-[#333842] text-white p-4 rounded-xl mb-4 border border-gray-600"
                placeholder="Student Name"
                placeholderTextColor="#666"
              />

              <Text className="text-[#f49b33] mb-1 ml-1 font-semibold">
                Phone
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                className="bg-[#333842] text-white p-4 rounded-xl mb-4 border border-gray-600"
                placeholder="9876543210"
                placeholderTextColor="#666"
              />

              {/* Class Selector */}
              <Text className="text-[#f49b33] mb-1 ml-1 font-semibold">
                Class
              </Text>
              <TouchableOpacity
                onPress={() => setModalType("class")}
                className="bg-[#333842] p-4 rounded-xl border border-gray-600 mb-4"
              >
                <Text
                  className={
                    selectedClass ? "text-white font-bold" : "text-gray-500"
                  }
                >
                  {selectedClass || "Select Class"}
                </Text>
              </TouchableOpacity>

              {/* Stream Selector (Conditional) */}
              {["11th", "12th"].includes(selectedClass) && (
                <>
                  <Text className="text-[#f49b33] mb-1 ml-1 font-semibold">
                    Stream
                  </Text>
                  <View className="flex-row justify-between mb-4">
                    {STREAMS.map((stm) => (
                      <TouchableOpacity
                        key={stm}
                        onPress={() => setSelectedStream(stm)}
                        className={`flex-1 p-3 rounded-xl border mr-2 items-center ${selectedStream === stm ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-gray-600"}`}
                      >
                        <Text
                          className={`font-bold ${selectedStream === stm ? "text-[#282C34]" : "text-white"}`}
                        >
                          {stm}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Subject Selection Grid */}
              <Text className="text-[#f49b33] mb-2 ml-1 font-semibold">
                Subjects to Enroll
              </Text>

              {isSubjectLocked ? (
                // Locked State (CS or Prep-3rd)
                <View className="bg-[#333842] p-4 rounded-xl border border-gray-600 mb-6 opacity-80">
                  <Text className="text-gray-400 italic text-center">
                    {lockMessage}
                  </Text>
                </View>
              ) : (
                // Multi-Select Grid
                <View className="flex-row flex-wrap mb-6">
                  {availableSubjects.length > 0 ? (
                    availableSubjects.map((sub) => {
                      const isSelected = selectedSubjects.includes(sub);
                      return (
                        <TouchableOpacity
                          key={sub}
                          onPress={() => toggleSubject(sub)}
                          className={`mr-2 mb-2 px-4 py-2 rounded-full border ${isSelected ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-gray-600"}`}
                        >
                          <Text
                            className={`font-bold ${isSelected ? "text-[#282C34]" : "text-gray-300"}`}
                          >
                            {sub}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text className="text-gray-500 italic ml-2">
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
                className="bg-[#f49b33] p-4 rounded-xl items-center mt-auto shadow-lg"
              >
                {loading ? (
                  <ActivityIndicator color="#282C34" />
                ) : (
                  <Text className="text-[#282C34] font-bold text-lg">
                    Get OTP
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            // Step 2: OTP
            <>
              <Text className="text-gray-400 text-center mb-6">
                Enter OTP sent to +91 {phone}
              </Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                className="bg-[#333842] text-white p-4 rounded-xl mb-6 text-center text-2xl tracking-widest border border-gray-600"
                placeholder="------"
                placeholderTextColor="#666"
                autoFocus
              />
              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                className="bg-[#f49b33] p-4 rounded-xl items-center"
              >
                {loading ? (
                  <ActivityIndicator color="#282C34" />
                ) : (
                  <Text className="text-[#282C34] font-bold text-lg">
                    Verify & Register
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(1)}
                className="mt-4 items-center"
              >
                <Text className="text-gray-400">Wrong Details?</Text>
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
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View className="bg-[#333842] rounded-xl max-h-[70%] border border-[#f49b33]">
            <Text className="text-[#f49b33] text-center font-bold text-lg p-4 border-b border-gray-700">
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
                  className="p-4 border-b border-gray-700 items-center"
                >
                  <Text
                    className={`text-lg font-bold ${selectedClass === item ? "text-[#f49b33]" : "text-white"}`}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setModalType(null)}
              className="p-4 items-center bg-[#282C34] rounded-b-xl"
            >
              <Text className="text-red-400 font-bold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default StudentSignUp;
