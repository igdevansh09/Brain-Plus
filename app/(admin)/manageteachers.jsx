import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Linking,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";
import { db, functions } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";
import ScreenWrapper from "../../components/ScreenWrapper";
import { useTheme } from "../../context/ThemeContext";

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
const SUBJECT_OPTIONS = [
  "All Subjects",
  "English",
  "Hindi",
  "Maths",
  "Science",
  "Social Science",
  "Physics",
  "Chemistry",
  "Biology",
  "CS",
  "Accounts",
  "Business Studies",
  "Economics",
  "History",
  "Geography",
  "Political Science",
];

const ManageTeachers = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("active");

  // Modal States
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Approval Data
  const [approvalSalary, setApprovalSalary] = useState("15000");
  const [approvalType, setApprovalType] = useState("Fixed");

  // Edit Form State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editSalaryType, setEditSalaryType] = useState("Fixed");
  const [editProfile, setEditProfile] = useState([]);

  // Profile Management State
  const [activeModalType, setActiveModalType] = useState(null);
  const [pendingEntry, setPendingEntry] = useState({ class: "", subject: "" });

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

  // --- REAL-TIME LISTENER (MODULAR) ---
  useEffect(() => {
    setLoading(true);
    const isVerified = viewMode === "active";

    // Modular: query(collection(db, ...), where(...))
    const q = query(
      collection(db, "users"),
      where("role", "==", "teacher"),
      where("verified", "==", isVerified)
    );

    // Modular: onSnapshot(query, callback)
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTeachers(list);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Error:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [viewMode]);

  // --- ACTIONS ---
  const handleCall = (phoneNumber) => {
    if (phoneNumber) Linking.openURL(`tel:${phoneNumber}`);
    else showToast("No phone number registered.", "error");
  };

  const openEditModal = (teacher) => {
    setEditingId(teacher.id);
    setEditName(teacher.name);
    setEditPhone(teacher.phone || "");
    setEditSalary(teacher.salary || "");
    setEditSalaryType(teacher.salaryType || "Fixed");
    setEditProfile(teacher.teachingProfile || []);
    setPendingEntry({ class: "", subject: "" });
    setEditModalVisible(true);
  };

  const handleUpdateTeacher = async () => {
    if (!editName.trim()) return showToast("Name is required", "error");
    if (editSalaryType === "Fixed" && !editSalary)
      return showToast("Salary amount required", "error");

    try {
      // Modular: updateDoc(doc(db, ...))
      const teacherRef = doc(db, "users", editingId);
      await updateDoc(teacherRef, {
        name: editName,
        phone: editPhone,
        salary: editSalary,
        salaryType: editSalaryType,
        teachingProfile: editProfile,
      });
      showToast("Teacher updated!", "success");
      setEditModalVisible(false);
    } catch (error) {
      showToast("Update failed", "error");
    }
  };

  const handleDelete = (id) => {
    setAlert({
      visible: true,
      title: "Remove Teacher?",
      msg: "This will delete their profile permanently.",
      type: "warning",
      onConfirm: () => performDelete(id),
    });
  };

  const performDelete = async (id) => {
    setAlert({ ...alert, visible: false });
    try {
      // Modular: httpsCallable(functionsInstance, name)
      const deleteUserFn = httpsCallable(functions, "deleteTargetUser");
      await deleteUserFn({ targetUid: id });
      showToast("Teacher deleted.", "success");
    } catch (error) {
      showToast("Delete failed: " + error.message, "error");
    }
  };

  // --- APPROVED FUNCTION (MODULAR) ---
  const confirmApproval = async () => {
    try {
      // 1. Update Salary Info first (Database Only)
      const teacherRef = doc(db, "users", selectedTeacher.id);
      await updateDoc(teacherRef, {
        salary: approvalType === "Fixed" ? approvalSalary : "0",
        salaryType: approvalType,
      });

      // 2. Call Cloud Function to Approve (Modular)
      const approveUser = httpsCallable(functions, "approveUser");
      await approveUser({ targetUid: selectedTeacher.id });

      setApproveModalVisible(false);
      showToast("Teacher approved!", "success");
    } catch (e) {
      console.error(e);
      showToast("Approval failed. Check network.", "error");
    }
  };

  // --- PROFILE EDIT LOGIC ---
  const addToProfile = () => {
    if (!pendingEntry.class || !pendingEntry.subject)
      return showToast("Select Class & Subject", "error");
    const exists = editProfile.some(
      (p) =>
        p.class === pendingEntry.class && p.subject === pendingEntry.subject
    );
    if (exists) return showToast("Already assigned", "error");

    setEditProfile([...editProfile, pendingEntry]);
    setPendingEntry({ class: "", subject: "" }); // Reset
  };

  const removeFromProfile = (index) => {
    const updated = [...editProfile];
    updated.splice(index, 1);
    setEditProfile(updated);
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      (t.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.phone || "").includes(searchQuery)
  );

  const renderTeacher = ({ item }) => (
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
          setSelectedTeacher(item);
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
          setSelectedTeacher(item);
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
            onPress={() => {
              setSelectedTeacher(item);
              setApproveModalVisible(true);
            }}
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
        onCancel={() => setAlert({ ...alert, visible: false })}
        onConfirm={alert.onConfirm}
        confirmText="Confirm"
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
          Teachers Staff
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
            placeholder="Search teachers..."
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
            Active Staff
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
          data={filteredTeachers}
          keyExtractor={(item) => item.id}
          renderItem={renderTeacher}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={() => (
            <View className="mt-20 items-center opacity-50">
              <Ionicons
                name="people-outline"
                size={64}
                color={theme.textMuted}
              />
              <Text style={{ color: theme.textMuted }} className="mt-4">
                No teachers found
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
                  Edit Teacher
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

                {/* Teaching Profile Edit Section */}
                <View
                  style={{ borderColor: theme.border }}
                  className="mb-4 pt-2 border-t"
                >
                  <Text
                    style={{ color: theme.accent }}
                    className="mb-2 text-xs uppercase font-bold"
                  >
                    Teaching Profile
                  </Text>

                  {/* List of assigned classes */}
                  {editProfile.map((p, idx) => (
                    <View
                      key={idx}
                      style={{
                        backgroundColor: theme.bgPrimary,
                        borderColor: theme.border,
                      }}
                      className="flex-row justify-between items-center p-3 rounded-lg mb-2 border"
                    >
                      <Text
                        style={{
                          color: theme.textPrimary,
                          fontWeight: "bold",
                        }}
                      >
                        {p.class} -{" "}
                        <Text style={{ color: theme.textSecondary }}>
                          {p.subject}
                        </Text>
                      </Text>
                      <TouchableOpacity onPress={() => removeFromProfile(idx)}>
                        <Ionicons name="trash" size={18} color={theme.error} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add New Entry Row */}
                  <Text
                    style={{ color: theme.textSecondary }}
                    className="text-xs mb-2 mt-2"
                  >
                    Add New Class/Subject:
                  </Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setActiveModalType("class")}
                      style={{
                        backgroundColor: theme.bgPrimary,
                        borderColor: theme.border,
                      }}
                      className="flex-1 p-3 rounded-xl border"
                    >
                      <Text
                        style={{
                          color: pendingEntry.class
                            ? theme.textPrimary
                            : theme.textMuted,
                        }}
                      >
                        {pendingEntry.class || "Select Class"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveModalType("subject")}
                      style={{
                        backgroundColor: theme.bgPrimary,
                        borderColor: theme.border,
                      }}
                      className="flex-1 p-3 rounded-xl border"
                    >
                      <Text
                        style={{
                          color: pendingEntry.subject
                            ? theme.textPrimary
                            : theme.textMuted,
                        }}
                      >
                        {pendingEntry.subject || "Select Sub"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={addToProfile}
                      style={{ backgroundColor: theme.accent }}
                      className="p-3 rounded-xl justify-center items-center"
                    >
                      <Ionicons name="add" size={24} color={theme.textDark} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text
                  style={{ color: theme.accent }}
                  className="mb-1 text-xs uppercase font-bold"
                >
                  Salary Type
                </Text>
                <View
                  style={{
                    backgroundColor: theme.bgPrimary,
                    borderColor: theme.border,
                  }}
                  className="flex-row mb-4 rounded-lg p-1 border"
                >
                  <TouchableOpacity
                    onPress={() => setEditSalaryType("Fixed")}
                    style={{
                      backgroundColor:
                        editSalaryType === "Fixed"
                          ? theme.accent
                          : "transparent",
                    }}
                    className="flex-1 py-2 rounded"
                  >
                    <Text
                      style={{
                        color:
                          editSalaryType === "Fixed"
                            ? theme.textDark
                            : theme.textSecondary,
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Fixed
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEditSalaryType("Commission")}
                    style={{
                      backgroundColor:
                        editSalaryType === "Commission"
                          ? theme.accent
                          : "transparent",
                    }}
                    className="flex-1 py-2 rounded"
                  >
                    <Text
                      style={{
                        color:
                          editSalaryType === "Commission"
                            ? theme.textDark
                            : theme.textSecondary,
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      Commission
                    </Text>
                  </TouchableOpacity>
                </View>
                {editSalaryType === "Fixed" && (
                  <>
                    <Text
                      style={{ color: theme.accent }}
                      className="mb-1 text-xs uppercase font-bold"
                    >
                      Salary Amount (₹)
                    </Text>
                    <TextInput
                      value={editSalary}
                      onChangeText={setEditSalary}
                      keyboardType="numeric"
                      style={{
                        backgroundColor: theme.bgPrimary,
                        color: theme.textPrimary,
                        borderColor: theme.border,
                      }}
                      className="p-4 rounded-xl mb-8 border"
                    />
                  </>
                )}
                <TouchableOpacity
                  onPress={handleUpdateTeacher}
                  style={{ backgroundColor: theme.accent }}
                  className="p-4 rounded-xl items-center mb-6"
                >
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
                    Update Profile
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
              Select {activeModalType === "class" ? "Class" : "Subject"}
            </Text>
            <FlatList
              data={
                activeModalType === "class" ? CLASS_OPTIONS : SUBJECT_OPTIONS
              }
              keyExtractor={(i) => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setPendingEntry((prev) => ({
                      ...prev,
                      [activeModalType]: item,
                    }));
                    setActiveModalType(null);
                  }}
                  style={{ borderColor: theme.border }}
                  className="p-4 border-b flex-row justify-between"
                >
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="font-medium"
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setActiveModalType(null)}
              style={{ backgroundColor: theme.bgPrimary }}
              className="p-4 items-center"
            >
              <Text style={{ color: theme.accent }} className="font-bold">
                Cancel
              </Text>
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
              Approve Teacher
            </Text>
            <Text style={{ color: theme.textSecondary }} className="mb-6">
              Verify & set salary for {selectedTeacher?.name}.
            </Text>
            <View
              style={{
                backgroundColor: theme.bgPrimary,
                borderColor: theme.border,
              }}
              className="flex-row mb-4 rounded-lg p-1 border"
            >
              <TouchableOpacity
                onPress={() => setApprovalType("Fixed")}
                style={{
                  backgroundColor:
                    approvalType === "Fixed" ? theme.accent : "transparent",
                }}
                className="flex-1 py-2 rounded"
              >
                <Text
                  style={{
                    color:
                      approvalType === "Fixed"
                        ? theme.textDark
                        : theme.textSecondary,
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  Fixed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setApprovalType("Commission")}
                style={{
                  backgroundColor:
                    approvalType === "Commission"
                      ? theme.accent
                      : "transparent",
                }}
                className="flex-1 py-2 rounded"
              >
                <Text
                  style={{
                    color:
                      approvalType === "Commission"
                        ? theme.textDark
                        : theme.textSecondary,
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  Comm.
                </Text>
              </TouchableOpacity>
            </View>
            {approvalType === "Fixed" && (
              <TextInput
                value={approvalSalary}
                onChangeText={setApprovalSalary}
                keyboardType="numeric"
                style={{
                  backgroundColor: theme.bgPrimary,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl mb-6 font-bold text-lg border"
              />
            )}
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

      {/* --- DETAIL MODAL --- */}
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
              {selectedTeacher?.profileImage ? (
                <Image
                  source={{ uri: selectedTeacher.profileImage }}
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
                    {selectedTeacher?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                style={{ color: theme.textPrimary }}
                className="text-2xl font-bold"
              >
                {selectedTeacher?.name}
              </Text>
              <Text style={{ color: theme.textSecondary }}>
                {selectedTeacher?.phone}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              <View
                style={{
                  backgroundColor: theme.bgPrimary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl mb-4 border"
              >
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs uppercase mb-2 font-bold"
                >
                  Teaching Profile
                </Text>
                {selectedTeacher?.teachingProfile?.map((item, idx) => (
                  <View
                    key={idx}
                    style={{ borderColor: theme.borderSoft }}
                    className="flex-row justify-between mb-2 pb-2 border-b"
                  >
                    <Text
                      style={{ color: theme.textPrimary }}
                      className="font-medium"
                    >
                      {item.class}
                    </Text>
                    <Text style={{ color: theme.accent }} className="font-bold">
                      {item.subject}
                    </Text>
                  </View>
                ))}
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
                  className="text-xs uppercase mb-1 font-bold"
                >
                  Salary Info
                </Text>
                <Text
                  style={{ color: theme.successBright }}
                  className="text-2xl font-bold"
                >
                  {selectedTeacher?.salaryType === "Commission"
                    ? "Commission Based"
                    : `₹ ${selectedTeacher?.salary}`}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

export default ManageTeachers;
