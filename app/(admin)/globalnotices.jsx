import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// NATIVE SDK
import firestore from "@react-native-firebase/firestore";

import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";

const theme = {
  bg: "bg-[#282C34]",
  card: "bg-[#333842]",
  accent: "text-[#f49b33]",
  accentBg: "bg-[#f49b33]",
  text: "text-white",
  subText: "text-gray-400",
  borderColor: "border-[#4C5361]",
};

const ManageNotices = () => {
  const router = useRouter();
  const [notices, setNotices] = useState([]);

  // Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // Alerts & Toasts
  const [alert, setAlert] = useState({
    visible: false,
    title: "",
    msg: "",
    onConfirm: null,
  });
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });

  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // --- FETCH NOTICES ---
  useEffect(() => {
    setLoading(true);
    const unsubscribe = firestore()
      .collection("notices")
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) return;
          const noticesList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setNotices(noticesList);
          setLoading(false);
        },
        (error) => {
          console.error(error);
          setLoading(false);
        }
      );
    return () => unsubscribe();
  }, []);

  // --- HANDLERS ---
  const handleAddNotice = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      showToast("Enter title and content", "error");
      return;
    }

    setPosting(true);
    try {
      await firestore()
        .collection("notices")
        .add({
          title: newTitle,
          content: newContent,
          date: new Date().toLocaleDateString("en-GB"),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      showToast("Notice posted successfully!", "success");
      setNewTitle("");
      setNewContent("");
      setIsAdding(false);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = (id) => {
    setAlert({
      visible: true,
      title: "Delete Notice?",
      msg: "This action cannot be undone.",
      onConfirm: async () => {
        setAlert({ ...alert, visible: false });
        try {
          await firestore().collection("notices").doc(id).delete();
          showToast("Notice deleted.", "success");
        } catch (error) {
          showToast("Delete failed.", "error");
        }
      },
    });
  };

  const renderNotice = ({ item }) => (
    <View
      className={`${theme.card} p-5 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center mb-1">
            <MaterialCommunityIcons
              name="bullhorn-variant"
              size={16}
              color="#f49b33"
              className="mr-2"
            />
            <Text className="text-white font-bold text-lg">{item.title}</Text>
          </View>
          <Text className="text-gray-400 text-xs mb-3 italic">{item.date}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          className="p-2 bg-red-500/10 rounded-xl border border-red-500/30"
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View className="bg-[#282C34] p-3 rounded-xl border border-[#4C5361]/50">
        <Text className="text-gray-300 text-sm leading-5">{item.content}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.msg}
        type="warning"
        onCancel={() => setAlert({ ...alert, visible: false })}
        onConfirm={alert.onConfirm}
        confirmText="Delete"
      />
      <CustomToast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* --- HEADER --- */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-[#333842] p-2 rounded-full border border-[#4C5361] mr-3"
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Global Notices</Text>
        </View>

        <TouchableOpacity
          onPress={() => setIsAdding(true)}
          className="bg-[#333842] p-2 rounded-full border border-[#f49b33]"
        >
          <Ionicons name="add" size={24} color="#f49b33" />
        </TouchableOpacity>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          renderItem={renderNotice}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="bullhorn-outline"
                size={80}
                color="gray"
              />
              <Text className="text-white text-center mt-4 text-lg">
                No notices posted yet.
              </Text>
              <Text className="text-gray-500 text-sm">
                Tap + to create one.
              </Text>
            </View>
          )}
        />
      )}

      {/* --- CREATE MODAL --- */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#333842] rounded-t-3xl border-t border-[#f49b33] p-6 h-[70%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">
                New Announcement
              </Text>
              <TouchableOpacity onPress={() => setIsAdding(false)}>
                <Ionicons name="close" size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-gray-400 text-xs font-bold uppercase mb-2">
                Title
              </Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Holiday Announcement"
                placeholderTextColor="#555"
                className="bg-[#282C34] text-white p-4 rounded-xl border border-[#4C5361] mb-5 font-bold"
              />

              <Text className="text-gray-400 text-xs font-bold uppercase mb-2">
                Message Content
              </Text>
              <TextInput
                value={newContent}
                onChangeText={setNewContent}
                placeholder="Type your message here..."
                placeholderTextColor="#555"
                multiline
                numberOfLines={6}
                className="bg-[#282C34] text-white p-4 rounded-xl border border-[#4C5361] mb-8 h-40"
                style={{ textAlignVertical: "top" }}
              />

              <TouchableOpacity
                onPress={handleAddNotice}
                disabled={posting}
                className="bg-[#f49b33] p-4 rounded-xl items-center shadow-lg"
              >
                {posting ? (
                  <ActivityIndicator color="#282C34" />
                ) : (
                  <Text className="text-[#282C34] font-bold text-lg">
                    Post Notice
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ManageNotices;
