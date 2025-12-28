import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Platform,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { auth, db } from "../../config/firebaseConfig";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import CustomToast from "../../components/CustomToast";

const ApplyLeaves = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [studentProfile, setStudentProfile] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState([]);

  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const colors = {
    bg: "#282C34",
    card: "#333842",
    accent: "#f49b33",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    inputBorder: "#616A7D",
    success: "#4CAF50",
  };

  const fetchData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      if (!studentProfile) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setStudentProfile(userDoc.data());
        }
      }

      const q = query(
        collection(db, "leaves"),
        where("studentId", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setLeaveHistory(list);
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const formatDate = (date) => {
    if (date instanceof Date && !isNaN(date)) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
    return "Select Date";
  };

  const onChangeStartDate = (event, selectedDate) => {
    const currentDate = selectedDate || startDate;
    setShowStartDatePicker(Platform.OS === "ios");
    setStartDate(currentDate);
    if (currentDate > endDate) setEndDate(currentDate);
  };

  const onChangeEndDate = (event, selectedDate) => {
    const currentDate = selectedDate || endDate;
    setShowEndDatePicker(Platform.OS === "ios");
    setEndDate(currentDate);
    if (currentDate < startDate) setStartDate(currentDate);
  };

  const handleSubmitLeave = async () => {
    if (!reason.trim()) {
      showToast("Please provide a reason.", "error");
      return;
    }
    if (!studentProfile?.standard) {
      showToast("Class info missing. Contact admin.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const leaveRequest = {
        studentId: auth.currentUser.uid,
        studentName: studentProfile.name,
        classId: studentProfile.standard,
        reason: reason,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        status: "Informed", 
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "leaves"), leaveRequest);

      showToast("Teacher has been informed.", "success");
      setReason("");
      setStartDate(new Date());
      setEndDate(new Date());

      fetchData();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderLeaveItem = ({ item }) => (
    <View
      style={{ backgroundColor: colors.card, borderLeftColor: colors.success }}
      className="p-4 rounded-xl mb-3 border-l-4"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text
            style={{ color: colors.text }}
            className="text-base font-semibold mb-1"
          >
            {item.reason}
          </Text>
          <Text style={{ color: colors.subText }} className="text-xs">
            {item.startDate} to {item.endDate}
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${colors.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      className="pt-8"
    >
      <StatusBar backgroundColor={colors.bg} barStyle="light-content" />

      <CustomToast 
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <Ionicons
          name="arrow-back"
          size={24}
          color={colors.text}
          onPress={() => router.back()}
        />
        <Text
          style={{ color: colors.text }}
          className="text-2xl font-semibold ml-4"
        >
          Leave Notification
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <View
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: colors.card }}
        >
          <Text
            style={{ color: colors.accent }}
            className="text-xl font-semibold mb-4"
          >
            Inform Teacher
          </Text>

          <View className="flex-row justify-between mb-4">
            <TouchableOpacity
              onPress={() => setShowStartDatePicker(true)}
              style={{ borderColor: colors.inputBorder, width: "48%" }}
              className="p-3 rounded-lg border"
            >
              <Text style={{ color: colors.subText, fontSize: 10 }}>From</Text>
              <Text style={{ color: colors.text, fontWeight: "bold" }}>
                {formatDate(startDate)}
              </Text>
            </TouchableOpacity>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={onChangeStartDate}
              />
            )}

            <TouchableOpacity
              onPress={() => setShowEndDatePicker(true)}
              style={{ borderColor: colors.inputBorder, width: "48%" }}
              className="p-3 rounded-lg border"
            >
              <Text style={{ color: colors.subText, fontSize: 10 }}>To</Text>
              <Text style={{ color: colors.text, fontWeight: "bold" }}>
                {formatDate(endDate)}
              </Text>
            </TouchableOpacity>
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={onChangeEndDate}
              />
            )}
          </View>

          <Text style={{ color: colors.subText }} className="text-sm mb-2">
            Reason
          </Text>
          <TextInput
            multiline
            numberOfLines={3}
            placeholder="E.g. Sick leave, Family function..."
            placeholderTextColor={colors.subText}
            value={reason}
            onChangeText={setReason}
            style={{
              backgroundColor: colors.bg,
              color: colors.text,
              borderColor: colors.inputBorder,
              textAlignVertical: "top",
            }}
            className="p-3 rounded-lg border mb-6 text-base"
          />

          <TouchableOpacity
            onPress={handleSubmitLeave}
            disabled={submitting}
            style={{ backgroundColor: colors.accent }}
            className="py-3 rounded-xl items-center"
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={{ color: colors.bg }} className="text-lg font-bold">
                Send Notification
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text
          style={{ color: colors.accent }}
          className="text-xl font-semibold mb-3"
        >
          Sent History
        </Text>
        <FlatList
          data={leaveHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderLeaveItem}
          scrollEnabled={false}
          ListEmptyComponent={() => (
            <Text
              style={{ color: colors.subText }}
              className="text-center mt-4 italic"
            >
              No notifications sent.
            </Text>
          )}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ApplyLeaves;