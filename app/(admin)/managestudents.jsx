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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";
import functions from "@react-native-firebase/functions";
import ScreenWrapper from "../../components/ScreenWrapper";
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

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

const ManageStudents = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get dynamic theme values

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

  // --- HELPER: Determine Subjects ---
  const getSubjectsList = (cls, stream) => {
    if (cls === "CS") return [];
    if (["Prep", "1st", "2nd", "3rd"].includes(cls)) return [];
    if (["4th", "5th", "6th", "7th", "8th", "9th", "10th"].includes(cls))
      return SUB_GENERAL;
    if (["11th", "12th"].includes(cls)) {
      if (stream === "Science") return SUB_SCIENCE;
      if (stream === "Commerce") return SUB_COMMERCE;
      if (stream === "Arts") return SUB_ARTS;
    }
    return [];
  };

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

    // Set Fields & Calculate Initial Available Subjects
    const cls = student.standard || student.studentClass || "";
    const strm = student.stream || "N/A";

    setEditClass(cls);
    setEditStream(strm);
    setEditSubjects(student.enrolledSubjects || []);
    setEditFee(student.monthlyFeeAmount || "");

    setAvailableSubjects(getSubjectsList(cls, strm));

    setEditModalVisible(true);
  };

  const handleSelection = (type, value) => {
    if (type === "class") {
      setEditClass(value);

      // Reset logic based on new class
      if (value === "CS") {
        setEditStream("N/A");
        setEditSubjects(["N/A"]);
        setAvailableSubjects([]);
      } else if (["Prep", "1st", "2nd", "3rd"].includes(value)) {
        setEditStream("N/A");
        setEditSubjects(["All Subjects"]);
        setAvailableSubjects([]);
      } else if (
        ["4th", "5th", "6th", "7th", "8th", "9th", "10th"].includes(value)
      ) {
        setEditStream("N/A");
        setEditSubjects([]);
        setAvailableSubjects(SUB_GENERAL);
      } else if (["11th", "12th"].includes(value)) {
        setEditStream("N/A"); // Force user to re-select stream
        setEditSubjects([]);
        setAvailableSubjects([]);
      }
      setActiveModalType(null);
    } else if (type === "stream") {
      setEditStream(value);
      setEditSubjects([]);
      setAvailableSubjects(getSubjectsList(editClass, value));
      setActiveModalType(null);
    }
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

  const renderStudent = ({ item }) => (
    <View
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }}
      className="p-4 rounded-xl mb-3 flex-row items-center border shadow-sm"
    >
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
            style={{ borderColor: theme.accent }}
            className="w-12 h-12 rounded-full border"
          />
        ) : (
          <View
            style={{
              backgroundColor: theme.accentSoft20,
              borderColor: theme.accentSoft50,
            }}
            className="w-12 h-12 rounded-full items-center justify-center border"
          >
            <Text style={{ color: theme.accent }} className="font-bold text-lg">
              {item.name ? item.name.charAt(0).toUpperCase() : "?"}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => {
          setSelectedStudent(item);
          setDetailModalVisible(true);
        }}
      >
        <Text
          style={{ color: theme.textPrimary }}
          className="font-bold text-lg"
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
      <View className="flex-row gap-2 ml-2">
        <TouchableOpacity
          onPress={() => handleCall(item.phone)}
          style={{ backgroundColor: theme.infoSoft }}
          className="p-2 rounded-lg"
        >
          <Ionicons name="call" size={18} color={theme.infoBright} />
        </TouchableOpacity>
        {viewMode === "pending" ? (
          <TouchableOpacity
            onPress={() => initiateApproval(item)}
            style={{ backgroundColor: theme.successSoft }}
            className="p-2 rounded-lg"
          >
            <Ionicons name="checkmark" size={18} color={theme.successBright} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            style={{ backgroundColor: theme.warningSoft }}
            className="p-2 rounded-lg"
          >
            <Ionicons name="pencil" size={18} color={theme.warningAlt} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={{ backgroundColor: theme.errorSoft }}
          className="p-2 rounded-lg"
        >
          <Ionicons name="trash-outline" size={18} color={theme.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenWrapper scrollable={false}>
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

      <View className="px-4 py-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: theme.bgSecondary }}
          className="mr-4 p-2 rounded-full"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-2xl font-bold"
        >
          Students
        </Text>
      </View>

      <View className="px-4 mb-4">
        <View
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="flex-row items-center rounded-xl px-4 py-3 border"
        >
          <Ionicons name="search" size={20} color={theme.textMuted} />
          <TextInput
            placeholder="Search students..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: theme.textPrimary }}
            className="flex-1 ml-3 font-medium"
          />
        </View>
      </View>

      <View className="flex-row px-4 mb-4">
        <TouchableOpacity
          onPress={() => setViewMode("active")}
          style={{
            borderColor: viewMode === "active" ? theme.accent : theme.border,
            borderBottomWidth: 2,
          }}
          className="flex-1 py-3 items-center"
        >
          <Text
            style={{
              color: viewMode === "active" ? theme.accent : theme.textSecondary,
              fontWeight: viewMode === "active" ? "bold" : "500",
            }}
          >
            Active Students
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode("pending")}
          style={{
            borderColor: viewMode === "pending" ? theme.accent : theme.border,
            borderBottomWidth: 2,
          }}
          className="flex-1 py-3 items-center"
        >
          <Text
            style={{
              color:
                viewMode === "pending" ? theme.accent : theme.textSecondary,
              fontWeight: viewMode === "pending" ? "bold" : "500",
            }}
          >
            Requests
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.accent}
          className="mt-10"
        />
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudent}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={() => (
            <View className="mt-20 items-center opacity-50">
              <Ionicons
                name="school-outline"
                size={64}
                color={theme.textMuted}
              />
              <Text style={{ color: theme.textMuted }} className="mt-4">
                No students found
              </Text>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{ backgroundColor: theme.blackSoft80 }}
            className="flex-1 justify-end"
          >
            <View
              style={{
                backgroundColor: theme.bgSecondary,
                borderColor: theme.border,
              }}
              className="rounded-t-3xl p-6 h-[85%] border-t"
            >
              <View className="flex-row justify-between items-center mb-6">
                <Text
                  style={{ color: theme.textPrimary }}
                  className="text-xl font-bold"
                >
                  Edit Student
                </Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text
                  style={{ color: theme.accent }}
                  className="mb-1 text-xs uppercase font-bold"
                >
                  Full Name
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={{
                    backgroundColor: theme.bgPrimary,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  }}
                  className="p-4 rounded-xl mb-4 border"
                />
                <Text
                  style={{ color: theme.accent }}
                  className="mb-1 text-xs uppercase font-bold"
                >
                  Phone
                </Text>
                <TextInput
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                  style={{
                    backgroundColor: theme.bgPrimary,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  }}
                  className="p-4 rounded-xl mb-4 border"
                />

                <View className="flex-row gap-4 mb-4">
                  <View className="flex-1">
                    <Text
                      style={{ color: theme.accent }}
                      className="mb-1 text-xs uppercase font-bold"
                    >
                      Class
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveModalType("class")}
                      style={{
                        backgroundColor: theme.bgPrimary,
                        borderColor: theme.border,
                      }}
                      className="p-4 rounded-xl border"
                    >
                      <Text style={{ color: theme.textPrimary }}>
                        {editClass || "Select"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {["11th", "12th"].includes(editClass) && (
                    <View className="flex-1">
                      <Text
                        style={{ color: theme.accent }}
                        className="mb-1 text-xs uppercase font-bold"
                      >
                        Stream
                      </Text>
                      <TouchableOpacity
                        onPress={() => setActiveModalType("stream")}
                        style={{
                          backgroundColor: theme.bgPrimary,
                          borderColor: theme.border,
                        }}
                        className="p-4 rounded-xl border"
                      >
                        <Text style={{ color: theme.textPrimary }}>
                          {editStream || "Select"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {availableSubjects.length > 0 && (
                  <View className="mb-4">
                    <Text
                      style={{ color: theme.accent }}
                      className="mb-2 text-xs uppercase font-bold"
                    >
                      Subjects
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveModalType("subject")}
                      style={{
                        backgroundColor: theme.bgPrimary,
                        borderColor: theme.border,
                      }}
                      className="p-4 rounded-xl border"
                    >
                      <Text
                        style={{ color: theme.textPrimary }}
                        numberOfLines={1}
                      >
                        {editSubjects.length
                          ? editSubjects.join(", ")
                          : "Select Subjects"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text
                  style={{ color: theme.accent }}
                  className="mb-1 text-xs uppercase font-bold"
                >
                  Monthly Fee (₹)
                </Text>
                <TextInput
                  value={editFee}
                  onChangeText={setEditFee}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: theme.bgPrimary,
                    color: theme.textPrimary,
                    borderColor: theme.border,
                  }}
                  className="p-4 rounded-xl mb-8 font-bold text-lg border"
                />
                <TouchableOpacity
                  onPress={handleUpdateStudent}
                  style={{ backgroundColor: theme.accent }}
                  className="p-4 rounded-xl items-center mb-6"
                >
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
                    Save Changes
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- SELECTION MODAL --- */}
      <Modal
        visible={!!activeModalType}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModalType(null)}
      >
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center p-6"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="rounded-2xl max-h-[60%] overflow-hidden border"
          >
            <Text
              style={{
                color: theme.textPrimary,
                backgroundColor: theme.bgPrimary,
              }}
              className="text-center font-bold text-lg p-4"
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
                      if (activeModalType === "class")
                        handleSelection("class", item);
                      else if (activeModalType === "stream")
                        handleSelection("stream", item);
                      else toggleSubject(item);
                    }}
                    style={{
                      borderColor: theme.border,
                      backgroundColor: isSelected
                        ? theme.accentSoft20
                        : "transparent",
                    }}
                    className="p-4 border-b flex-row justify-between"
                  >
                    <Text
                      style={{
                        color: isSelected ? theme.accent : theme.textPrimary,
                      }}
                      className="font-medium"
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={theme.accent}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              onPress={() => setActiveModalType(null)}
              style={{ backgroundColor: theme.bgPrimary }}
              className="p-4 items-center"
            >
              <Text style={{ color: theme.accent }} className="font-bold">
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- APPROVE & DETAIL MODALS --- */}
      <Modal
        visible={approveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApproveModalVisible(false)}
      >
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center p-6"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="rounded-2xl p-6 border"
          >
            <Text
              style={{ color: theme.textPrimary }}
              className="text-xl font-bold mb-2"
            >
              Approve Student
            </Text>
            <Text style={{ color: theme.textSecondary }} className="mb-6">
              Confirm verifying {selectedStudent?.name}.
            </Text>
            <Text
              style={{ color: theme.accent }}
              className="mb-1 text-xs uppercase font-bold"
            >
              Monthly Fee (₹)
            </Text>
            <TextInput
              value={approvalFee}
              onChangeText={setApprovalFee}
              keyboardType="numeric"
              style={{
                backgroundColor: theme.bgPrimary,
                color: theme.textPrimary,
                borderColor: theme.border,
              }}
              className="p-4 rounded-xl mb-6 font-bold text-lg border"
            />
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={() => setApproveModalVisible(false)}
                style={{ backgroundColor: theme.bgPrimary }}
                className="flex-1 p-4 rounded-xl items-center"
              >
                <Text
                  style={{ color: theme.textPrimary }}
                  className="font-bold"
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmApproval}
                style={{ backgroundColor: theme.accent }}
                className="flex-1 p-4 rounded-xl items-center"
              >
                <Text style={{ color: theme.textDark }} className="font-bold">
                  Approve
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center p-6"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="rounded-2xl p-6 relative border"
          >
            <TouchableOpacity
              onPress={() => setDetailModalVisible(false)}
              className="absolute top-4 right-4 z-10"
            >
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
            <View className="items-center mb-6">
              {selectedStudent?.profileImage ? (
                <Image
                  source={{ uri: selectedStudent.profileImage }}
                  style={{ borderColor: theme.accent }}
                  className="w-20 h-20 rounded-full border-2 mb-4"
                />
              ) : (
                <View
                  style={{ backgroundColor: theme.accent }}
                  className="w-20 h-20 rounded-full items-center justify-center mb-4"
                >
                  <Text
                    style={{ color: theme.textDark }}
                    className="text-3xl font-bold"
                  >
                    {selectedStudent?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                style={{ color: theme.textPrimary }}
                className="text-2xl font-bold"
              >
                {selectedStudent?.name}
              </Text>
              <Text style={{ color: theme.textSecondary }}>
                {selectedStudent?.phone}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: theme.bgPrimary,
                borderColor: theme.border,
              }}
              className="p-4 rounded-xl mb-4 border"
            >
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs uppercase mb-1"
              >
                Academic
              </Text>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: theme.textPrimary }}>Class</Text>
                <Text style={{ color: theme.accent }} className="font-bold">
                  {selectedStudent?.standard}
                </Text>
              </View>
              {selectedStudent?.stream !== "N/A" && (
                <View className="flex-row justify-between mb-2">
                  <Text style={{ color: theme.textPrimary }}>Stream</Text>
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="font-bold"
                  >
                    {selectedStudent?.stream}
                  </Text>
                </View>
              )}
              <Text
                style={{
                  color: theme.textPrimary,
                  borderColor: theme.border,
                }}
                className="mt-2 pt-2 border-t text-sm"
              >
                {selectedStudent?.enrolledSubjects?.join(", ")}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: theme.bgPrimary,
                borderColor: theme.border,
              }}
              className="p-4 rounded-xl border"
            >
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs uppercase mb-1"
              >
                Fee Status
              </Text>
              <Text
                style={{ color: theme.successBright }}
                className="text-2xl font-bold"
              >
                ₹ {selectedStudent?.monthlyFeeAmount}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

export default ManageStudents;
