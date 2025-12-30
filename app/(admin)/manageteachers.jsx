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
  Keyboard,
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

const ManageTeachers = () => {
  const router = useRouter();
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
  const [editProfile, setEditProfile] = useState([]); // Array of {class, subject}

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

  // --- REAL-TIME LISTENER ---
  useEffect(() => {
    setLoading(true);
    const isVerified = viewMode === "active";

    const unsubscribe = firestore()
      .collection("users")
      .where("role", "==", "teacher")
      .where("verified", "==", isVerified)
      .onSnapshot(
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
    setEditProfile(teacher.teachingProfile || []); // The Pair Entry array
    setEditModalVisible(true);
  };

  const handleUpdateTeacher = async () => {
    if (!editName.trim()) return showToast("Name is required", "error");
    if (editSalaryType === "Fixed" && !editSalary)
      return showToast("Salary amount required", "error");

    try {
      await firestore().collection("users").doc(editingId).update({
        name: editName,
        phone: editPhone,
        salary: editSalary,
        salaryType: editSalaryType,
        // We preserve teachingProfile here to match your signup logic
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
      // Calls a Cloud Function to delete from Auth & Firestore
      const deleteUserFn = functions().httpsCallable("deleteTargetUser");
      await deleteUserFn({ targetUid: id });

      showToast("Teacher deleted.", "success");
    } catch (error) {
      console.error("Delete error:", error);
      showToast("Delete failed: " + error.message, "error");
    }
  };

  const confirmApproval = async () => {
    try {
      await firestore()
        .collection("users")
        .doc(selectedTeacher.id)
        .update({
          verified: true,
          salary: approvalType === "Fixed" ? approvalSalary : "0",
          salaryType: approvalType,
        });
      setApproveModalVisible(false);
      showToast("Teacher approved!", "success");
    } catch (e) {
      showToast("Approval failed", "error");
    }
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      (t.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.phone || "").includes(searchQuery)
  );

  // --- RENDER LIST ITEM ---
  const renderTeacher = ({ item }) => (
    <View
      className={`${theme.card} p-4 rounded-xl mb-3 flex-row items-center border ${theme.borderColor} shadow-sm`}
    >
      {/* 1. Avatar */}
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
          setSelectedTeacher(item);
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
            onPress={() => {
              setSelectedTeacher(item);
              setApproveModalVisible(true);
            }}
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
        <Text className={`${theme.text} text-2xl font-bold`}>
          Teachers Staff
        </Text>
      </View>

      {/* --- SEARCH --- */}
      <View className="px-4 mb-4">
        <View
          className={`flex-row items-center ${theme.card} rounded-xl px-4 py-3 border ${theme.borderColor}`}
        >
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search teachers..."
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
            Active Staff
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
          data={filteredTeachers}
          keyExtractor={(item) => item.id}
          renderItem={renderTeacher}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={() => (
            <View className="mt-20 items-center opacity-50">
              <Ionicons name="people-outline" size={64} color="gray" />
              <Text className="text-gray-400 mt-4">No teachers found</Text>
            </View>
          )}
        />
      )}

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
              {selectedTeacher?.profileImage ? (
                <Image
                  source={{ uri: selectedTeacher.profileImage }}
                  className="w-20 h-20 rounded-full border-2 border-[#f49b33] mb-4"
                />
              ) : (
                <View className="w-20 h-20 bg-[#f49b33] rounded-full items-center justify-center mb-4">
                  <Text className="text-[#282C34] text-3xl font-bold">
                    {selectedTeacher?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text className={`${theme.text} text-2xl font-bold`}>
                {selectedTeacher?.name}
              </Text>
              <Text className={theme.subText}>{selectedTeacher?.phone}</Text>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              <View
                className={`${theme.bg} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
              >
                <Text
                  className={`${theme.subText} text-xs uppercase mb-2 font-bold`}
                >
                  Teaching Profile
                </Text>
                {selectedTeacher?.teachingProfile?.map((item, idx) => (
                  <View
                    key={idx}
                    className="flex-row justify-between mb-2 pb-2 border-b border-[#4C5361]/30"
                  >
                    <Text className="text-white font-medium">{item.class}</Text>
                    <Text className={theme.accent + " font-bold"}>
                      {item.subject}
                    </Text>
                  </View>
                ))}
              </View>

              <View
                className={`${theme.bg} p-4 rounded-xl border ${theme.borderColor}`}
              >
                <Text
                  className={`${theme.subText} text-xs uppercase mb-1 font-bold`}
                >
                  Salary Info
                </Text>
                <Text className="text-green-400 text-2xl font-bold">
                  {selectedTeacher?.salaryType === "Commission"
                    ? "Commission Based"
                    : `₹ ${selectedTeacher?.salary}`}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
        <View className="flex-1 bg-black/80 justify-end">
          <View
            className={`${theme.card} rounded-t-3xl p-6 h-[70%] border-t ${theme.borderColor}`}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className={`${theme.text} text-xl font-bold`}>
                Edit Teacher
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="gray" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
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

              <Text
                className={`${theme.accent} mb-1 text-xs uppercase font-bold`}
              >
                Salary Type
              </Text>
              <View className="flex-row mb-4 bg-[#282C34] rounded-lg p-1 border border-[#4C5361]">
                <TouchableOpacity
                  onPress={() => setEditSalaryType("Fixed")}
                  className={`flex-1 py-2 rounded ${editSalaryType === "Fixed" ? "bg-[#f49b33]" : ""}`}
                >
                  <Text
                    className={`text-center font-bold ${editSalaryType === "Fixed" ? "text-[#282C34]" : "text-gray-400"}`}
                  >
                    Fixed
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditSalaryType("Commission")}
                  className={`flex-1 py-2 rounded ${editSalaryType === "Commission" ? "bg-[#f49b33]" : ""}`}
                >
                  <Text
                    className={`text-center font-bold ${editSalaryType === "Commission" ? "text-[#282C34]" : "text-gray-400"}`}
                  >
                    Commission
                  </Text>
                </TouchableOpacity>
              </View>

              {editSalaryType === "Fixed" && (
                <>
                  <Text
                    className={`${theme.accent} mb-1 text-xs uppercase font-bold`}
                  >
                    Salary Amount (₹)
                  </Text>
                  <TextInput
                    value={editSalary}
                    onChangeText={setEditSalary}
                    keyboardType="numeric"
                    className={`${theme.bg} ${theme.text} p-4 rounded-xl mb-8 border ${theme.borderColor}`}
                  />
                </>
              )}

              <TouchableOpacity
                onPress={handleUpdateTeacher}
                className={`${theme.accentBg} p-4 rounded-xl items-center mb-6`}
              >
                <Text className="text-[#282C34] font-bold text-lg">
                  Update Profile
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          </View>
        </KeyboardAvoidingView>
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
              Approve Teacher
            </Text>
            <Text className={theme.subText + " mb-6"}>
              Verify & set salary for {selectedTeacher?.name}.
            </Text>

            <View className="flex-row mb-4 bg-[#282C34] rounded-lg p-1 border border-[#4C5361]">
              <TouchableOpacity
                onPress={() => setApprovalType("Fixed")}
                className={`flex-1 py-2 rounded ${approvalType === "Fixed" ? "bg-[#f49b33]" : ""}`}
              >
                <Text
                  className={`text-center font-bold ${approvalType === "Fixed" ? "text-[#282C34]" : "text-gray-400"}`}
                >
                  Fixed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setApprovalType("Commission")}
                className={`flex-1 py-2 rounded ${approvalType === "Commission" ? "bg-[#f49b33]" : ""}`}
              >
                <Text
                  className={`text-center font-bold ${approvalType === "Commission" ? "text-[#282C34]" : "text-gray-400"}`}
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
                className={`${theme.bg} ${theme.text} p-4 rounded-xl mb-6 font-bold text-lg border ${theme.borderColor}`}
              />
            )}

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
    </SafeAreaView>
  );
};

export default ManageTeachers;
