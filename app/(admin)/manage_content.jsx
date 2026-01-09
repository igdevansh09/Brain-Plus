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
import * as ImagePicker from "expo-image-picker";
import storage from "@react-native-firebase/storage";

// NATIVE SDK
import firestore from "@react-native-firebase/firestore";

import CustomAlert from "../../components/CustomAlert";
import CustomToast from "../../components/CustomToast";
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

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
  const scrollRef = useRef();
  const { theme, isDark } = useTheme(); // Get dynamic theme values

  const [activeTab, setActiveTab] = useState("banners");

  // --- BANNER STATE ---
  const [banners, setBanners] = useState([]);
  const [bannerImage, setBannerImage] = useState(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // --- COURSE STATE ---
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
  const [modalType, setModalType] = useState(null);

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

  // --- 0. INITIAL FETCH ---
  useEffect(() => {
    fetchBanners();

    // Existing Course Listener with SAFETY CHECK
    const unsubscribe = firestore()
      .collection("courses")
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          if (snapshot && snapshot.docs) {
            const list = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setContentList(list);
          }
          setLoading(false);
        },
        (error) => {
          console.log("Firestore Error:", error);
          setLoading(false);
        }
      );
    return () => unsubscribe();
  }, []);

  // --- BANNER LOGIC ---
  const fetchBanners = async () => {
    try {
      const snap = await firestore()
        .collection("banners")
        .orderBy("createdAt", "desc")
        .get();

      if (snap && snap.docs) {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setBanners(list);
      }
    } catch (e) {
      console.error("Fetch banners error", e);
    }
  };

  const pickBannerImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled) {
      setBannerImage(result.assets[0].uri);
    }
  };

  const handleUploadBanner = async () => {
    if (!bannerImage) return showToast("Select image first", "error");

    setUploadingBanner(true);
    try {
      const filename = `banners/${Date.now()}.jpg`;
      const reference = storage().ref(filename);
      await reference.putFile(bannerImage);
      const url = await reference.getDownloadURL();

      await firestore().collection("banners").add({
        imageUrl: url,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      showToast("Banner added!");
      setBannerImage(null);
      fetchBanners();
    } catch (error) {
      showToast("Upload failed", "error");
    } finally {
      setUploadingBanner(false);
    }
  };

  const performBannerDelete = async (id, imageUrl) => {
    setAlertVisible(false);
    try {
      if (imageUrl) {
        try {
          await storage().refFromURL(imageUrl).delete();
          console.log("Image deleted from storage");
        } catch (storageErr) {
          console.warn("Storage delete failed:", storageErr);
        }
      }

      await firestore().collection("banners").doc(id).delete();

      showToast("Banner deleted");
      fetchBanners();
    } catch (e) {
      console.error(e);
      showToast("Delete failed", "error");
    }
  };

  const handleDeleteBanner = (id, imageUrl) => {
    setAlertTitle("Delete Banner");
    setAlertMessage("This cannot be undone.");
    setAlertType("warning");
    setAlertConfirmAction(() => () => performBannerDelete(id, imageUrl));
    setAlertVisible(true);
  };

  // --- 2. SUBJECT LOGIC ---
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

      if (playlist.length === 0) {
        setThumbnail(data.thumbnail_url);
        if (!title) setTitle(data.title);
      }

      setPlaylist([...playlist, newVideo]);
      setCurrentVideoLink("");
    } catch (error) {
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
      const parts = targetStr.split(" ");
      if (parts.length >= 2) {
        cls = parts[0];
        sub = parts.slice(1).join(" ");
      } else {
        cls = targetStr;
        sub = "All Subjects";
      }
    }

    setTitle(item.title);
    setDescription(item.description);
    setThumbnail(item.thumbnail);
    setPlaylist(item.playlist || []);
    setSelectedClass(cls);
    setSelectedSubject(sub);

    setIsEditing(true);
    setEditingId(item.id);

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
      style={{ flex: 1, backgroundColor: theme.bgPrimary }}
      className="pt-2"
    >
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

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
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{ color: theme.textPrimary }}
            className="text-xl font-bold"
          >
            Manage Content
          </Text>
        </View>
        {isEditing && activeTab === "courses" && (
          <TouchableOpacity onPress={resetForm}>
            <Text style={{ color: theme.accent }} className="font-bold">
              Cancel Edit
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* --- TABS --- */}
      <View className="flex-row px-4 mb-4">
        <TouchableOpacity
          onPress={() => setActiveTab("banners")}
          style={{
            borderColor: activeTab === "banners" ? theme.accent : "transparent",
            borderBottomWidth: 2,
          }}
          className="flex-1 py-3"
        >
          <Text
            style={{
              color:
                activeTab === "banners" ? theme.accent : theme.textSecondary,
            }}
            className="text-center font-bold"
          >
            Banners
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("courses")}
          style={{
            borderColor: activeTab === "courses" ? theme.accent : "transparent",
            borderBottomWidth: 2,
          }}
          className="flex-1 py-3"
        >
          <Text
            style={{
              color:
                activeTab === "courses" ? theme.accent : theme.textSecondary,
            }}
            className="text-center font-bold"
          >
            Courses
          </Text>
        </TouchableOpacity>
      </View>

      {/* === BANNER TAB === */}
      {activeTab === "banners" ? (
        <ScrollView className="flex-1 px-4">
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="p-4 rounded-xl border mb-6"
          >
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold mb-3"
            >
              Add New Banner
            </Text>

            <TouchableOpacity
              onPress={pickBannerImage}
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.textMuted,
              }}
              className="h-40 rounded-lg border border-dashed items-center justify-center mb-4 overflow-hidden"
            >
              {bannerImage ? (
                <Image
                  source={{ uri: bannerImage }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="items-center">
                  <Ionicons
                    name="image-outline"
                    size={40}
                    color={theme.textMuted}
                  />
                  <Text style={{ color: theme.textMuted }} className="mt-2">
                    Tap to select image
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleUploadBanner}
              disabled={uploadingBanner}
              style={{
                backgroundColor: theme.accent,
                opacity: uploadingBanner ? 0.5 : 1,
              }}
              className="py-3 rounded-lg items-center"
            >
              {uploadingBanner ? (
                <ActivityIndicator color={theme.textDark} />
              ) : (
                <Text style={{ color: theme.textDark }} className="font-bold">
                  Upload Banner
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text
            style={{ color: theme.accent }}
            className="font-bold text-lg mb-3"
          >
            Current Banners
          </Text>
          {banners.length === 0 && (
            <Text style={{ color: theme.textMuted }} className="italic">
              No banners active.
            </Text>
          )}

          {banners.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: theme.bgSecondary,
                borderColor: theme.border,
              }}
              className="mb-4 rounded-xl overflow-hidden border"
            >
              <Image
                source={{ uri: item.imageUrl }}
                className="w-full h-40"
                resizeMode="cover"
              />
              <View className="p-3 flex-row justify-between items-center">
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs"
                >
                  Uploaded:{" "}
                  {item.createdAt?.toDate
                    ? item.createdAt.toDate().toLocaleDateString()
                    : "Just now"}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeleteBanner(item.id, item.imageUrl)}
                  style={{ backgroundColor: theme.errorSoft }}
                  className="p-2 rounded-lg"
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={theme.error}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View className="h-20" />
        </ScrollView>
      ) : (
        /* === COURSES TAB === */
        <ScrollView className="flex-1 px-4" ref={scrollRef}>
          {/* --- FORM CARD --- */}
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="p-4 rounded-2xl mb-6 border"
          >
            <Text
              style={{ color: theme.accent }}
              className="font-bold mb-3 uppercase text-xs tracking-widest"
            >
              {isEditing ? `Editing: ${title}` : "Create New Course"}
            </Text>

            {/* TARGET SELECTION */}
            <View className="flex-row justify-between mb-4">
              {/* CLASS SELECTOR */}
              <TouchableOpacity
                onPress={() => setModalType("class")}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                }}
                className="flex-1 p-3 rounded-xl border mr-2 justify-center"
              >
                <Text
                  style={{ color: theme.textMuted }}
                  className="text-[10px] uppercase font-bold"
                >
                  Class / Target
                </Text>
                <Text
                  style={{
                    color: selectedClass ? theme.textPrimary : theme.textMuted,
                    fontWeight: "bold",
                  }}
                  className="text-base"
                >
                  {selectedClass || "Select..."}
                </Text>
              </TouchableOpacity>

              {/* SUBJECT SELECTOR */}
              <TouchableOpacity
                onPress={() => {
                  if (!selectedClass) showToast("Select Class first", "error");
                  else if (availableSubjects.length > 0)
                    setModalType("subject");
                }}
                disabled={availableSubjects.length === 0}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                  opacity: availableSubjects.length === 0 ? 0.5 : 1,
                }}
                className="flex-1 p-3 rounded-xl border ml-2 justify-center"
              >
                <Text
                  style={{ color: theme.textMuted }}
                  className="text-[10px] uppercase font-bold"
                >
                  Subject
                </Text>
                <Text
                  style={{
                    color: selectedSubject
                      ? theme.textPrimary
                      : theme.textMuted,
                    fontWeight: "bold",
                  }}
                  className="text-base"
                >
                  {selectedSubject ||
                    (selectedClass === "CS" ? "N/A" : "Select...")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* TEXT INPUTS */}
            <TextInput
              placeholder="Course Title"
              placeholderTextColor={theme.placeholder}
              value={title}
              onChangeText={setTitle}
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
                color: theme.textPrimary,
              }}
              className="p-4 rounded-xl border mb-3 font-bold"
            />
            <TextInput
              placeholder="Description (Optional)"
              placeholderTextColor={theme.placeholder}
              value={description}
              onChangeText={setDescription}
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
                color: theme.textPrimary,
              }}
              className="p-4 rounded-xl border mb-4"
            />

            {/* VIDEO ADDER */}
            <View
              style={{ backgroundColor: theme.border }}
              className="h-[1px] mb-4 opacity-50"
            />
            <Text
              style={{ color: theme.accent }}
              className="font-bold mb-2 text-xs uppercase tracking-widest"
            >
              Playlist Content
            </Text>

            <View className="flex-row mb-4">
              <TextInput
                placeholder="Paste YouTube Link"
                placeholderTextColor={theme.placeholder}
                value={currentVideoLink}
                onChangeText={setCurrentVideoLink}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                }}
                className="flex-1 p-3 rounded-l-xl border"
              />
              <TouchableOpacity
                onPress={handleAddVideo}
                disabled={fetchingVideo}
                style={{ backgroundColor: theme.accent }}
                className="px-4 justify-center rounded-r-xl"
              >
                {fetchingVideo ? (
                  <ActivityIndicator color={theme.textDark} />
                ) : (
                  <Ionicons name="add" size={28} color={theme.textDark} />
                )}
              </TouchableOpacity>
            </View>

            {/* PLAYLIST */}
            {playlist.map((vid, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                }}
                className="flex-row items-center p-3 rounded-xl mb-2 border"
              >
                <Text
                  style={{ color: theme.accent }}
                  className="font-bold mr-3"
                >
                  {index + 1}
                </Text>
                <View className="flex-1">
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="text-sm font-semibold"
                    numberOfLines={1}
                  >
                    {vid.title}
                  </Text>
                  <Text
                    style={{ color: theme.textMuted }}
                    className="text-[10px]"
                  >
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
                      color={index === 0 ? theme.textDim : theme.textSecondary}
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
                      color={
                        index === playlist.length - 1
                          ? theme.textDim
                          : theme.textSecondary
                      }
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeVideo(index)}>
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={theme.error}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              onPress={handleSaveOrUpdate}
              disabled={uploading}
              style={{ backgroundColor: isEditing ? theme.info : theme.accent }}
              className="py-4 rounded-xl items-center mt-4"
            >
              {uploading ? (
                <ActivityIndicator color={theme.textDark} />
              ) : (
                <Text
                  style={{ color: theme.textDark }}
                  className="font-bold text-lg"
                >
                  {isEditing ? "Update Course" : "Save Course"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* --- LIBRARY LIST --- */}
          <View className="flex-row justify-between items-end mb-2">
            <Text
              style={{ color: theme.textMuted }}
              className="font-bold uppercase tracking-widest text-xs"
            >
              Course Library
            </Text>
            <Text style={{ color: theme.accent }} className="text-xs">
              {contentList.length} Items
            </Text>
          </View>

          {contentList.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleEditClick(item)}
              activeOpacity={0.7}
              style={{
                backgroundColor:
                  editingId === item.id
                    ? theme.accentSoft10
                    : theme.bgSecondary,
                borderColor:
                  editingId === item.id ? theme.accent : theme.border,
              }}
              className="p-3 rounded-2xl mb-4 border flex-row"
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
                  style={{ color: theme.textPrimary }}
                  className="font-bold text-base"
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs"
                >
                  {item.target} • {item.playlist?.length || 0} Videos
                </Text>
                {editingId === item.id && (
                  <Text
                    style={{ color: theme.accent }}
                    className="text-[10px] font-bold mt-1"
                  >
                    ● EDITING NOW
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => handleDeleteCourse(item.id)}
                className="justify-center px-2"
                hitSlop={10}
              >
                <Ionicons name="trash-outline" size={22} color={theme.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          <View className="h-20" />
        </ScrollView>
      )}

      {/* --- SELECTION MODAL --- */}
      <Modal
        visible={!!modalType}
        transparent
        animationType="fade"
        onRequestClose={() => setModalType(null)}
      >
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center p-6"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
            }}
            className="rounded-2xl max-h-[70%] border"
          >
            <View
              style={{ borderColor: theme.border }}
              className="p-4 border-b flex-row justify-between items-center"
            >
              <Text
                style={{ color: theme.accent }}
                className="font-bold text-lg capitalize"
              >
                Select {modalType}
              </Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
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
                  style={{ borderColor: theme.border }}
                  className="p-4 border-b items-center"
                >
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="font-bold text-lg"
                  >
                    {item}
                  </Text>
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
