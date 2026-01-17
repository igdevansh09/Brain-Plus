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

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { db } from "../../config/firebaseConfig"; // Import initialized db instance
// --- REFACTOR END ---

import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";
import { useTheme } from "../../context/ThemeContext";

const ManageNotices = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
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

  // --- FETCH NOTICES (MODULAR) ---
  useEffect(() => {
    setLoading(true);

    // Modular: query(collection(db, ...), orderBy(...))
    const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));

    // Modular: onSnapshot(query, callback)
    const unsubscribe = onSnapshot(
      q,
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

  // --- HANDLERS (MODULAR) ---
  const handleAddNotice = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      showToast("Enter title and content", "error");
      return;
    }

    setPosting(true);
    try {
      // Modular: addDoc(collection(db, ...), data)
      await addDoc(collection(db, "notices"), {
        title: newTitle,
        content: newContent,
        date: new Date().toLocaleDateString("en-GB"),
        createdAt: serverTimestamp(), // Modular Timestamp
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

  const renderNotice = ({ item }) => (
    <View
      style={{
        backgroundColor: theme.bgSecondary,
        borderColor: theme.border,
        shadowColor: theme.shadow,
      }}
      className="p-5 rounded-2xl mb-4 border shadow-sm"
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center mb-1">
            <MaterialCommunityIcons
              name="bullhorn-variant"
              size={16}
              color={theme.accent}
              className="mr-2"
            />
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-lg"
            >
              {item.title}
            </Text>
          </View>
          <Text
            style={{ color: theme.textSecondary }}
            className="text-xs mb-3 italic"
          >
            {item.date}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: theme.bgTertiary || theme.bgPrimary,
          borderColor: theme.borderSoft || theme.border,
        }}
        className="p-3 rounded-xl border"
      >
        <Text
          style={{ color: theme.textSecondary }}
          className="text-sm leading-5"
        >
          {item.content}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

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
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="p-2 rounded-full border mr-3"
          >
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{ color: theme.textPrimary }}
            className="text-2xl font-bold"
          >
            Global Notices
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setIsAdding(true)}
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.accent,
          }}
          className="p-2 rounded-full border"
        >
          <Ionicons name="add" size={24} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.accent}
          className="mt-10"
        />
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
                color={theme.textMuted}
              />
              <Text
                style={{ color: theme.textPrimary }}
                className="text-center mt-4 text-lg"
              >
                No notices posted yet.
              </Text>
              <Text style={{ color: theme.textSecondary }} className="text-sm">
                Tap + to create one.
              </Text>
            </View>
          )}
        />
      )}

      {/* --- CREATE MODAL --- */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-end"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="rounded-t-3xl border-t p-6 h-[70%]"
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text
                style={{ color: theme.textPrimary }}
                className="text-xl font-bold"
              >
                New Announcement
              </Text>
              <TouchableOpacity onPress={() => setIsAdding(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={{ color: theme.textMuted }}
                className="text-xs font-bold uppercase mb-2"
              >
                Title
              </Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Holiday Announcement"
                placeholderTextColor={theme.placeholder}
                style={{
                  backgroundColor: theme.bgPrimary,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                }}
                className="p-4 rounded-xl border mb-5 font-bold"
              />

              <Text
                style={{ color: theme.textMuted }}
                className="text-xs font-bold uppercase mb-2"
              >
                Message Content
              </Text>
              <TextInput
                value={newContent}
                onChangeText={setNewContent}
                placeholder="Type your message here..."
                placeholderTextColor={theme.placeholder}
                multiline
                numberOfLines={6}
                style={{
                  backgroundColor: theme.bgPrimary,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                  textAlignVertical: "top",
                }}
                className="p-4 rounded-xl border mb-8 h-40"
              />

              <TouchableOpacity
                onPress={handleAddNotice}
                disabled={posting}
                style={{
                  backgroundColor: theme.accent,
                  shadowColor: theme.shadow,
                }}
                className="p-4 rounded-xl items-center shadow-lg"
              >
                {posting ? (
                  <ActivityIndicator color={theme.textDark} />
                ) : (
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
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
 
