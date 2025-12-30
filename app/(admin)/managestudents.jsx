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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";
import functions from "@react-native-firebase/functions";

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
  "Geography",
  "Political Science",
  "Economics",
  "English",
  "Hindi",
];

// --- THEME ---
const theme = {
  bg: "bg-[#282C34]",
  card: "bg-[#333842]",
  accent: "text-[#f49b33]",
  accentBg: "bg-[#f49b33]",
  text: "text-white",
  subText: "text-gray-400",
  borderColor: "border-[#4C5361]",
};

const ManageStudents = () => {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("active");

  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [approvalFee, setApprovalFee] = useState("5000");
  const [editingId, setEditingId] = useState(null);

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editStream, setEditStream] = useState("");
  const [editSubjects, setEditSubjects] = useState([]);
  const [editFee, setEditFee] = useState("");

  const [activeModalType, setActiveModalType] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const [alert, setAlert] = useState({
    visible: false,
    title: "",
    msg: "",
    type: "default",
    onConfirm: null,
  });

  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // --- 1. REAL-TIME LISTENER ---
  useEffect(() => {
    setLoading(true);
    const isVerified = viewMode === "active";

    const unsubscribe = firestore()
      .collection("users")
      .where("role", "==", "student")
      .where("verified", "==", isVerified)
      .onSnapshot(
        (snapshot) => {
          const list = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setStudents(list);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore Error:", error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [viewMode]);

  // --- 2. EDIT LOGIC ---
  useEffect(() => {
    if (!editModalVisible) return;

    if (editClass === "CS") {
      setEditStream("N/A");
      setEditSubjects(["N/A"]);
      setAvailableSubjects([]);
    } else if (["Prep", "1st", "2nd", "3rd"].includes(editClass)) {
      setEditStream("N/A");
      setEditSubjects(["All Subjects"]);
      setAvailableSubjects([]);
    } else if (
      ["4th", "5th", "6th", "7th", "8th", "9th", "10th"].includes(editClass)
    ) {
      setEditStream("N/A");
      setAvailableSubjects(SUB_GENERAL);
    } else if (["11th", "12th"].includes(editClass)) {
      if (editStream === "Science") setAvailableSubjects(SUB_SCIENCE);
      else if (editStream === "Commerce") setAvailableSubjects(SUB_COMMERCE);
      else if (editStream === "Arts") setAvailableSubjects(SUB_ARTS);
      else setAvailableSubjects([]);
    }
  }, [editClass, editStream, editModalVisible]);

  const toggleSubject = (subject) => {
    setEditSubjects((prev) => {
      if (prev.includes(subject)) return prev.filter((s) => s !== subject);
      return [...prev, subject];
    });
  };

  // --- ACTIONS ---
  const handleCall = (phoneNumber) => {
    if (phoneNumber) Linking.openURL(`tel:${phoneNumber}`);
    else showToast("No phone number registered.", "error");
  };

  const openEditModal = (student) => {
    setEditingId(student.id);
    setEditName(student.name);
    setEditPhone(student.phone || "");
    setEditClass(student.standard || student.studentClass || "");
    setEditStream(student.stream || "N/A");
    setEditSubjects(student.enrolledSubjects || []);
    setEditFee(student.monthlyFeeAmount || "");
    setEditModalVisible(true);
  };

  const handleUpdateStudent = async () => {
    if (!editName.trim() || !editClass || !editFee.trim())
      return showToast("Name, Class, Fee required", "error");
    if (
      ["11th", "12th"].includes(editClass) &&
      (!editStream || editStream === "N/A")
    ) {
      return showToast("Select a Stream", "error");
    }

    try {
      await firestore().collection("users").doc(editingId).update({
        name: editName,
        phone: editPhone,
        standard: editClass,
        stream: editStream,
        enrolledSubjects: editSubjects,
        monthlyFeeAmount: editFee,
      });
      showToast("Student updated!", "success");
      setEditModalVisible(false);
    } catch (error) {
      showToast("Update failed", "error");
    }
  };

  const handleDelete = (id) => {
    setAlert({
      visible: true,
      title: "Delete Student?",
      msg: "This action cannot be undone.",
      type: "warning",
      onConfirm: () => performDelete(id),
    });
  };

  const performDelete = async (id) => {
    setAlert({ ...alert, visible: false });
    try {
      // Calls a Cloud Function to delete from Auth & Firestore
      const deleteUserFn = functions().httpsCallable("deleteTargetUser");
      await deleteUserFn({ targetUid: id });

      showToast("Student deleted.", "success");
    } catch (error) {
      console.error("Delete error:", error);
      showToast("Delete failed: " + error.message, "error");
    }
  };

  const initiateApproval = (student) => {
    setSelectedStudent(student);
    setApproveModalVisible(true);
  };

  const confirmApproval = async () => {
    try {
      await firestore().collection("users").doc(selectedStudent.id).update({
        verified: true,
        monthlyFeeAmount: approvalFee,
      });
      setApproveModalVisible(false);
      showToast("Student approved!", "success");
    } catch (e) {
      showToast("Approval failed", "error");
    }
  };

  const filteredStudents = students.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      (s.name || "").toLowerCase().includes(query) ||
      (s.phone || "").includes(query)
    );
  });

  // --- RENDER LIST ITEM ---
  const renderStudent = ({ item }) => (
    <View
      className={`${theme.card} p-4 rounded-xl mb-3 flex-row items-center border ${theme.borderColor} shadow-sm`}
    >
      {/* 1. Avatar */}
      <TouchableOpacity
        onPress={() => {
          setSelectedStudent(item);
          setDetailModalVisible(true);
        }}
        className="mr-4"
      >
        {item.profileImage ? (
          <Image
            source={{ uri: item.profileImage }}
            className="w-12 h-12 rounded-full border border-[#f49b33]"
          />
        ) : (
          <View className="w-12 h-12 rounded-full bg-[#f49b33]/20 items-center justify-center border border-[#f49b33]/50">
            <Text className="text-[#f49b33] font-bold text-lg">
              {item.name ? item.name.charAt(0).toUpperCase() : "?"}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 2. Info */}
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => {
          setSelectedStudent(item);
          setDetailModalVisible(true);
        }}
      >
        <Text className={`${theme.text} font-bold text-lg`} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>

      {/* 3. Actions */}
      <View className="flex-row gap-2 ml-2">
        <TouchableOpacity
          onPress={() => handleCall(item.phone)}
          className="bg-blue-500/10 p-2 rounded-lg"
        >
          <Ionicons name="call" size={18} color="#3b82f6" />
        </TouchableOpacity>

        {viewMode === "pending" ? (
          <TouchableOpacity
            onPress={() => initiateApproval(item)}
            className="bg-green-500/10 p-2 rounded-lg"
          >
            <Ionicons name="checkmark" size={18} color="#22c55e" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            className="bg-yellow-500/10 p-2 rounded-lg"
          >
            <Ionicons name="pencil" size={18} color="#eab308" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          className="bg-red-500/10 p-2 rounded-lg"
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView className={`flex-1 ${theme.bg} pt-2`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      {/* --- ALERTS & TOASTS --- */}
      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.msg}
        type={alert.type}
        confirmText="Confirm"
        onCancel={() => setAlert({ ...alert, visible: false })}
        onConfirm={alert.onConfirm}
      />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* --- HEADER --- */}
      <View className="px-4 py-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className={`mr-4 ${theme.card} p-2 rounded-full`}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className={`${theme.text} text-2xl font-bold`}>Students</Text>
      </View>

      {/* --- SEARCH --- */}
      <View className="px-4 mb-4">
        <View
          className={`flex-row items-center ${theme.card} rounded-xl px-4 py-3 border ${theme.borderColor}`}
        >
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search students..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className={`flex-1 ml-3 ${theme.text} font-medium`}
          />
        </View>
      </View>

      {/* --- TABS --- */}
      <View className="flex-row px-4 mb-4">
        <TouchableOpacity
          onPress={() => setViewMode("active")}
          className={`flex-1 py-3 items-center border-b-2 ${viewMode === "active" ? "border-[#f49b33]" : "border-[#333842]"}`}
        >
          <Text
            className={`${viewMode === "active" ? theme.accent + " font-bold" : theme.subText + " font-medium"}`}
          >
            Active Students
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode("pending")}
          className={`flex-1 py-3 items-center border-b-2 ${viewMode === "pending" ? "border-[#f49b33]" : "border-[#333842]"}`}
        >
          <Text
            className={`${viewMode === "pending" ? theme.accent + " font-bold" : theme.subText + " font-medium"}`}
          >
            Requests
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudent}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={() => (
            <View className="mt-20 items-center opacity-50">
              <Ionicons name="school-outline" size={64} color="gray" />
              <Text className="text-gray-400 mt-4">No students found</Text>
            </View>
          )}
        />
      )}

      {/* --- EDIT MODAL --- */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View
            className={`${theme.card} rounded-t-3xl p-6 h-[85%] border-t ${theme.borderColor}`}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`${theme.text} text-xl font-bold`}>
                Edit Student
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Basic Info */}
              <Text
                className={`${theme.accent} mb-1 text-xs uppercase font-bold`}
              >
                Full Name
              </Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                className={`${theme.bg} ${theme.text} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
              />

              <Text
                className={`${theme.accent} mb-1 text-xs uppercase font-bold`}
              >
                Phone
              </Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                className={`${theme.bg} ${theme.text} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
              />

              {/* Class & Stream */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text
                    className={`${theme.accent} mb-1 text-xs uppercase font-bold`}
                  >
                    Class
                  </Text>
                  <TouchableOpacity
                    onPress={() => setActiveModalType("class")}
                    className={`${theme.bg} p-4 rounded-xl border ${theme.borderColor}`}
                  >
                    <Text className={theme.text}>{editClass || "Select"}</Text>
                  </TouchableOpacity>
                </View>
                {["11th", "12th"].includes(editClass) && (
                  <View className="flex-1">
                    <Text
                      className={`${theme.accent} mb-1 text-xs uppercase font-bold`}
                    >
                      Stream
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveModalType("stream")}
                      className={`${theme.bg} p-4 rounded-xl border ${theme.borderColor}`}
                    >
                      <Text className={theme.text}>
                        {editStream || "Select"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Subjects (Conditional) */}
              {availableSubjects.length > 0 && (
                <View className="mb-4">
                  <Text
                    className={`${theme.accent} mb-2 text-xs uppercase font-bold`}
                  >
                    Subjects
                  </Text>
                  <TouchableOpacity
                    onPress={() => setActiveModalType("subject")}
                    className={`${theme.bg} p-4 rounded-xl border ${theme.borderColor}`}
                  >
                    <Text className={theme.text} numberOfLines={1}>
                      {editSubjects.length
                        ? editSubjects.join(", ")
                        : "Select Subjects"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Fee */}
              <Text
                className={`${theme.accent} mb-1 text-xs uppercase font-bold`}
              >
                Monthly Fee (₹)
              </Text>
              <TextInput
                value={editFee}
                onChangeText={setEditFee}
                keyboardType="numeric"
                className={`${theme.bg} ${theme.text} p-4 rounded-xl mb-8 font-bold text-lg border ${theme.borderColor}`}
              />

              <TouchableOpacity
                onPress={handleUpdateStudent}
                className={`${theme.accentBg} p-4 rounded-xl items-center mb-6`}
              >
                <Text className="text-[#282C34] font-bold text-lg">
                  Save Changes
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- SELECTION MODAL --- */}
      <Modal
        visible={!!activeModalType}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModalType(null)}
      >
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View
            className={`${theme.card} rounded-2xl max-h-[60%] overflow-hidden border ${theme.borderColor}`}
          >
            <Text
              className={`${theme.text} text-center font-bold text-lg p-4 bg-[#282C34]`}
            >
              Select {activeModalType}
            </Text>
            <FlatList
              data={
                activeModalType === "class"
                  ? CLASS_OPTIONS
                  : activeModalType === "stream"
                    ? STREAM_OPTIONS
                    : availableSubjects
              }
              keyExtractor={(i) => i}
              renderItem={({ item }) => {
                const isSelected =
                  activeModalType === "subject"
                    ? editSubjects.includes(item)
                    : false;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (activeModalType === "class") {
                        setEditClass(item);
                        setActiveModalType(null);
                      } else if (activeModalType === "stream") {
                        setEditStream(item);
                        setActiveModalType(null);
                      } else toggleSubject(item);
                    }}
                    className={`p-4 border-b ${theme.borderColor} flex-row justify-between ${isSelected ? "bg-[#f49b33]/20" : ""}`}
                  >
                    <Text
                      className={`${theme.text} font-medium ${isSelected ? theme.accent : ""}`}
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#f49b33" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              onPress={() => setActiveModalType(null)}
              className="p-4 items-center bg-[#282C34]"
            >
              <Text className={`${theme.accent} font-bold`}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- APPROVE MODAL --- */}
      <Modal
        visible={approveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApproveModalVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View
            className={`${theme.card} rounded-2xl p-6 border ${theme.borderColor}`}
          >
            <Text className={`${theme.text} text-xl font-bold mb-2`}>
              Approve Student
            </Text>
            <Text className={theme.subText + " mb-6"}>
              Confirm verifying {selectedStudent?.name}.
            </Text>

            <Text
              className={`${theme.accent} mb-1 text-xs uppercase font-bold`}
            >
              Monthly Fee (₹)
            </Text>
            <TextInput
              value={approvalFee}
              onChangeText={setApprovalFee}
              keyboardType="numeric"
              className={`${theme.bg} ${theme.text} p-4 rounded-xl mb-6 font-bold text-lg border ${theme.borderColor}`}
            />

            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => setApproveModalVisible(false)}
                className={`flex-1 ${theme.bg} p-4 rounded-xl items-center`}
              >
                <Text className="text-white font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmApproval}
                className={`flex-1 ${theme.accentBg} p-4 rounded-xl items-center`}
              >
                <Text className="text-[#282C34] font-bold">Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- DETAIL MODAL --- */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View
            className={`${theme.card} rounded-2xl p-6 relative border ${theme.borderColor}`}
          >
            <TouchableOpacity
              onPress={() => setDetailModalVisible(false)}
              className="absolute top-4 right-4 z-10"
            >
              <Ionicons name="close" size={24} color="gray" />
            </TouchableOpacity>

            <View className="items-center mb-6">
              {/* AVATAR IN DETAIL VIEW */}
              {selectedStudent?.profileImage ? (
                <Image
                  source={{ uri: selectedStudent.profileImage }}
                  className="w-20 h-20 rounded-full border-2 border-[#f49b33] mb-4"
                />
              ) : (
                <View className="w-20 h-20 bg-[#f49b33] rounded-full items-center justify-center mb-4">
                  <Text className="text-[#282C34] text-3xl font-bold">
                    {selectedStudent?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <Text className={`${theme.text} text-2xl font-bold`}>
                {selectedStudent?.name}
              </Text>
              <Text className={theme.subText}>{selectedStudent?.phone}</Text>
            </View>

            <View
              className={`${theme.bg} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
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
