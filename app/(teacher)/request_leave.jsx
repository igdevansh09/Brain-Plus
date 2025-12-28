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

const TeacherRequestLeave = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);

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
    info: "#29B6F6",
  };

  const fetchData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      if (!profile) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) setProfile(userDoc.data());
      }

      const q = query(
        collection(db, "teacher_leaves"),
        where("teacherId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistory(list);
    } catch (error) {
      console.log("Error:", error);
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
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const onChangeStartDate = (event, selectedDate) => {
    setShowStartDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setStartDate(selectedDate);
      if (selectedDate > endDate) setEndDate(selectedDate);
    }
  };

  const onChangeEndDate = (event, selectedDate) => {
    setShowEndDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setEndDate(selectedDate);
      if (selectedDate < startDate) setStartDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      showToast("Please provide a reason.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "teacher_leaves"), {
        teacherId: auth.currentUser.uid,
        teacherName: profile?.name || "Teacher",
        reason,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        status: "Informed",
        createdAt: new Date().toISOString(),
      });
      
      showToast("Admin notified successfully.", "success");
      setReason("");
      fetchData();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={{ backgroundColor: colors.card, borderLeftColor: colors.info, borderLeftWidth: 4 }} className="p-4 rounded-xl mb-3">
      <View className="flex-row justify-between">
        <Text style={{ color: colors.text, fontWeight: "bold" }}>{item.reason}</Text>
        <Ionicons name="checkmark-circle-outline" size={20} color={colors.info} />
      </View>
      <Text style={{ color: colors.subText, marginTop: 4 }}>
        From: {item.startDate}  To: {item.endDate}
      </Text>
      <Text style={{ color: colors.info, fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
        Status: Notified
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className={`flex-1 ${colors.bg} justify-center items-center`}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} className="pt-8">
      <StatusBar backgroundColor={colors.bg} barStyle="light-content" />

      <CustomToast 
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
      
      <View className="px-4 pb-4 py-7 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text className="text-white text-xl font-bold ml-4">Notify Absence</Text>
      </View>

      <ScrollView className="flex-1 px-4" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        
        <View className="p-4 rounded-xl mb-6" style={{ backgroundColor: colors.card }}>
          <Text style={{ color: colors.accent, marginBottom: 15, fontWeight: "bold" }}>New Notification</Text>
          
          <View className="flex-row justify-between mb-4">
            <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={{ borderColor: colors.inputBorder }} className="p-3 rounded-lg border w-[48%]">
              <Text style={{ color: colors.subText, fontSize: 10 }}>From</Text>
              <Text style={{ color: colors.text, fontWeight: "bold" }}>{formatDate(startDate)}</Text>
            </TouchableOpacity>
            {showStartDatePicker && <DateTimePicker value={startDate} mode="date" onChange={onChangeStartDate} />}

            <TouchableOpacity onPress={() => setShowEndDatePicker(true)} style={{ borderColor: colors.inputBorder }} className="p-3 rounded-lg border w-[48%]">
              <Text style={{ color: colors.subText, fontSize: 10 }}>To</Text>
              <Text style={{ color: colors.text, fontWeight: "bold" }}>{formatDate(endDate)}</Text>
            </TouchableOpacity>
            {showEndDatePicker && <DateTimePicker value={endDate} mode="date" onChange={onChangeEndDate} />}
          </View>

          <TextInput
            placeholder="Reason for absence..."
            placeholderTextColor={colors.subText}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            style={{ backgroundColor: colors.bg, color: colors.text, textAlignVertical: "top", borderColor: colors.inputBorder }}
            className="p-3 rounded-lg border mb-4"
          />

          <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={{ backgroundColor: colors.accent }} className="py-3 rounded-lg items-center">
            {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={{ color: colors.bg, fontWeight: "bold" }}>Inform Admin</Text>}
          </TouchableOpacity>
        </View>

        <Text style={{ color: colors.accent, fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>My History</Text>
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={{ color: colors.subText, textAlign: "center", marginTop: 20 }}>No notifications sent.</Text>}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherRequestLeave;