import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  FlatList,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import firestore from "@react-native-firebase/firestore";

import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";

const ManageNotices = () => {
  const router = useRouter();
  const [notices, setNotices] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("default");
  const [alertConfirmAction, setAlertConfirmAction] = useState(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = firestore()
      .collection("notices")
      .orderBy("createdAt", "desc") // Sort by timestamp
      .onSnapshot(
        (snapshot) => {
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
          createdAt: firestore.FieldValue.serverTimestamp(), // Native Timestamp
        });

      showToast("Notice posted!", "success");
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
    setAlertTitle("Delete Notice?");
    setAlertMessage("This cannot be undone.");
    setAlertType("warning");
    setAlertConfirmAction(() => () => performDelete(id));
    setAlertVisible(true);
  };

  const performDelete = async (id) => {
    setAlertVisible(false);
    try {
      await firestore().collection("notices").doc(id).delete();
      showToast("Notice deleted.", "success");
    } catch (error) {
      showToast("Delete failed.", "error");
    }
  };

  const renderNotice = ({ item }) => (
    <View className="bg-[#333842] p-4 rounded-xl mb-3 border border-[#4C5361]">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-2">
          <Text className="text-white font-bold text-lg">{item.title}</Text>
          <Text className="text-gray-400 text-xs mb-2">{item.date}</Text>
          <Text className="text-white text-sm">{item.content}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          className="p-2 bg-red-500/10 rounded-lg"
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#282C34] pt-2">
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onCancel={() => setAlertVisible(false)}
        onConfirm={alertConfirmAction}
        confirmText="Delete"
      />

      <CustomToast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <View className="px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Global Notices</Text>
        </View>
        <TouchableOpacity onPress={() => setIsAdding(!isAdding)}>
          <Ionicons
            name={isAdding ? "close-circle" : "add-circle"}
            size={32}
            color="#f49b33"
          />
        </TouchableOpacity>
      </View>

      {isAdding && (
        <View className="mx-4 mb-4 p-4 bg-[#333842] rounded-xl border border-[#f49b33]">
          <Text className="text-white mb-3 font-semibold">New Notice</Text>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Title"
            placeholderTextColor="#888"
            className="bg-[#282C34] text-white p-3 rounded-lg border border-[#4C5361] mb-3"
          />
          <TextInput
            value={newContent}
            onChangeText={setNewContent}
            placeholder="Content..."
            placeholderTextColor="#888"
            multiline
            numberOfLines={3}
            className="bg-[#282C34] text-white p-3 rounded-lg border border-[#4C5361] mb-4 h-24"
            style={{ textAlignVertical: "top" }}
          />
          <TouchableOpacity
            onPress={handleAddNotice}
            disabled={posting}
            className={`p-3 rounded-lg items-center ${posting ? "bg-gray-600" : "bg-[#f49b33]"}`}
          >
            {posting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[#282C34] font-bold">Post Notice</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          renderItem={renderNotice}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={() => (
            <Text className="text-gray-500 text-center mt-10">
              No notices posted.
            </Text>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default ManageNotices;
