import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  ScrollView,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions"; // <--- Added Function Import
import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";

// --- CONSTANTS ---
const CLASS_OPTIONS = [
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
const STREAM_OPTIONS = ["Science", "Commerce", "Arts"];

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
  "Political Science",
  "Geography",
  "Economics",
  "English",
];

const ManageStudents = () => {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Modal States ---
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // --- Edit Form States ---
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editStream, setEditStream] = useState("");
  const [editFee, setEditFee] = useState("");
  const [editSubjects, setEditSubjects] = useState([]);

  // --- Alert & Toast Config ---
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    type: "warning",
    onConfirm: null,
  });

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });

  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // --- Theme ---
  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    accentBg: "bg-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    borderColor: "border-[#4C5361]",
  };

  // --- FETCH STUDENTS ---
  const fetchStudents = async () => {
    try {
      const snapshot = await firestore()
        .collection("users")
        .where("role", "==", "student")
        .get();
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
    } catch (error) {
      console.log(error);
      showToast("Error fetching students", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  // --- HANDLE DELETE (SECURE) ---
  const handleDelete = (id) => {
    setAlertConfig({
      visible: true,
      title: "Delete Student?",
      message:
        "This will permanently delete the student from Authentication and Database. This action cannot be undone.",
      confirmText: "Delete Permanently",
      type: "warning",
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        setLoading(true);
        try {
          // Call Cloud Function to delete from Auth & Firestore
          const deleteUserFn = functions().httpsCallable("deleteTargetUser");
          await deleteUserFn({ targetUid: id });

          showToast("Student deleted permanently.", "success");
          setStudents((prev) => prev.filter((s) => s.id !== id));
        } catch (error) {
          console.error("Delete Error:", error);
          showToast("Delete failed: " + error.message, "error");
        } finally {
          setLoading(false);
        }
      },
      onCancel: () => setAlertConfig((prev) => ({ ...prev, visible: false })),
    });
  };

  // --- EDIT LOGIC ---
  const openEditModal = (student) => {
    setSelectedStudent(student);
    setEditName(student.name);
    setEditPhone(student.phone);
    setEditClass(student.standard);
    setEditStream(student.stream || "N/A");
    setEditFee(student.monthlyFeeAmount || "");
    setEditSubjects(student.enrolledSubjects || []);
    setEditModalVisible(true);
  };

  const toggleSubject = (sub) => {
    if (editSubjects.includes(sub)) {
      setEditSubjects(editSubjects.filter((s) => s !== sub));
    } else {
      setEditSubjects([...editSubjects, sub]);
    }
  };

  const getAvailableSubjects = () => {
    if (["11th", "12th"].includes(editClass)) {
      if (editStream === "Science") return SUB_SCIENCE;
      if (editStream === "Commerce") return SUB_COMMERCE;
      if (editStream === "Arts") return SUB_ARTS;
    }
    return SUB_GENERAL;
  };

  const handleUpdate = async () => {
    if (!editName || !editFee || !editClass) {
      showToast("Please fill basic fields", "error");
      return;
    }

    setLoading(true);
    try {
      await firestore()
        .collection("users")
        .doc(selectedStudent.id)
        .update({
          name: editName,
          phone: editPhone,
          standard: editClass,
          stream: ["11th", "12th"].includes(editClass) ? editStream : "N/A",
          monthlyFeeAmount: editFee,
          enrolledSubjects: editSubjects,
        });

      showToast("Student updated successfully", "success");
      setEditModalVisible(false);
      fetchStudents();
    } catch (error) {
      showToast("Update failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- DETAIL LOGIC ---
  const openDetailModal = (student) => {
    setSelectedStudent(student);
    setDetailModalVisible(true);
  };

  const handleCall = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  // --- RENDER ITEM ---
  const renderStudent = ({ item }) => (
    <View
      className={`${theme.card} mx-4 mb-3 p-4 rounded-2xl border ${theme.borderColor} flex-row items-center`}
    >
      <TouchableOpacity
        onPress={() => openDetailModal(item)}
        className="flex-row flex-1 items-center"
      >
        <View className="w-12 h-12 bg-[#282C34] rounded-full items-center justify-center border border-[#4C5361] mr-3">
          <Text className={`${theme.accent} font-bold text-lg`}>
            {item.name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text className={`${theme.text} font-bold text-lg`}>{item.name}</Text>
          <Text className={theme.subText}>
            {item.standard} {item.stream !== "N/A" ? `(${item.stream})` : ""} |{" "}
            {item.rollNo || "No Roll"}
          </Text>
        </View>
      </TouchableOpacity>

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20"
        >
          <Ionicons name="create-outline" size={20} color="#3b82f6" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          className="bg-red-500/10 p-2 rounded-lg border border-red-500/20"
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // --- FILTER ---
  const filteredData = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.standard?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !refreshing) {
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
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />

      {/* HEADER */}
      <View className="px-4 py-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className={`${theme.card} p-2 rounded-full border ${theme.borderColor} mr-4`}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className={`${theme.text} text-xl font-bold`}>
          Manage Students
        </Text>
      </View>

      {/* SEARCH */}
      <View className="px-4 mb-4">
        <View
          className={`${theme.card} flex-row items-center px-4 py-3 rounded-xl border ${theme.borderColor}`}
        >
          <Ionicons name="search" size={20} color="gray" className="mr-2" />
          <TextInput
            placeholder="Search student..."
            placeholderTextColor="gray"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className={`${theme.text} flex-1`}
          />
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f49b33"
          />
        }
        ListEmptyComponent={
          <Text className="text-gray-500 text-center mt-10">
            No students found.
          </Text>
        }
      />

      {/* --- EDIT MODAL --- */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className={`${theme.bg} rounded-t-3xl p-6 h-[85%]`}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`${theme.text} text-xl font-bold`}>
                Edit Student
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close-circle" size={30} color="#f49b33" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Name */}
              <Text className={`${theme.subText} mb-2`}>Full Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                className={`${theme.card} ${theme.text} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
              />

              {/* Phone */}
              <Text className={`${theme.subText} mb-2`}>Phone Number</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                className={`${theme.card} ${theme.text} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
              />

              {/* Class Select */}
              <Text className={`${theme.subText} mb-2`}>Class</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                {CLASS_OPTIONS.map((cls) => (
                  <TouchableOpacity
                    key={cls}
                    onPress={() => setEditClass(cls)}
                    className={`mr-2 px-4 py-2 rounded-lg border ${
                      editClass === cls
                        ? `${theme.accentBg} border-[#f49b33]`
                        : `${theme.card} ${theme.borderColor}`
                    }`}
                  >
                    <Text
                      className={`${
                        editClass === cls ? "text-[#282C34]" : "text-gray-400"
                      } font-bold`}
                    >
                      {cls}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Stream Select (Only for 11/12) */}
              {["11th", "12th"].includes(editClass) && (
                <View className="mb-4">
                  <Text className={`${theme.subText} mb-2`}>Stream</Text>
                  <View className="flex-row gap-2">
                    {STREAM_OPTIONS.map((st) => (
                      <TouchableOpacity
                        key={st}
                        onPress={() => setEditStream(st)}
                        className={`flex-1 py-3 rounded-lg border ${
                          editStream === st
                            ? `${theme.accentBg} border-[#f49b33]`
                            : `${theme.card} ${theme.borderColor}`
                        }`}
                      >
                        <Text
                          className={`text-center font-bold ${
                            editStream === st
                              ? "text-[#282C34]"
                              : "text-gray-400"
                          }`}
                        >
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Fee */}
              <Text className={`${theme.subText} mb-2`}>Monthly Fee (₹)</Text>
              <TextInput
                value={editFee}
                onChangeText={setEditFee}
                keyboardType="numeric"
                className={`${theme.card} ${theme.text} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
              />

              {/* Subjects */}
              <Text className={`${theme.subText} mb-2`}>Enrolled Subjects</Text>
              <View className="flex-row flex-wrap gap-2 mb-8">
                {getAvailableSubjects().map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => toggleSubject(sub)}
                    className={`px-3 py-2 rounded-lg border ${
                      editSubjects.includes(sub)
                        ? "bg-green-500/20 border-green-500"
                        : `${theme.card} ${theme.borderColor}`
                    }`}
                  >
                    <Text
                      className={
                        editSubjects.includes(sub)
                          ? "text-green-500 font-bold"
                          : "text-gray-400"
                      }
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleUpdate}
                className={`${theme.accentBg} p-4 rounded-xl items-center mb-10`}
              >
                <Text className="text-[#282C34] font-bold text-lg">
                  Save Changes
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- DETAIL MODAL --- */}
      <Modal visible={detailModalVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/80 justify-center items-center px-4">
          <View
            className={`${theme.bg} w-full rounded-2xl border ${theme.borderColor} p-6 relative`}
          >
            <TouchableOpacity
              onPress={() => setDetailModalVisible(false)}
              className="absolute top-4 right-4 z-10"
            >
              <Ionicons name="close" size={24} color="gray" />
            </TouchableOpacity>

            <View className="items-center mb-6">
              <View className="w-20 h-20 bg-[#333842] rounded-full items-center justify-center border border-[#f49b33] mb-3">
                <Text className="text-[#f49b33] text-3xl font-bold">
                  {selectedStudent?.name?.charAt(0)}
                </Text>
              </View>
              <Text className={`${theme.text} text-2xl font-bold`}>
                {selectedStudent?.name}
              </Text>
              <TouchableOpacity
                onPress={() => handleCall(selectedStudent?.phone)}
                className="flex-row items-center mt-2 bg-[#333842] px-3 py-1 rounded-full"
              >
                <Ionicons name="call" size={14} color="#f49b33" />
                <Text className={`${theme.accent} ml-2 font-bold`}>
                  {selectedStudent?.phone}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              className={`${theme.card} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
            >
              <Text className={`${theme.subText} text-xs uppercase mb-1`}>
                Academic
              </Text>
              <View className="flex-row justify-between mb-2">
                <Text className={theme.text}>Class</Text>
                <Text className={`${theme.accent} font-bold`}>
                  {selectedStudent?.standard}
                </Text>
              </View>
              {selectedStudent?.stream !== "N/A" && (
                <View className="flex-row justify-between mb-2">
                  <Text className={theme.text}>Stream</Text>
                  <Text className={`${theme.text} font-bold`}>
                    {selectedStudent?.stream}
                  </Text>
                </View>
              )}
              <Text
                className={`${theme.text} mt-2 pt-2 border-t border-[#4C5361] text-sm`}
              >
                {selectedStudent?.enrolledSubjects?.join(", ")}
              </Text>
            </View>

            <View
              className={`${theme.bg} p-4 rounded-xl border ${theme.borderColor}`}
            >
              <Text className={`${theme.subText} text-xs uppercase mb-1`}>
                Fee Status
              </Text>
              <Text className="text-green-400 text-2xl font-bold">
                ₹ {selectedStudent?.monthlyFeeAmount}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ManageStudents;
