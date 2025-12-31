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

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

import CustomToast from "../../components/CustomToast";
import CustomAlert from "../../components/CustomAlert";

const TeacherHomework = () => {
  const router = useRouter();
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

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    text: "text-white",
    subText: "text-gray-400",
    borderColor: "border-[#4C5361]",
  };

  // --- 1. INITIAL FETCH ---
  useEffect(() => {
    let unsubscribeSnapshot;
    const init = async () => {
      try {
        const currentUser = auth().currentUser;
        if (!currentUser) {
          setLoading(false);
          return;
        }

        const userDoc = await firestore()
          .collection("users")
          .doc(currentUser.uid)
          .get();
        if (userDoc.exists) {
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

        unsubscribeSnapshot = firestore()
          .collection("homework")
          .where("teacherId", "==", currentUser.uid)
          .orderBy("createdAt", "desc")
          .onSnapshot(
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

  const uploadFile = async (uri, filename) => {
    const filePath = `homework_attachments/${auth().currentUser.uid}/${Date.now()}_${filename}`;
    const reference = storage().ref(filePath);
    await reference.putFile(uri);
    return await reference.getDownloadURL();
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
      const docData = {
        title: title.trim(),
        description: description.trim(),
        attachments: uploadedFiles,
        link: uploadedFiles.length > 0 ? uploadedFiles[0].url : "",
        attachmentName: uploadedFiles.length > 0 ? uploadedFiles[0].name : "",
        fileType: uploadedFiles.length > 0 ? uploadedFiles[0].type : "none",
        classId: selectedClass,
        subject: selectedSubject,
        teacherId: auth().currentUser.uid,
        dueDate: formatDate(new Date()),
        createdAt: firestore.FieldValue.serverTimestamp(),
      };
      await firestore().collection("homework").add(docData);
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

  // --- DELETE FUNCTION WITH STORAGE CLEANUP ---
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
          // JUST DELETE THE DOC. The Cloud Function does the rest.
          await firestore().collection("homework").doc(id).delete();
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
        className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor} shadow-sm`}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-2">
            <Text className="text-white font-bold text-lg mb-1">
              {item.title}
            </Text>
            <View className="flex-row flex-wrap mb-2">
              <View className="bg-[#f49b33]/20 px-2 py-0.5 rounded mr-2 mb-1">
                <Text className="text-[#f49b33] text-[10px] font-bold">
                  {item.classId}
                </Text>
              </View>
              <View className="bg-blue-500/20 px-2 py-0.5 rounded mb-1">
                <Text className="text-blue-400 text-[10px] font-bold">
                  {item.subject}
                </Text>
              </View>
            </View>
            {item.description ? (
              <Text className="text-gray-400 text-sm mb-2">
                {item.description}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)} // <--- Pass ID only
            className="p-2 mb-2 bg-red-500/10 rounded-lg"
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
        {displayAttachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2 border-t border-[#4C5361]/50 pt-3"
          >
            {displayAttachments.map((file, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() =>
                  openAttachment(item.id, idx, file.name, file.type)
                }
                className="bg-[#282C34] px-3 py-2 rounded-lg border border-[#4C5361] flex-row items-center mr-2"
              >
                <Ionicons
                  name={file.type === "pdf" ? "document-text" : "image"}
                  size={16}
                  color="#f49b33"
                  className="mr-2"
                />
                <Text
                  className="text-gray-400 text-xs max-w-[120px]"
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View className="mt-2 items-end flex-row justify-end items-center">
          <Text className="text-gray-500 text-[10px]">{item.dueDate}</Text>
        </View>
      </View>
    );
  };

  if (loading)
    return (
      <SafeAreaView
        className={`flex-1 ${theme.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );

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
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Homework</Text>
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
          <View className="mb-4">
            <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">
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
                    className={`mr-3 px-5 py-2 rounded-xl border ${selectedClass === cls ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-[#4C5361]"}`}
                  >
                    <Text
                      className={`font-bold ${selectedClass === cls ? "text-[#282C34]" : "text-gray-400"}`}
                    >
                      {cls}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-gray-500 italic ml-1">
                  No classes found.
                </Text>
              )}
            </ScrollView>
            {selectedClass && (
              <>
                <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">
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
                      className={`mr-3 px-5 py-2 rounded-xl border ${selectedSubject === sub ? "bg-blue-600 border-blue-600" : "bg-[#333842] border-[#4C5361]"}`}
                    >
                      <Text
                        className={`font-bold ${selectedSubject === sub ? "text-white" : "text-gray-400"}`}
                      >
                        {sub}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
          <View
            className={`${theme.card} p-4 rounded-3xl border ${theme.borderColor} mb-6`}
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[#f49b33] text-xs font-bold uppercase tracking-widest">
                New Assignment
              </Text>
            </View>
            <TextInput
              placeholder="Title (e.g. Chapter 5 Summary)"
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
              className="bg-[#282C34] text-white p-3 rounded-xl border border-[#4C5361] mb-3 font-bold"
            />
            <TextInput
              placeholder="Description (Optional)"
              placeholderTextColor="#666"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ textAlignVertical: "top" }}
              className="bg-[#282C34] text-white p-3 rounded-xl border border-[#4C5361] mb-4 text-sm"
            />
            <View className="flex-row justify-between mb-4 mt-2">
              <TouchableOpacity
                onPress={() => pickImage(true)}
                className="flex-1 bg-[#282C34] py-4 rounded-xl border border-[#4C5361] items-center mr-2 active:bg-[#f49b33]/10"
              >
                <Ionicons name="camera" size={24} color="#f49b33" />
                <Text className="text-white font-bold text-xs mt-1">
                  Camera
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => pickImage(false)}
                className="flex-1 bg-[#282C34] py-4 rounded-xl border border-[#4C5361] items-center mr-2 active:bg-[#29B6F6]/10"
              >
                <Ionicons name="images" size={24} color="#29B6F6" />
                <Text className="text-white font-bold text-xs mt-1">
                  Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickDocument}
                className="flex-1 bg-[#282C34] py-4 rounded-xl border border-[#4C5361] items-center active:bg-[#EF5350]/10"
              >
                <Ionicons name="document-text" size={24} color="#EF5350" />
                <Text className="text-white font-bold text-xs mt-1">PDF</Text>
              </TouchableOpacity>
            </View>
            {attachments.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-400 text-[10px] uppercase mb-2 ml-1">
                  Selected Files
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {attachments.map((file, idx) => (
                    <View key={idx} className="mr-3 relative pt-2 pr-2">
                      <View className="bg-[#282C34] p-3 rounded-xl border border-[#4C5361] items-center w-20 h-20 justify-center">
                        {file.type === "image" ? (
                          <Image
                            source={{ uri: file.uri }}
                            className="w-8 h-8 rounded mb-1"
                          />
                        ) : (
                          <Ionicons
                            name="document-text"
                            size={24}
                            color="#f49b33"
                            className="mb-1"
                          />
                        )}
                        <Text
                          className="text-gray-400 text-[8px] text-center"
                          numberOfLines={2}
                        >
                          {file.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeAttachment(idx)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          zIndex: 10,
                        }}
                        className="bg-red-500 rounded-full p-1 shadow-sm"
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
              className="bg-[#f49b33] py-4 rounded-xl flex-row justify-center items-center shadow-lg mt-2"
            >
              {uploading ? (
                <ActivityIndicator color="#282C34" size="small" />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane"
                    size={20}
                    color="#282C34"
                    className="mr-2"
                  />
                  <Text className="text-[#282C34] font-bold text-lg">
                    Upload Homework
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center mb-4">
            <MaterialCommunityIcons
              name="history"
              size={20}
              color="#f49b33"
              className="mr-2"
            />
            <Text className="text-white font-bold text-lg">
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
                  color="gray"
                />
                <Text className="text-gray-400 mt-2">
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
