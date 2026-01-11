import { useState, useEffect } from "react";
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
// Refactor: Modular Imports
import { signInWithPhoneNumber, signOut } from "@react-native-firebase/auth";
import { doc, getDoc } from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig";

import CustomToast from "../../components/CustomToast";
import { useTheme } from "../../context/ThemeContext";

const logo = require("../../assets/images/dinetimelogo.png");
const logo2 = require("../../assets/images/dinetimelogo2.png");

const StudentSignIn = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();

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
      // Modular: signInWithPhoneNumber
      const confirmation = await signInWithPhoneNumber(auth, `+91${phone}`);
      setConfirmResult(confirmation);
      setStep("OTP");
      setResendTimer(60);
      showToast("OTP sent!", "success");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/too-many-requests") {
        showToast("Too many attempts. Please try again in 1 hour.", "error");
      } else if (error.code === "auth/invalid-phone-number") {
        showToast("Invalid phone number format.", "error");
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
      // Confirm result is method on the object returned by signInWithPhoneNumber
      const userCredential = await confirmResult.confirm(otp);
      const uid = userCredential.user.uid;

      // Modular: getDoc(doc(...))
      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        showToast("Account not found. Please Register.", "error");
        await forceLogoutAfterDelay();
        return;
      }

      const userData = userDoc.data();

      if (userData?.role !== "student") {
        showToast("Not a Valid account.", "error");
        await forceLogoutAfterDelay();
        return;
      }

      if (userData?.verified === false) {
        showToast("Account pending Admin approval.", "error");
        await forceLogoutAfterDelay();
        return;
      }

      showToast("Login Successful!", "success");
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
      // Modular: signOut
      await signOut(auth);
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

      <View className="px-4 py-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-lg font-semibold ml-4"
        >
          Back
        </Text>
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
                source={isDark ? logo2 : logo}
                style={{ width: 250, height: 250 }}
                resizeMode="contain"
              />
              <Text
                style={{ color: theme.textPrimary }}
                className="text-3xl font-bold mt-4"
              >
                Student Login
              </Text>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-sm mt-2"
              >
                {step === "PHONE" ? "Enter mobile number" : "Enter OTP sent to"}
              </Text>
            </View>

            {step === "PHONE" ? (
              <View>
                <View
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                  }}
                  className="flex-row items-center rounded-xl border mb-6"
                >
                  <View
                    style={{ borderRightColor: theme.border }}
                    className="px-4 py-4 border-r"
                  >
                    <Text
                      style={{ color: theme.textPrimary }}
                      className="font-bold"
                    >
                      +91
                    </Text>
                  </View>
                  <TextInput
                    placeholder="9876543210"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    style={{ color: theme.textPrimary }}
                    className="flex-1 px-4 py-4 text-lg"
                  />
                </View>
                <TouchableOpacity
                  onPress={sendOTP}
                  disabled={loading || !isValidPhone(phone)}
                  style={{
                    backgroundColor:
                      loading || !isValidPhone(phone)
                        ? theme.gray500
                        : theme.accent,
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
                      Send OTP
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/studentsignup")}
                  className="mt-6"
                >
                  <Text
                    style={{ color: theme.textSecondary }}
                    className="text-center"
                  >
                    New Student?{" "}
                    <Text style={{ color: theme.accent }} className="font-bold">
                      Register Here
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View
                  style={{
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                  }}
                  className="rounded-xl p-4 mb-6 flex-row justify-between items-center border"
                >
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="font-bold text-lg"
                  >
                    +91 {phone}
                  </Text>
                  <TouchableOpacity onPress={handleEditPhone}>
                    <Text style={{ color: theme.accent }} className="font-bold">
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  placeholder="• • • • • •"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  style={{
                    backgroundColor: theme.bgSecondary,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  }}
                  className="p-4 rounded-xl mb-4 text-center text-2xl tracking-widest border"
                  autoFocus
                />

                <View className="flex-row justify-center mb-6">
                  {resendTimer > 0 ? (
                    <Text style={{ color: theme.textSecondary }}>
                      Resend OTP in {resendTimer}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={sendOTP}>
                      <Text
                        style={{ color: theme.accent }}
                        className="font-bold"
                      >
                        Resend OTP
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={verifyOTP}
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

export default StudentSignIn;
