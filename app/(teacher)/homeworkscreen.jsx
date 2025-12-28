import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../../config/firebaseConfig";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import CustomToast from "../../components/CustomToast";

const TeacherHomeworkCreator = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [myClasses, setMyClasses] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [history, setHistory] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState(null); 

  const [toastVisible, setToastVisible] = useState(false);
  const [toastConfig, setToastConfig] = useState({});

  const showToast = (message, type) => {
    setToastConfig({ message, type });
    setToastVisible(true);
  };

  const colors = {
    BG: "#282C34",
    CARD: "#333842",
    ACCENT: "#f49b33",
    TEXT: "#FFFFFF",
    SUB_TEXT: "#BBBBBB",
    INPUT_BORDER: "#616A7D",
    LINK: "#1E88E5",
  };

  useEffect(() => {
    let unsubscribeHistory;
    const initializeScreen = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const classes = data.classesTaught || [];
            setMyClasses(classes);
            if (classes.length > 0) setSelectedClass(classes[0]);
            const subjects = data.subjects || [];
            setMySubjects(subjects);
            if (subjects.length > 0) setSelectedSubject(subjects[0]);
          }

          const q = query(
            collection(db, "homework"),
            where("teacherId", "==", user.uid)
          );

          unsubscribeHistory = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setHistory(list);
          });
        }
      } catch (error) {
        console.log("Init Error:", error);
      } finally {
        setLoading(false);
      }
    };
    initializeScreen();
    return () => {
      if (unsubscribeHistory) unsubscribeHistory();
    };
  }, []);

  const getTodayDate = () => {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const pickImage = async (useCamera) => {
    try {
      let result;
      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      };

      if (useCamera) {
        await ImagePicker.requestCameraPermissionsAsync();
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled) {
        const asset = result.assets[0];
        setAttachment({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: "image",
          mimeType: "image/jpeg",
        });
        showToast("Image selected", "success");
      }
    } catch (error) {
      showToast("Error picking image", "error");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        setAttachment({
          uri: doc.uri,
          name: doc.name,
          type: "pdf",
          mimeType: "application/pdf",
        });
        showToast("PDF selected", "success");
      }
    } catch (error) {
      showToast("Error picking document", "error");
    }
  };

 const uploadToCloudinary = async (file) => {
   if (!file) return "";

   const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
   const IMAGE_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_IMAGE_PRESET;
   const RAW_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_RAW_PRESET;

   if (!CLOUD_NAME || !IMAGE_PRESET || !RAW_PRESET) {
     throw new Error("Missing Cloudinary environment variables");
   }

   const data = new FormData();
   data.append("file", {
     uri: file.uri,
     type: file.mimeType,
     name: file.name,
   });

   const isPdf = file.type === "pdf";

   const uploadPreset = isPdf ? RAW_PRESET : IMAGE_PRESET;
   const endpoint = isPdf
     ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`
     : `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

   data.append("upload_preset", uploadPreset);

   try {
     const res = await fetch(endpoint, {
       method: "POST",
       body: data,
     });

     const result = await res.json();

     if (!result.secure_url) {
       throw new Error("Cloudinary upload failed");
     }

     if (isPdf && !result.secure_url.endsWith(".pdf")) {
       return `${result.secure_url}.pdf`;
     }

     return result.secure_url;
   } catch (error) {
     console.log("Upload Error:", error);
     throw error;
   }
 };



  const handlePublish = async () => {
    if (
      !title.trim() ||
      !description.trim() ||
      !selectedClass ||
      !selectedSubject
    ) {
      showToast("Please fill all fields.", "error");
      return;
    }

    setPublishing(true);
    try {
      let fileUrl = "";
      if (attachment) {
        fileUrl = await uploadToCloudinary(attachment);
      }

      const newAssignment = {
        title,
        link: fileUrl,
        description,
        classId: selectedClass,
        subject: selectedSubject,
        teacherId: auth.currentUser.uid,
        date: getTodayDate(),
        createdAt: new Date().toISOString(),
        attachmentName: attachment ? attachment.name : "",
      };

      await addDoc(collection(db, "homework"), newAssignment);

      showToast(`Homework published!`, "success");
      setTitle("");
      setAttachment(null);
      setDescription("");
    } catch (error) {
      showToast(error.message || "Upload failed.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const openAttachment = (item) => {
    if (!item.link) {
      showToast("No attachment found", "info");
      return;
    }

    router.push({
      pathname: "/(teacher)/view_attachment",
      params: {
        url: encodeURIComponent(item.link),
        title: item.title,
        type: item.link.endsWith(".pdf") ? "pdf" : "image",
      },
    });
  };


  const renderHistoryItem = (item) => (
    <View
      key={item.id}
      style={{ backgroundColor: colors.CARD }}
      className="p-4 rounded-xl mb-3 border border-[#4C5361]"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-2">
          <Text style={{ color: colors.TEXT }} className="font-bold text-base">
            {item.title}
          </Text>
          <Text
            style={{
              color: colors.ACCENT,
              fontSize: 12,
              fontWeight: "bold",
              marginTop: 2,
            }}
          >
            {item.subject}
          </Text>
          <Text style={{ color: colors.SUB_TEXT, fontSize: 12, marginTop: 2 }}>
            {item.description}
          </Text>
        </View>

        <View className="items-end">
          <Text
            style={{ color: colors.ACCENT, fontSize: 12, fontWeight: "bold" }}
          >
            {item.classId}
          </Text>
          <Text style={{ color: colors.SUB_TEXT, fontSize: 10, marginTop: 2 }}>
            {item.date}
          </Text>
          <TouchableOpacity
            onPress={() => openAttachment(item)}
            className="mt-2"
          >
            <Ionicons
              name="cloud-download-outline"
              size={20}
              color={item.link ? colors.LINK : colors.SUB_TEXT}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${colors.BG} justify-center items-center`}
      >
        <ActivityIndicator size="large" color={colors.ACCENT} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.BG }}
      className="pt-8"
    >
      <StatusBar backgroundColor={colors.BG} barStyle="light-content" />
      <CustomToast
        visible={toastVisible}
        message={toastConfig.message}
        type={toastConfig.type}
        onHide={() => setToastVisible(false)}
      />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.TEXT} />
        </TouchableOpacity>
        <Text
          style={{ color: colors.TEXT }}
          className="text-2xl font-semibold ml-4"
        >
          Assignment Creator
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
        <Text
          style={{ color: colors.ACCENT }}
          className="text-xl font-semibold mb-4"
        >
          Publish New Homework
        </Text>

        <View className="flex-row justify-between mb-4">
          <View style={{ width: "48%" }}>
            <Text style={{ color: colors.SUB_TEXT }} className="text-xs mb-1">
              Class
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (myClasses.length > 1) {
                  const curr = myClasses.indexOf(selectedClass);
                  setSelectedClass(myClasses[(curr + 1) % myClasses.length]);
                }
              }}
              style={{
                borderColor: colors.INPUT_BORDER,
                backgroundColor: colors.CARD,
              }}
              className="p-3 rounded-lg border flex-row justify-between items-center"
            >
              <Text
                style={{ color: colors.TEXT }}
                numberOfLines={1}
                className="text-base font-semibold"
              >
                {selectedClass || "..."}
              </Text>
              <Ionicons name="caret-down" size={14} color={colors.SUB_TEXT} />
            </TouchableOpacity>
          </View>

          <View style={{ width: "48%" }}>
            <Text style={{ color: colors.SUB_TEXT }} className="text-xs mb-1">
              Subject
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (mySubjects.length > 1) {
                  const curr = mySubjects.indexOf(selectedSubject);
                  setSelectedSubject(
                    mySubjects[(curr + 1) % mySubjects.length]
                  );
                }
              }}
              style={{
                borderColor: colors.INPUT_BORDER,
                backgroundColor: colors.CARD,
              }}
              className="p-3 rounded-lg border flex-row justify-between items-center"
            >
              <Text
                style={{ color: colors.TEXT }}
                numberOfLines={1}
                className="text-base font-semibold"
              >
                {selectedSubject || "..."}
              </Text>
              <Ionicons name="caret-down" size={14} color={colors.SUB_TEXT} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={{ color: colors.SUB_TEXT }} className="text-sm mb-2">
          Title
        </Text>
        <TextInput
          placeholder="E.g., Math Chapter 4"
          placeholderTextColor={colors.SUB_TEXT}
          value={title}
          onChangeText={setTitle}
          style={{
            backgroundColor: colors.CARD,
            color: colors.TEXT,
            borderColor: colors.INPUT_BORDER,
          }}
          className="p-3 rounded-lg border mb-4 text-base"
        />

        <Text style={{ color: colors.SUB_TEXT }} className="text-sm mb-2">
          Attach File (Optional)
        </Text>
        {attachment ? (
          <View
            style={{ borderColor: colors.ACCENT, backgroundColor: colors.CARD }}
            className="flex-row items-center p-3 rounded-lg border mb-4"
          >
            <Ionicons
              name={attachment.type === "pdf" ? "document-text" : "image"}
              size={24}
              color={colors.ACCENT}
            />
            <Text className="flex-1 ml-3 text-white" numberOfLines={1}>
              {attachment.name}
            </Text>
            <TouchableOpacity onPress={() => setAttachment(null)}>
              <Ionicons name="close-circle" size={24} color="#F44336" />
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row justify-between mb-4">
            <TouchableOpacity
              onPress={() => pickImage(true)}
              style={{
                backgroundColor: colors.CARD,
                borderColor: colors.INPUT_BORDER,
              }}
              className="items-center justify-center p-4 rounded-xl border w-[30%]"
            >
              <Ionicons name="camera" size={28} color={colors.ACCENT} />
              <Text
                style={{ color: colors.SUB_TEXT, fontSize: 10, marginTop: 4 }}
              >
                Camera
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage(false)}
              style={{
                backgroundColor: colors.CARD,
                borderColor: colors.INPUT_BORDER,
              }}
              className="items-center justify-center p-4 rounded-xl border w-[30%]"
            >
              <Ionicons name="images" size={28} color="#29B6F6" />
              <Text
                style={{ color: colors.SUB_TEXT, fontSize: 10, marginTop: 4 }}
              >
                Gallery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickDocument}
              style={{
                backgroundColor: colors.CARD,
                borderColor: colors.INPUT_BORDER,
              }}
              className="items-center justify-center p-4 rounded-xl border w-[30%]"
            >
              <Ionicons name="document-text" size={28} color="#4CAF50" />
              <Text
                style={{ color: colors.SUB_TEXT, fontSize: 10, marginTop: 4 }}
              >
                PDF
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={{ color: colors.SUB_TEXT }} className="text-sm mb-2">
          Instructions
        </Text>
        <TextInput
          multiline
          numberOfLines={4}
          placeholder="Detailed instructions..."
          placeholderTextColor={colors.SUB_TEXT}
          value={description}
          onChangeText={setDescription}
          style={{
            backgroundColor: colors.CARD,
            color: colors.TEXT,
            borderColor: colors.INPUT_BORDER,
            textAlignVertical: "top",
          }}
          className="p-3 rounded-lg border mb-6 text-base"
        />

        <TouchableOpacity
          onPress={handlePublish}
          disabled={publishing}
          style={{ backgroundColor: colors.ACCENT }}
          className="py-3 rounded-xl items-center mb-8"
        >
          {publishing ? (
            <View className="flex-row items-center">
              <ActivityIndicator color={colors.BG} />
              <Text
                style={{ color: colors.BG, marginLeft: 8, fontWeight: "bold" }}
              >
                Uploading...
              </Text>
            </View>
          ) : (
            <Text style={{ color: colors.BG }} className="text-lg font-bold">
              Publish Assignment
            </Text>
          )}
        </TouchableOpacity>

        <Text
          style={{ color: colors.ACCENT }}
          className="text-xl font-semibold mb-4 border-t border-[#4C5361] pt-4"
        >
          Recent Assignments
        </Text>
        {history.length > 0 ? (
          history.map((item) => renderHistoryItem(item))
        ) : (
          <Text
            style={{ color: colors.SUB_TEXT }}
            className="text-center mb-10 italic"
          >
            No assignments created yet.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherHomeworkCreator;
