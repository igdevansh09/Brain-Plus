import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import CustomToast from "../../components/CustomToast";

const logo = require("../../assets/images/dinetimelogo.png");

const TeacherSignIn = () => {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmResult, setConfirmResult] = useState(null);
  const [step, setStep] = useState("PHONE");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const isValidPhone = (number) => /^[6-9]\d{9}$/.test(number);

  const sendOTP = async () => {
    Keyboard.dismiss();
    if (!isValidPhone(phone))
      return showToast("Enter valid 10-digit number", "error");
    setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirmResult(confirmation);
      setStep("OTP");
      setResendTimer(60);
      showToast("OTP sent!", "success");
    } catch (error) {
      console.error(error);
      
      // --- FIXED ERROR HANDLING ---
      if (error.code === 'auth/too-many-requests') {
        showToast("Too many attempts. Please try again in 1 hour.", "error");
      } else if (error.code === 'auth/invalid-phone-number') {
        showToast("Invalid phone number format.", "error");
      } else if (error.code === 'auth/quota-exceeded') {
        showToast("SMS Quota Exceeded. Contact Support.", "error");
      } else {
        showToast("Failed to send OTP. Try again later.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    Keyboard.dismiss();
    if (otp.length !== 6) return showToast("Enter 6-digit OTP", "error");
    setLoading(true);
    try {
      const userCredential = await confirmResult.confirm(otp);
      const uid = userCredential.user.uid;

      const userDoc = await firestore().collection("users").doc(uid).get();

      if (!userDoc.exists) {
        showToast("Account not found. Please Register.", "error");
        await forceLogoutAfterDelay();
        return;
      }

      const userData = userDoc.data();

      // ✅ CHECK: Role must be Teacher
      if (userData?.role !== "teacher") {
        showToast("Not a Teacher account.", "error");
        await forceLogoutAfterDelay();
        return;
      }

      // ✅ CHECK: Verified Status Only (isApproved removed)
      if (userData?.verified === false) {
        showToast("Account pending Admin approval.", "error");
        await forceLogoutAfterDelay();
        return;
      }

      showToast("Login Successful!", "success");
      // Router redirection is handled by _layout.jsx automatically
    } catch (error) {
      console.error("Verify Error:", error);
      if (error.code === "auth/invalid-verification-code") {
        showToast("Invalid OTP code.", "error");
      } else if (error.code === "auth/session-expired") {
        showToast("OTP expired. Resend it.", "error");
      } else {
        showToast("Login failed. Try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const forceLogoutAfterDelay = async () => {
    setTimeout(async () => {
      await auth().signOut();
      setStep("PHONE");
      setOtp("");
      setConfirmResult(null);
    }, 2500);
  };

  const handleEditPhone = () => {
    setStep("PHONE");
    setOtp("");
    setConfirmResult(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#282C34]">
      <StatusBar barStyle="light-content" backgroundColor="#282C34" />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <View className="px-4 py-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-semibold ml-4">Back</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <View className="items-center mb-8">
              <Image
                source={logo}
                style={{ width: 250, height: 250 }}
                resizeMode="contain"
              />
              <Text className="text-white text-3xl font-bold mt-4">
                Teacher Login
              </Text>
              <Text className="text-gray-400 text-sm mt-2">
                {step === "PHONE" ? "Enter mobile number" : "Enter OTP"}
              </Text>
            </View>

            {step === "PHONE" ? (
              <View>
                <View className="flex-row items-center bg-[#333842] rounded-xl border border-[#4C5361] mb-6">
                  <View className="px-4 py-4 border-r border-[#4C5361]">
                    <Text className="text-white font-bold">+91</Text>
                  </View>
                  <TextInput
                    placeholder="9876543210"
                    placeholderTextColor="#666"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    className="flex-1 text-white px-4 py-4 text-lg"
                  />
                </View>
                <TouchableOpacity
                  onPress={sendOTP}
                  disabled={loading || !isValidPhone(phone)}
                  className={`p-4 rounded-xl items-center ${loading ? "bg-gray-600" : "bg-[#f49b33]"}`}
                >
                  {loading ? (
                    <ActivityIndicator color="#282C34" />
                  ) : (
                    <Text className="text-[#282C34] font-bold text-lg">
                      Send OTP
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/teachersignup")}
                  className="mt-6"
                >
                  <Text className="text-gray-400 text-center">
                    New Teacher?{" "}
                    <Text className="text-[#f49b33] font-bold">
                      Register Here
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View className="bg-[#333842] rounded-xl p-4 mb-6 flex-row justify-between items-center border border-[#4C5361]">
                  <Text className="text-white font-bold text-lg">
                    +91 {phone}
                  </Text>
                  <TouchableOpacity onPress={handleEditPhone}>
                    <Text className="text-[#f49b33] font-bold">Change</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  placeholder="• • • • • •"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  className="bg-[#333842] text-white p-4 rounded-xl mb-4 text-center text-2xl tracking-widest border border-[#4C5361]"
                  autoFocus
                />

                <View className="flex-row justify-center mb-6">
                  {resendTimer > 0 ? (
                    <Text className="text-gray-500">
                      Resend OTP in {resendTimer}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={sendOTP}>
                      <Text className="text-[#f49b33] font-bold">
                        Resend OTP
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={verifyOTP}
                  disabled={loading}
                  className="bg-[#f49b33] p-4 rounded-xl items-center"
                >
                  {loading ? (
                    <ActivityIndicator color="#282C34" />
                  ) : (
                    <Text className="text-[#282C34] font-bold text-lg">
                      Verify & Login
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default TeacherSignIn;
