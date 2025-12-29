import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// NATIVE SDK
import firestore from "@react-native-firebase/firestore";

import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";

// --- SELECTION CONSTANTS ---
const ALL_CLASSES = [
  "Guest",
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

const LOWER_CLASSES = ["Prep", "1st", "2nd", "3rd"];
const MIDDLE_CLASSES = ["4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const HIGHER_CLASSES = ["11th", "12th"];

const SUB_MIDDLE = ["English", "Hindi", "Maths", "Science", "Social Science"];
const SUB_HIGHER_ALL = [
  "English",
  "Economics",
  "Physics",
  "Chemistry",
  "Maths",
  "Accounts",
  "Business Studies",
  "History",
  "Geography",
  "Political Science",
];

const ManageContent = () => {
  const router = useRouter();
  const scrollRef = useRef(); // To scroll to top on Edit

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [contentList, setContentList] = useState([]);

  // --- FORM STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState("");

  // Selection Logic
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [modalType, setModalType] = useState(null); // 'class' | 'subject'

  const [currentVideoLink, setCurrentVideoLink] = useState("");
  const [playlist, setPlaylist] = useState([]);
  const [fetchingVideo, setFetchingVideo] = useState(false);

  // --- ALERTS ---
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("default");
  const [alertConfirmAction, setAlertConfirmAction] = useState(null);

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  const colors = {
    BG: "#282C34",
    CARD: "#333842",
    ACCENT: "#f49b33",
    TEXT: "#FFFFFF",
    SUB_TEXT: "#BBBBBB",
    DELETE: "#F44336",
    SUCCESS: "#4CAF50",
  };

  // --- 1. FETCH COURSES ---
  useEffect(() => {
    const unsubscribe = firestore()
      .collection("courses")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setContentList(list);
        setLoading(false);
      });
    return () => unsubscribe();
  }, []);

  // --- 2. SUBJECT LOGIC (Similar to Teacher Signup) ---
  useEffect(() => {
    if (!selectedClass) {
      setAvailableSubjects([]);
      setSelectedSubject(null);
      return;
    }

    if (selectedClass === "Guest") {
      setAvailableSubjects([]);
      setSelectedSubject("General");
    } else if (selectedClass === "CS") {
      setAvailableSubjects([]);
      setSelectedSubject("N/A");
    } else if (LOWER_CLASSES.includes(selectedClass)) {
      setAvailableSubjects(["All Subjects"]);
      setSelectedSubject("All Subjects");
    } else if (MIDDLE_CLASSES.includes(selectedClass)) {
      setAvailableSubjects(SUB_MIDDLE);
      // If editing, keep the subject, else null to force selection
      if (!isEditing) setSelectedSubject(null);
    } else if (HIGHER_CLASSES.includes(selectedClass)) {
      setAvailableSubjects(SUB_HIGHER_ALL);
      if (!isEditing) setSelectedSubject(null);
    }
  }, [selectedClass]);

  // --- 3. VIDEO HANDLERS ---
  const getYoutubeId = (url) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleAddVideo = async () => {
    const videoId = getYoutubeId(currentVideoLink);
    if (!videoId) return showToast("Invalid YouTube URL", "error");

    setFetchingVideo(true);
    try {
      // Fetch metadata from oEmbed
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      const data = await response.json();

      const newVideo = {
        id: Date.now().toString(),
        title: data.title || "Untitled Video",
        videoId: videoId,
        duration: "Video",
      };

      // Auto-set thumbnail/title if first video
      if (playlist.length === 0) {
        setThumbnail(data.thumbnail_url);
        if (!title) setTitle(data.title);
      }

      setPlaylist([...playlist, newVideo]);
      setCurrentVideoLink("");
    } catch (error) {
      // Fallback if oEmbed fails (e.g. restricted video)
      const newVideo = {
        id: Date.now().toString(),
        title: `Video ${playlist.length + 1}`,
        videoId: videoId,
        duration: "Video",
      };
      setPlaylist([...playlist, newVideo]);
      setCurrentVideoLink("");
      showToast("Added (Metadata fetch failed)", "warning");
    } finally {
      setFetchingVideo(false);
    }
  };

  const moveVideo = (index, direction) => {
    const newPlaylist = [...playlist];
    if (direction === "up" && index > 0) {
      [newPlaylist[index], newPlaylist[index - 1]] = [
        newPlaylist[index - 1],
        newPlaylist[index],
      ];
    } else if (direction === "down" && index < newPlaylist.length - 1) {
      [newPlaylist[index], newPlaylist[index + 1]] = [
        newPlaylist[index + 1],
        newPlaylist[index],
      ];
    }
    setPlaylist(newPlaylist);
  };

  const removeVideo = (index) => {
    setPlaylist(playlist.filter((_, i) => i !== index));
  };

  // --- 4. CRUD OPERATIONS ---
  const handleSaveOrUpdate = async () => {
    if (!title.trim() || playlist.length === 0)
      return showToast("Title & Videos required", "error");
    if (!selectedClass || !selectedSubject)
      return showToast("Target Class/Subject required", "error");

    // Construct Target String (e.g. "11th Physics" or "Guest")
    let targetString = selectedClass;
    if (
      selectedClass !== "Guest" &&
      selectedClass !== "CS" &&
      selectedSubject !== "N/A" &&
      selectedSubject !== "All Subjects"
    ) {
      targetString = `${selectedClass} ${selectedSubject}`;
    }

    setUploading(true);
    try {
      const payload = {
        title,
        description,
        thumbnail,
        target: targetString,
        playlist,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      if (isEditing) {
        await firestore().collection("courses").doc(editingId).update(payload);
        showToast("Course Updated!", "success");
      } else {
        await firestore()
          .collection("courses")
          .add({
            ...payload,
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
        showToast("Course Created!", "success");
      }

      resetForm();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCourse = (id) => {
    setAlertTitle("Delete Course?");
    setAlertMessage("This action is permanent.");
    setAlertType("warning");
    setAlertConfirmAction(() => () => performDelete(id));
    setAlertVisible(true);
  };

  const performDelete = async (id) => {
    setAlertVisible(false);
    try {
      await firestore().collection("courses").doc(id).delete();
      showToast("Deleted.", "success");
      if (editingId === id) resetForm();
    } catch (e) {
      showToast("Delete failed.", "error");
    }
  };

  const handleEditClick = (item) => {
    // 1. Parse Target String back to Class/Subject
    const targetStr = item.target || "";
    let cls = null;
    let sub = null;

    if (targetStr === "Guest") {
      cls = "Guest";
      sub = "General";
    } else if (targetStr === "CS") {
      cls = "CS";
      sub = "N/A";
    } else {
      // Try to split "11th Physics" -> ["11th", "Physics"]
      // Handle "All Subjects" edge case if stored differently
      const parts = targetStr.split(" ");
      if (parts.length >= 2) {
        cls = parts[0];
        sub = parts.slice(1).join(" ");
      } else {
        cls = targetStr; // Fallback
        sub = "All Subjects";
      }
    }

    // 2. Set State
    setTitle(item.title);
    setDescription(item.description);
    setThumbnail(item.thumbnail);
    setPlaylist(item.playlist || []);
    setSelectedClass(cls);
    setSelectedSubject(sub);

    setIsEditing(true);
    setEditingId(item.id);

    // 3. Scroll to top
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setThumbnail("");
    setPlaylist([]);
    setSelectedClass(null);
    setSelectedSubject(null);
    setIsEditing(false);
    setEditingId(null);
  };

  // --- RENDER ---
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.BG }}
      className="pt-2"
    >
      <StatusBar backgroundColor={colors.BG} barStyle="light-content" />

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
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* HEADER */}
      <View className="px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Course Builder</Text>
        </View>
        {isEditing && (
          <TouchableOpacity onPress={resetForm}>
            <Text className="text-[#f49b33] font-bold">Cancel Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1 px-4" ref={scrollRef}>
        {/* --- FORM CARD --- */}
        <View
          className="p-4 rounded-2xl mb-6 border border-[#4C5361]"
          style={{ backgroundColor: colors.CARD }}
        >
          <Text
            style={{ color: colors.ACCENT }}
            className="font-bold mb-3 uppercase text-xs tracking-widest"
          >
            {isEditing ? `Editing: ${title}` : "Create New Course"}
          </Text>

          {/* TARGET SELECTION (ROW) */}
          <View className="flex-row justify-between mb-4">
            {/* CLASS SELECTOR */}
            <TouchableOpacity
              onPress={() => setModalType("class")}
              className="flex-1 bg-[#282C34] p-3 rounded-xl border border-[#4C5361] mr-2 justify-center"
            >
              <Text className="text-gray-400 text-[10px] uppercase font-bold">
                Class / Target
              </Text>
              <Text
                className={`font-bold text-base ${selectedClass ? "text-white" : "text-gray-500"}`}
              >
                {selectedClass || "Select..."}
              </Text>
            </TouchableOpacity>

            {/* SUBJECT SELECTOR */}
            <TouchableOpacity
              onPress={() => {
                if (!selectedClass) showToast("Select Class first", "error");
                else if (availableSubjects.length > 0) setModalType("subject");
              }}
              disabled={availableSubjects.length === 0}
              className={`flex-1 bg-[#282C34] p-3 rounded-xl border border-[#4C5361] ml-2 justify-center ${availableSubjects.length === 0 ? "opacity-50" : ""}`}
            >
              <Text className="text-gray-400 text-[10px] uppercase font-bold">
                Subject
              </Text>
              <Text
                className={`font-bold text-base ${selectedSubject ? "text-white" : "text-gray-500"}`}
              >
                {selectedSubject ||
                  (selectedClass === "CS" ? "N/A" : "Select...")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* TEXT INPUTS */}
          <TextInput
            placeholder="Course Title"
            placeholderTextColor={colors.SUB_TEXT}
            value={title}
            onChangeText={setTitle}
            className="p-4 rounded-xl border mb-3 bg-[#282C34] text-white border-[#4C5361] font-bold"
          />
          <TextInput
            placeholder="Description (Optional)"
            placeholderTextColor={colors.SUB_TEXT}
            value={description}
            onChangeText={setDescription}
            className="p-4 rounded-xl border mb-4 bg-[#282C34] text-white border-[#4C5361]"
          />

          {/* VIDEO ADDER */}
          <View className="h-[1px] bg-[#4C5361] mb-4 opacity-50" />
          <Text
            style={{ color: colors.ACCENT }}
            className="font-bold mb-2 text-xs uppercase tracking-widest"
          >
            Playlist Content
          </Text>

          <View className="flex-row mb-4">
            <TextInput
              placeholder="Paste YouTube Link"
              placeholderTextColor={colors.SUB_TEXT}
              value={currentVideoLink}
              onChangeText={setCurrentVideoLink}
              className="flex-1 p-3 rounded-l-xl border bg-[#282C34] text-white border-[#4C5361]"
            />
            <TouchableOpacity
              onPress={handleAddVideo}
              disabled={fetchingVideo}
              className="bg-[#f49b33] px-4 justify-center rounded-r-xl"
            >
              {fetchingVideo ? (
                <ActivityIndicator color="#282C34" />
              ) : (
                <Ionicons name="add" size={28} color="#282C34" />
              )}
            </TouchableOpacity>
          </View>

          {/* PLAYLIST */}
          {playlist.map((vid, index) => (
            <View
              key={index}
              className="flex-row items-center bg-[#282C34] p-3 rounded-xl mb-2 border border-[#4C5361]"
            >
              <Text className="text-[#f49b33] font-bold mr-3">{index + 1}</Text>
              <View className="flex-1">
                <Text
                  className="text-white text-sm font-semibold"
                  numberOfLines={1}
                >
                  {vid.title}
                </Text>
                <Text className="text-gray-500 text-[10px]">
                  ID: {vid.videoId}
                </Text>
              </View>

              {/* REORDER CONTROLS */}
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => moveVideo(index, "up")}
                  disabled={index === 0}
                  className="p-1"
                >
                  <Ionicons
                    name="chevron-up"
                    size={20}
                    color={index === 0 ? "#444" : "#ccc"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveVideo(index, "down")}
                  disabled={index === playlist.length - 1}
                  className="p-1 mr-2"
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={index === playlist.length - 1 ? "#444" : "#ccc"}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeVideo(index)}>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.DELETE}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            onPress={handleSaveOrUpdate}
            disabled={uploading}
            className={`py-4 rounded-xl items-center mt-4 ${isEditing ? "bg-blue-600" : "bg-[#f49b33]"}`}
          >
            {uploading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text
                className={`${isEditing ? "text-white" : "text-[#282C34]"} font-bold text-lg`}
              >
                {isEditing ? "Update Course" : "Save Course"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* --- LIBRARY LIST --- */}
        <View className="flex-row justify-between items-end mb-2">
          <Text className="text-gray-400 font-bold uppercase tracking-widest text-xs">
            Course Library
          </Text>
          <Text className="text-[#f49b33] text-xs">
            {contentList.length} Items
          </Text>
        </View>

        {contentList.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleEditClick(item)}
            activeOpacity={0.7}
            className={`p-3 rounded-2xl mb-4 border flex-row ${editingId === item.id ? "border-[#f49b33] bg-[#f49b33]/10" : "border-[#4C5361] bg-[#333842]"}`}
          >
            <Image
              source={{
                uri: item.thumbnail || "https://via.placeholder.com/150",
              }}
              className="w-20 h-14 rounded-lg mr-3 bg-gray-600"
              resizeMode="cover"
            />
            <View className="flex-1 justify-center">
              <Text
                className="text-white font-bold text-base"
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text className="text-gray-400 text-xs">
                {item.target} • {item.playlist?.length || 0} Videos
              </Text>
              {editingId === item.id && (
                <Text className="text-[#f49b33] text-[10px] font-bold mt-1">
                  ● EDITING NOW
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => handleDeleteCourse(item.id)}
              className="justify-center px-2"
              hitSlop={10}
            >
              <Ionicons name="trash-outline" size={22} color={colors.DELETE} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        <View className="h-20" />
      </ScrollView>

      {/* --- SELECTION MODAL --- */}
      <Modal
        visible={!!modalType}
        transparent
        animationType="fade"
        onRequestClose={() => setModalType(null)}
      >
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View className="bg-[#333842] rounded-2xl max-h-[70%] border border-[#f49b33]">
            <View className="p-4 border-b border-[#4C5361] flex-row justify-between items-center">
              <Text className="text-[#f49b33] font-bold text-lg capitalize">
                Select {modalType}
              </Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={modalType === "class" ? ALL_CLASSES : availableSubjects}
              keyExtractor={(i) => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    if (modalType === "class") setSelectedClass(item);
                    else setSelectedSubject(item);
                    setModalType(null);
                  }}
                  className="p-4 border-b border-[#4C5361] items-center active:bg-[#f49b33]/20"
                >
                  <Text className="text-white font-bold text-lg">{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ManageContent;
