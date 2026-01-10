import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "@react-native-firebase/storage";
import { auth, db, storage } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";

const TeacherHomework = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Data
  const [teachingProfile, setTeachingProfile] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);
  const [history, setHistory] = useState([]);

  // Form
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Attachments Array
  const [attachments, setAttachments] = useState([]);

  // UI
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // --- 1. INITIAL FETCH (MODULAR) ---
  useEffect(() => {
    let unsubscribeSnapshot;
    const init = async () => {
      try {
        // Modular: auth.currentUser
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setLoading(false);
          return;
        }

        // Modular: doc + getDoc
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const data = userDoc.data();
          const profile = data.teachingProfile || [];
          if (profile && profile.length > 0) {
            setTeachingProfile(profile);
            const classes = [...new Set(profile.map((item) => item.class))];
            setMyClasses(classes);
            if (classes.length > 0) handleClassChange(classes[0], profile);
          } else {
            const classes = data.classesTaught || [];
            const subjects = data.subjects || [];
            setMyClasses(classes);
            const artificialProfile = classes.flatMap((c) =>
              subjects.map((s) => ({ class: c, subject: s }))
            );
            setTeachingProfile(artificialProfile);
            if (classes.length > 0)
              handleClassChange(classes[0], artificialProfile);
          }
        }

        // Modular: query + onSnapshot
        const q = query(
          collection(db, "homework"),
          where("teacherId", "==", currentUser.uid),
          orderBy("createdAt", "desc")
        );

        unsubscribeSnapshot = onSnapshot(
          q,
          (snapshot) => {
            if (snapshot) {
              const list = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));
              setHistory(list);
            }
            setLoading(false);
          },
          (error) => {
            console.log("History Error:", error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.log("Init Error:", error);
        setLoading(false);
      }
    };
    init();
    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // --- 2. LOGIC ---
  const handleClassChange = (cls, profileData = teachingProfile) => {
    setSelectedClass(cls);
    const relevantSubjects = profileData
      .filter((item) => item.class === cls)
      .map((item) => item.subject);
    const uniqueSubs = [...new Set(relevantSubjects)];
    setMySubjects(uniqueSubs);
    if (uniqueSubs.length > 0) setSelectedSubject(uniqueSubs[0]);
    else setSelectedSubject(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Just Now";
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString("en-GB");
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-GB");
  };

  // --- 3. ATTACHMENT HANDLERS ---
  const pickImage = async (useCamera) => {
    try {
      let result;
      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      };
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.granted === false) {
          showToast("Camera permission required", "warning");
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (!result.canceled) {
        const asset = result.assets[0];
        const name = asset.uri.split("/").pop();
        setAttachments([
          ...attachments,
          { uri: asset.uri, name: name, type: "image" },
        ]);
      }
    } catch (e) {
      showToast("Error picking image", "error");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled) {
        const newDocs = result.assets.map((doc) => ({
          uri: doc.uri,
          name: doc.name,
          type: "pdf",
          mimeType: "application/pdf",
        }));
        setAttachments((prev) => [...prev, ...newDocs]);
      }
    } catch (e) {
      showToast("Error picking document", "error");
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // --- UPLOAD FILE (MODULAR) ---
  const uploadFile = async (uri, filename) => {
    const filePath = `homework_attachments/${auth.currentUser.uid}/${Date.now()}_${filename}`;
    const storageRef = ref(storage, filePath);

    const response = await fetch(uri);
    const blob = await response.blob();

    // Modular: uploadBytes
    await uploadBytes(storageRef, blob);
    // Modular: getDownloadURL
    return await getDownloadURL(storageRef);
  };

  const handleAssign = async () => {
    if (!title.trim() || !selectedClass || !selectedSubject) {
      showToast("Title, Class and Subject are required.", "error");
      return;
    }
    setUploading(true);
    try {
      const uploadedFiles = [];
      for (const file of attachments) {
        const url = await uploadFile(file.uri, file.name);
        uploadedFiles.push({ name: file.name, url: url, type: file.type });
      }

      // Modular: addDoc + serverTimestamp
      const docData = {
        title: title.trim(),
        description: description.trim(),
        attachments: uploadedFiles,
        link: uploadedFiles.length > 0 ? uploadedFiles[0].url : "",
        attachmentName: uploadedFiles.length > 0 ? uploadedFiles[0].name : "",
        fileType: uploadedFiles.length > 0 ? uploadedFiles[0].type : "none",
        classId: selectedClass,
        subject: selectedSubject,
        teacherId: auth.currentUser.uid,
        dueDate: formatDate(new Date()),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "homework"), docData);

      showToast("Homework assigned successfully!", "success");
      setTitle("");
      setDescription("");
      setAttachments([]);
    } catch (error) {
      console.error("Assign Error:", error);
      showToast("Assignment Failed. Try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  // --- DELETE FUNCTION (MODULAR) ---
  const handleDelete = (id) => {
    setAlertConfig({
      visible: true,
      title: "Delete Assignment?",
      message: "This will permanently remove the homework for everyone.",
      confirmText: "Delete",
      type: "warning",
      onConfirm: async () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        try {
          // Modular: deleteDoc
          const docRef = doc(db, "homework", id);
          await deleteDoc(docRef);
          showToast("Deleted successfully", "success");
        } catch (e) {
          showToast("Delete failed", "error");
        }
      },
    });
  };

  const openAttachment = (docId, attachmentIndex, fileName, fileType) => {
    if (!docId) return showToast("Invalid file reference", "error");
    router.push({
      pathname: "/(teacher)/view_attachment",
      params: {
        docId: docId,
        idx: String(attachmentIndex),
        title: fileName,
        type: fileType,
      },
    });
  };

  const renderItem = ({ item }) => {
    const displayAttachments =
      item.attachments ||
      (item.link
        ? [{ name: item.attachmentName, url: item.link, type: item.fileType }]
        : []);
    return (
      <View
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        }}
        className="p-4 rounded-2xl mb-4 border shadow-sm"
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-2">
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-lg mb-1"
            >
              {item.title}
            </Text>
            <View className="flex-row flex-wrap mb-2">
              <View
                style={{ backgroundColor: theme.accentSoft20 }}
                className="px-2 py-0.5 rounded mr-2 mb-1"
              >
                <Text
                  style={{ color: theme.accent }}
                  className="text-[10px] font-bold"
                >
                  {item.classId}
                </Text>
              </View>
              <View
                style={{ backgroundColor: theme.infoSoft }}
                className="px-2 py-0.5 rounded mb-1"
              >
                <Text
                  style={{ color: theme.info }}
                  className="text-[10px] font-bold"
                >
                  {item.subject}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text
                style={{ color: theme.textSecondary }}
                className="text-sm mb-2"
              >
                {item.description}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={{ backgroundColor: theme.errorSoft }}
            className="p-2 mb-2 rounded-lg"
          >
            <Ionicons name="trash-outline" size={18} color={theme.error} />
          </TouchableOpacity>
        </View>
        {displayAttachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ borderTopColor: theme.border }}
            className="mt-2 border-t pt-3"
          >
            {displayAttachments.map((file, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() =>
                  openAttachment(item.id, idx, file.name, file.type)
                }
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                }}
                className="px-3 py-2 rounded-lg border flex-row items-center mr-2"
              >
                <Ionicons
                  name={file.type === "pdf" ? "document-text" : "image"}
                  size={16}
                  color={theme.accent}
                  className="mr-2"
                />
                <Text
                  style={{ color: theme.textMuted }}
                  className="text-xs max-w-[120px]"
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View className="mt-2 items-end flex-row justify-end items-center">
          <Text style={{ color: theme.textMuted }} className="text-[10px]">
            {item.dueDate}
          </Text>
        </View>
      </View>
    );
  };

  if (loading)
    return (
      <SafeAreaView
        style={{ backgroundColor: theme.bgPrimary }}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bgPrimary}
      />
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
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* --- HEADER --- */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="p-2 rounded-full border"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-xl font-bold"
        >
          Homework
        </Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {/* --- SELECTORS --- */}
          <View className="mb-4">
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs font-bold uppercase mb-2 ml-1"
            >
              Select Class
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-3"
            >
              {myClasses.length > 0 ? (
                myClasses.map((cls) => (
                  <TouchableOpacity
                    key={cls}
                    onPress={() => handleClassChange(cls)}
                    style={{
                      backgroundColor:
                        selectedClass === cls
                          ? theme.accent
                          : theme.bgSecondary,
                      borderColor:
                        selectedClass === cls ? theme.accent : theme.border,
                    }}
                    className="mr-3 px-5 py-2 rounded-xl border"
                  >
                    <Text
                      style={{
                        color:
                          selectedClass === cls
                            ? theme.textDark
                            : theme.textMuted,
                        fontWeight: "bold",
                      }}
                    >
                      {cls}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text
                  style={{ color: theme.textMuted }}
                  className="italic ml-1"
                >
                  No classes found.
                </Text>
              )}
            </ScrollView>
            {selectedClass && (
              <>
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs font-bold uppercase mb-2 ml-1"
                >
                  Select Subject
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-2"
                >
                  {mySubjects.map((sub) => (
                    <TouchableOpacity
                      key={sub}
                      onPress={() => setSelectedSubject(sub)}
                      style={{
                        backgroundColor:
                          selectedSubject === sub
                            ? theme.info
                            : theme.bgSecondary,
                        borderColor:
                          selectedSubject === sub ? theme.info : theme.border,
                      }}
                      className="mr-3 px-5 py-2 rounded-xl border"
                    >
                      <Text
                        style={{
                          color:
                            selectedSubject === sub
                              ? theme.white
                              : theme.textMuted,
                          fontWeight: "bold",
                        }}
                      >
                        {sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>

          {/* --- COMPOSER CARD --- */}
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            }}
            className="p-4 rounded-3xl border mb-6 shadow-lg"
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text
                style={{ color: theme.accent }}
                className="text-xs font-bold uppercase tracking-widest"
              >
                New Assignment
              </Text>
            </View>
            <TextInput
              placeholder="Title (e.g. Chapter 5 Summary)"
              placeholderTextColor={theme.placeholder}
              value={title}
              onChangeText={setTitle}
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
                color: theme.textPrimary,
              }}
              className="p-3 rounded-xl border mb-3 font-bold"
            />
            <TextInput
              placeholder="Description (Optional)"
              placeholderTextColor={theme.placeholder}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{
                textAlignVertical: "top",
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
                color: theme.textPrimary,
              }}
              className="p-3 rounded-xl border mb-4 text-sm"
            />
            <View className="flex-row justify-between mb-4 mt-2">
              <TouchableOpacity
                onPress={() => pickImage(true)}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                }}
                className="flex-1 py-4 rounded-xl border items-center mr-2"
              >
                <Ionicons name="camera" size={24} color={theme.accent} />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="font-bold text-xs mt-1"
                >
                  Camera
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => pickImage(false)}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                }}
                className="flex-1 py-4 rounded-xl border items-center mr-2"
              >
                <Ionicons name="images" size={24} color={theme.info} />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="font-bold text-xs mt-1"
                >
                  Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickDocument}
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                }}
                className="flex-1 py-4 rounded-xl border items-center"
              >
                <Ionicons name="document-text" size={24} color={theme.error} />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="font-bold text-xs mt-1"
                >
                  PDF
                </Text>
              </TouchableOpacity>
            </View>
            {attachments.length > 0 && (
              <View className="mb-4">
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-[10px] uppercase mb-2 ml-1"
                >
                  Selected Files
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {attachments.map((file, idx) => (
                    <View key={idx} className="mr-3 relative pt-2 pr-2">
                      <View
                        style={{
                          backgroundColor: theme.bgTertiary,
                          borderColor: theme.border,
                        }}
                        className="p-3 rounded-xl border items-center w-20 h-20 justify-center"
                      >
                        {file.type === "image" ? (
                          <Image
                            source={{ uri: file.uri }}
                            className="w-8 h-8 rounded mb-1"
                          />
                        ) : (
                          <Ionicons
                            name="document-text"
                            size={24}
                            color={theme.accent}
                            className="mb-1"
                          />
                        )}
                        <Text
                          style={{ color: theme.textMuted }}
                          className="text-[8px] text-center"
                          numberOfLines={2}
                        >
                          {file.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeAttachment(idx)}
                        hitSlop={{
                          top: 10,
                          bottom: 10,
                          left: 10,
                          right: 10,
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          zIndex: 10,
                          backgroundColor: theme.error,
                        }}
                        className="rounded-full p-1 shadow-sm"
                      >
                        <Ionicons name="close" size={10} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            <TouchableOpacity
              onPress={handleAssign}
              disabled={uploading}
              style={{ backgroundColor: theme.accent }}
              className="py-4 rounded-xl flex-row justify-center items-center shadow-lg mt-2"
            >
              {uploading ? (
                <ActivityIndicator color={theme.textDark} size="small" />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane"
                    size={20}
                    color={theme.textDark}
                    className="mr-2"
                  />
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
                    Upload Homework
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* --- HISTORY --- */}
          <View className="flex-row items-center mb-4">
            <MaterialCommunityIcons
              name="history"
              size={20}
              color={theme.accent}
              className="mr-2"
            />
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-lg"
            >
              Recent Assignments
            </Text>
          </View>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 50 }}
            ListEmptyComponent={() => (
              <View className="items-center py-10 opacity-30">
                <MaterialCommunityIcons
                  name="notebook-outline"
                  size={60}
                  color={theme.textMuted}
                />
                <Text style={{ color: theme.textMuted }} className="mt-2">
                  No homework assigned yet.
                </Text>
              </View>
            )}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default TeacherHomework;
