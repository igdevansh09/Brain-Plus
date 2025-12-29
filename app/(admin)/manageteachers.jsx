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
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions"; // <--- Added Function Import
import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";

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
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Form States
  const [approvalSalary, setApprovalSalary] = useState("");
  const [approvalType, setApprovalType] = useState("Fixed");

  // Edit States
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editType, setEditType] = useState("Fixed");

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

  // --- FETCH TEACHERS ---
  const fetchTeachers = async () => {
    try {
      const snapshot = await firestore()
        .collection("users")
        .where("role", "==", "teacher")
        .get();
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTeachers(list);
    } catch (error) {
      console.log(error);
      showToast("Error fetching teachers", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeachers();
  };

  // --- HANDLE DELETE (SECURE) ---
  const handleDelete = (id) => {
    setAlertConfig({
      visible: true,
      title: "Delete Teacher?",
      message:
        "This will permanently delete the teacher account and access. This cannot be undone.",
      confirmText: "Delete Permanently",
      type: "warning",
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        setLoading(true);
        try {
          // Call Cloud Function to delete from Auth & Firestore
          const deleteUserFn = functions().httpsCallable("deleteTargetUser");
          await deleteUserFn({ targetUid: id });

          showToast("Teacher deleted permanently.", "success");
          setTeachers((prev) => prev.filter((t) => t.id !== id));
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

  // --- APPROVAL LOGIC ---
  const openApproveModal = (teacher) => {
    setSelectedTeacher(teacher);
    setApprovalSalary("");
    setApprovalType("Fixed");
    setApproveModalVisible(true);
  };

  const confirmApproval = async () => {
    if (approvalType === "Fixed" && !approvalSalary) {
      showToast("Please enter salary", "error");
      return;
    }
    setLoading(true);
    try {
      // Approve cloud function call if exists, or simple firestore update
      // Assuming 'approveUser' function or direct update. Keeping it simple as requested logic.
      const approveFn = functions().httpsCallable("approveUser");
      await approveFn({ targetUid: selectedTeacher.id });

      // Update Salary info
      await firestore().collection("users").doc(selectedTeacher.id).update({
        salary: approvalSalary,
        salaryType: approvalType,
        verified: true,
      });

      showToast("Teacher approved successfully", "success");
      setApproveModalVisible(false);
      fetchTeachers();
    } catch (error) {
      showToast("Approval failed: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // --- EDIT LOGIC ---
  const openEditModal = (teacher) => {
    setSelectedTeacher(teacher);
    setEditName(teacher.name);
    setEditPhone(teacher.phone);
    setEditSalary(teacher.salary || "");
    setEditType(teacher.salaryType || "Fixed");
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await firestore().collection("users").doc(selectedTeacher.id).update({
        name: editName,
        phone: editPhone,
        salary: editSalary,
        salaryType: editType,
      });
      showToast("Teacher updated", "success");
      setEditModalVisible(false);
      fetchTeachers();
    } catch (e) {
      showToast("Update failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- DETAIL & CALL ---
  const openDetailModal = (teacher) => {
    setSelectedTeacher(teacher);
    setDetailModalVisible(true);
  };

  const handleCall = (phone) => Linking.openURL(`tel:${phone}`);

  // --- RENDER ---
  const renderTeacher = ({ item }) => (
    <View
      className={`${theme.card} mx-4 mb-3 p-4 rounded-2xl border ${theme.borderColor}`}
    >
      <View className="flex-row items-center mb-3">
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
            <Text className={`${theme.text} font-bold text-lg`}>
              {item.name}
            </Text>
            <Text className={theme.subText}>
              {item.qualification} | {item.experience} Exp
            </Text>
          </View>
        </TouchableOpacity>

        {viewMode === "active" ? (
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
        ) : (
          <TouchableOpacity
            onPress={() => openApproveModal(item)}
            className={`${theme.accentBg} px-4 py-2 rounded-lg`}
          >
            <Text className="text-[#282C34] font-bold">Approve</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-row flex-wrap gap-2">
        {item.teachingProfile?.map((p, i) => (
          <View
            key={i}
            className="bg-[#282C34] px-2 py-1 rounded border border-[#4C5361]"
          >
            <Text className="text-gray-400 text-xs">
              {p.class} • {p.subject}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const filteredData = teachers
    .filter((t) => (viewMode === "active" ? t.verified : !t.verified))
    .filter((t) => t.name?.toLowerCase().includes(searchQuery.toLowerCase()));

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
          Manage Teachers
        </Text>
      </View>

      {/* TABS */}
      <View className="flex-row px-4 mb-4">
        <TouchableOpacity
          onPress={() => setViewMode("active")}
          className={`flex-1 py-3 border-b-2 ${
            viewMode === "active" ? "border-[#f49b33]" : "border-transparent"
          }`}
        >
          <Text
            className={`text-center font-bold ${
              viewMode === "active" ? theme.accent : "text-gray-500"
            }`}
          >
            Active Teachers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode("pending")}
          className={`flex-1 py-3 border-b-2 ${
            viewMode === "pending" ? "border-[#f49b33]" : "border-transparent"
          }`}
        >
          <Text
            className={`text-center font-bold ${
              viewMode === "pending" ? theme.accent : "text-gray-500"
            }`}
          >
            Pending Requests
          </Text>
        </TouchableOpacity>
      </View>

      {/* LIST */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderTeacher}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f49b33"
          />
        }
        ListEmptyComponent={
          <Text className="text-gray-500 text-center mt-10">
            No teachers found.
          </Text>
        }
      />

      {/* --- EDIT MODAL --- */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className={`${theme.bg} rounded-t-3xl p-6`}>
            <Text className={`${theme.text} text-xl font-bold mb-4`}>
              Edit Teacher
            </Text>

            <Text className={`${theme.subText} mb-2`}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              className={`${theme.card} ${theme.text} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
            />
            <Text className={`${theme.subText} mb-2`}>Phone</Text>
            <TextInput
              value={editPhone}
              onChangeText={setEditPhone}
              className={`${theme.card} ${theme.text} p-4 rounded-xl mb-4 border ${theme.borderColor}`}
            />

            <Text className={`${theme.subText} mb-2`}>Salary Type</Text>
            <View className="flex-row gap-2 mb-4">
              {["Fixed", "Commission"].map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setEditType(t)}
                  className={`flex-1 py-3 rounded border ${
                    editType === t
                      ? `${theme.accentBg} border-[#f49b33]`
                      : `${theme.card} ${theme.borderColor}`
                  }`}
                >
                  <Text
                    className={`text-center font-bold ${
                      editType === t ? "text-[#282C34]" : "text-gray-400"
                    }`}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {editType === "Fixed" && (
              <>
                <Text className={`${theme.subText} mb-2`}>Salary Amount</Text>
                <TextInput
                  value={editSalary}
                  onChangeText={setEditSalary}
                  keyboardType="numeric"
                  className={`${theme.card} ${theme.text} p-4 rounded-xl mb-6 border ${theme.borderColor}`}
                />
              </>
            )}

            <View className="flex-row gap-4 mt-4">
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                className={`flex-1 bg-gray-600 p-4 rounded-xl items-center`}
              >
                <Text className="text-white font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdate}
                className={`flex-1 ${theme.accentBg} p-4 rounded-xl items-center`}
              >
                <Text className="text-[#282C34] font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- APPROVE MODAL --- */}
      <Modal visible={approveModalVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/80 justify-center px-6">
          <View className={`${theme.bg} p-6 rounded-2xl`}>
            <Text className={`${theme.text} text-lg font-bold mb-4`}>
              Approve {selectedTeacher?.name}
            </Text>

            <Text className={`${theme.subText} mb-2`}>Select Salary Type</Text>
            <View
              className={`flex-row bg-[#333842] p-1 rounded-lg mb-4 border ${theme.borderColor}`}
            >
              <TouchableOpacity
                onPress={() => setApprovalType("Fixed")}
                className={`flex-1 py-2 rounded ${
                  approvalType === "Fixed" ? "bg-[#f49b33]" : ""
                }`}
              >
                <Text
                  className={`text-center font-bold ${
                    approvalType === "Fixed"
                      ? "text-[#282C34]"
                      : "text-gray-400"
                  }`}
                >
                  Fixed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setApprovalType("Commission")}
                className={`flex-1 py-2 rounded ${
                  approvalType === "Commission" ? "bg-[#f49b33]" : ""
                }`}
              >
                <Text
                  className={`text-center font-bold ${
                    approvalType === "Commission"
                      ? "text-[#282C34]"
                      : "text-gray-400"
                  }`}
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