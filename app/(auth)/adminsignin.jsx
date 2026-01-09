import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Formik } from "formik";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";

import logo from "../../assets/images/dinetimelogo.png";
import validationSchema from "../../utils/adminSchema";
import CustomToast from "../../components/CustomToast";
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

const entryImg = require("../../assets/images/Frame.png");

const AdminSignin = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get theme values
  const [loading, setLoading] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleAdminLogin = async (values) => {
    setLoading(true);
    try {
      const userCredential = await auth().signInWithEmailAndPassword(
        values.email,
        values.password
      );

      const user = userCredential.user;
      const idTokenResult = await user.getIdTokenResult(true);

      if (idTokenResult.claims.role === "admin") {
        console.log("✅ Verified Admin");
        // Success! AuthContext will pick this up and Redirect automatically.
      } else {
        // Not an admin? Sign them out immediately.
        await auth().signOut();
        showToast("Access Denied: You are not an Admin.", "error");
      }
    } catch (error) {
      console.error("Login Error:", error);
      let msg = "Login failed.";

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found"
      ) {
        msg = "Invalid Email or Password.";
      } else if (error.code === "auth/invalid-email") {
        msg = "Invalid Email format.";
      } else if (error.code === "auth/too-many-requests") {
        msg = "Too many failed attempts. Try later.";
      }

      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView 
      style={{ backgroundColor: theme.bgPrimary, flex: 1 }} // Dynamic Background
    >
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={theme.bgPrimary} 
      />

      <CustomToast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <View className="px-4 py-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: theme.textPrimary }} className="text-lg font-semibold ml-4">
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
              paddingBottom: 20,
            }}
          >
            <View className="m-1 flex justify-center items-center">
              <Image source={logo} style={{ width: 300, height: 200 }} />
              <Text 
                style={{ color: theme.textPrimary }} 
                className="text-lg text-center font-bold mb-10"
              >
                Admin Login
              </Text>

              <View className="w-5/6">
                <Formik
                  initialValues={{ email: "", password: "" }}
                  validationSchema={validationSchema}
                  onSubmit={handleAdminLogin}
                >
                  {({
                    handleChange,
                    handleBlur,
                    handleSubmit,
                    values,
                    errors,
                    touched,
                  }) => (
                    <View className="w-full">
                      {/* Email Input */}
                      <Text style={{ color: theme.accent }} className="mt-2 mb-2">
                        Email
                      </Text>
                      <TextInput
                        style={{ 
                          borderColor: theme.border, 
                          color: theme.textPrimary,
                          backgroundColor: theme.bgSecondary 
                        }}
                        className="h-12 border rounded px-3 mb-1"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onChangeText={handleChange("email")}
                        value={values.email}
                        onBlur={handleBlur("email")}
                        placeholder="admin@example.com"
                        placeholderTextColor={theme.textMuted}
                      />
                      {touched.email && errors.email && (
                        <Text style={{ color: theme.error }} className="text-xs mb-3">
                          {errors.email}
                        </Text>
                      )}

                      {/* Password Input */}
                      <Text style={{ color: theme.accent }} className="mt-2 mb-2">
                        Password
                      </Text>
                      <TextInput
                        style={{ 
                          borderColor: theme.border, 
                          color: theme.textPrimary,
                          backgroundColor: theme.bgSecondary 
                        }}
                        className="h-12 border rounded px-3 mb-1"
                        secureTextEntry
                        onChangeText={handleChange("password")}
                        value={values.password}
                        onBlur={handleBlur("password")}
                        placeholder="********"
                        placeholderTextColor={theme.textMuted}
                      />
                      {touched.password && errors.password && (
                        <Text style={{ color: theme.error }} className="text-xs mb-3">
                          {errors.password}
                        </Text>
                      )}

                      {/* Submit Button */}
                      <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading}
                        style={{ 
                          backgroundColor: loading ? theme.gray600 : theme.accent 
                        }}
                        className="p-3 my-2 rounded-lg mt-8"
                      >
                        {loading ? (
                          <ActivityIndicator color={theme.bgPrimary} />
                        ) : (
                          <Text 
                            style={{ color: theme.textDark }} 
                            className="text-lg font-semibold text-center"
                          >
                            Sign In
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </Formik>
              </View>
            </View>
            <View className="flex-1">
              <Image
                source={entryImg}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AdminSignin;