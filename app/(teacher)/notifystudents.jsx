import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

import CustomToast from "../../components/CustomToast";

const TeacherClassUpdates = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Data State
  const [teachingProfile, setTeachingProfile] = useState([]);
  const [uniqueClasses, setUniqueClasses] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [history, setHistory] = useState([]);

  // Selections
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTag, setSelectedTag] = useState("General"); // Quick Tag

  // Form
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [teacherName, setTeacherName] = useState("");

  // Toast
  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
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
    send: "#f49b33",
  };

  // --- 1. FETCH PROFILE & HISTORY ---
  useEffect(() => {
    const init = async () => {
      try {
        const uid = auth().currentUser?.uid;
        if (!uid) return;

        // Fetch User Profile
        const userDoc = await firestore().collection("users").doc(uid).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          setTeacherName(data.name || "Teacher");

          const profile = data.teachingProfile || [];
          if (profile.length > 0) {
            setTeachingProfile(profile);
            const classes = [...new Set(profile.map((item) => item.class))];
            setUniqueClasses(classes);
            // Auto-select first
            if (classes.length > 0) handleClassChange(classes[0], profile);
          } else {
            // Fallback
            const classes = data.classesTaught || [];
            const subjects = data.subjects || [];
            setUniqueClasses(classes);
            setTeachingProfile(
              classes.flatMap((c) =>
                subjects.map((s) => ({ class: c, subject: s }))
              )
            );
            if (classes.length > 0) {
              setSelectedClass(classes[0]);
              setAvailableSubjects(subjects);
              if (subjects.length > 0) setSelectedSubject(subjects[0]);
            }
          }
        }

        // Fetch History
        const historySnap = await firestore()
          .collection("class_notices")
          .where("teacherId", "==", uid)
          .orderBy("createdAt", "desc")
          .limit(20)
          .get();

        const list = historySnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setHistory(list);
      } catch (error) {
        console.log("Init Error:", error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // --- 2. HANDLE SELECTION ---
  const handleClassChange = (cls, profileData = teachingProfile) => {
    setSelectedClass(cls);
    const relevant = profileData
      .filter((item) => item.class === cls)
      .map((item) => item.subject);
    setAvailableSubjects(relevant);

    if (relevant.length > 0) setSelectedSubject(relevant[0]);
    else setSelectedSubject(null);
  };

  // --- 3. SEND NOTICE ---
  const handleSend = async () => {
    if (
      !title.trim() ||
      !message.trim() ||
      !selectedClass ||
      !selectedSubject
    ) {
      showToast("Please fill all fields.", "error");
      return;
    }

    setSending(true);
    try {
      const noticeData = {
        title: title.trim(),
        subject: selectedSubject,
        tag: selectedTag,
        message: message.trim(),
        content: message.trim(), // Legacy support
        classId: selectedClass,
        teacherId: auth().currentUser.uid,
        teacherName: teacherName,
        date: new Date().toLocaleDateString("en-GB"),
        createdAt: firestore.FieldValue.serverTimestamp(),
        type: "Class Update",
      };

      const docRef = await firestore()
        .collection("class_notices")
        .add(noticeData);

      // Update local history immediately
      setHistory((prev) => [
        { id: docRef.id, ...noticeData, createdAt: new Date() },
        ...prev,
      ]);

      showToast(`Sent to ${selectedClass}!`, "success");
      setTitle("");
      setMessage("");
      setSelectedTag("General");
    } catch (error) {
      showToast("Failed to send.", "error");
    } finally {
      setSending(false);
    }
  };

  // --- RENDER HISTORY CARD ---
  const renderHistoryItem = ({ item }) => {
    // Determine Icon based on Tag
    let icon = "notifications";
    if (item.tag === "Homework") icon = "book";
    if (item.tag === "Test") icon = "document-text";
    if (item.tag === "Urgent") icon = "alert-circle";
    if (item.tag === "Holiday") icon = "airplane";

    return (
      <View
        className={`${theme.card} p-4 rounded-2xl mb-4 border ${theme.borderColor}`}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center">
            <View className="bg-[#f49b33]/20 p-2 rounded-full mr-3">
              <Ionicons name={icon} size={16} color="#f49b33" />
            </View>
            <View>
              <Text className="text-white font-bold text-base">
                {item.title}
              </Text>
              <Text className="text-gray-400 text-xs">
                {item.classId} • {item.subject}
              </Text>
            </View>
          </View>
          <Text className="text-gray-500 text-[10px]">{item.date}</Text>
        </View>

        <View className="bg-[#282C34] p-3 rounded-xl border border-[#4C5361]/50">
          <Text className="text-gray-300 text-sm leading-5">
            {item.message || item.content}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
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

      {/* --- HEADER --- */}
      <View className="px-5 pt-10 pb-2 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">New Announcement</Text>
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
          <View className="mb-6">
            <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">
              Target Class
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {uniqueClasses.map((cls) => (
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
              ))}
            </ScrollView>

            {selectedClass && (
              <>
                <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">
                  Target Subject
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {availableSubjects.map((sub) => (
                    <TouchableOpacity
                      key={sub}
                      onPress={() => setSelectedSubject(sub)}
                      className={`mr-3 px-5 py-2 rounded-xl border ${selectedSubject === sub ? "bg-blue-500 border-blue-500" : "bg-[#333842] border-[#4C5361]"}`}
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

          {/* --- COMPOSER CARD --- */}
          <View
            className={`${theme.card} p-4 rounded-2xl border ${theme.borderColor} mb-6`}
          >

            <TextInput
              placeholder="Title (e.g. Test Syllabus)"
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
              className="bg-[#282C34] text-white p-4 rounded-xl border border-[#4C5361] mb-3 font-bold text-base"
            />

            <TextInput
              placeholder="Write your message here..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={5}
              value={message}
              onChangeText={setMessage}
              className="bg-[#282C34] text-white p-4 rounded-xl border border-[#4C5361] mb-4 text-sm"
              style={{ textAlignVertical: "top" }}
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={sending}
              className="bg-[#f49b33] py-4 rounded-xl flex-row justify-center items-center shadow-lg"
            >
              {sending ? (
                <ActivityIndicator color="#282C34" />
              ) : (
                <>
                  <Ionicons
                    name="send"
                    size={20}
                    color="#282C34"
                    className="mr-2"
                  />
                  <Text className="text-[#282C34] font-bold text-lg">
                    Post Announcement
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* --- HISTORY --- */}
          <Text className="text-[#f49b33] font-bold text-lg mb-4 px-1">
            Recent Updates
          </Text>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
            scrollEnabled={false}
            ListEmptyComponent={() => (
              <View className="items-center py-10 opacity-30">
                <MaterialCommunityIcons
                  name="bell-sleep"
                  size={50}
                  color="gray"
                />
                <Text className="text-gray-400 mt-2">
                  No updates sent recently.
                </Text>
              </View>
            )}
          />
          <View className="h-10" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default TeacherClassUpdates;
