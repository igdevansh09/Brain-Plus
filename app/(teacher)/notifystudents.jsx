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
import { useTheme } from "../../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  doc,
  getDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

import CustomToast from "../../components/CustomToast";

const TeacherClassUpdates = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
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
  const [selectedTag, setSelectedTag] = useState("General");

  // Form
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [teacherName, setTeacherName] = useState("");

  const [toast, setToast] = useState({
    visible: false,
    msg: "",
    type: "success",
  });
  const showToast = (msg, type = "success") =>
    setToast({ visible: true, msg, type });

  // --- 1. FETCH PROFILE (MODULAR) ---
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Modular: doc + getDoc
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const data = userDoc.data();
          setTeacherName(data.name || "Teacher");

          const profile = data.teachingProfile || [];
          if (profile.length > 0) {
            setTeachingProfile(profile);
            const classes = [...new Set(profile.map((item) => item.class))];
            setUniqueClasses(classes);
            if (classes.length > 0) handleClassChange(classes[0], profile);
          } else {
            // Fallback for older data structure
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
      } catch (error) {
        console.log("Profile Error:", error);
      }
    };

    fetchProfile();
  }, []);

  // --- 2. FETCH HISTORY (MODULAR LISTENER) ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);

    // Modular: query + onSnapshot
    const q = query(
      collection(db, "class_notices"),
      where("teacherId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setHistory(list);
        setLoading(false);
      },
      (error) => {
        console.error("History Listener Error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // --- HANDLE SELECTION ---
  const handleClassChange = (cls, profileData = teachingProfile) => {
    setSelectedClass(cls);
    const relevant = profileData
      .filter((item) => item.class === cls)
      .map((item) => item.subject);
    setAvailableSubjects(relevant);

    if (relevant.length > 0) setSelectedSubject(relevant[0]);
    else setSelectedSubject(null);
  };

  // --- SEND NOTICE (MODULAR) ---
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
      // Modular: addDoc + serverTimestamp
      await addDoc(collection(db, "class_notices"), {
        title: title.trim(),
        subject: selectedSubject,
        tag: selectedTag,
        message: message.trim(),
        content: message.trim(),
        classId: selectedClass,
        teacherId: auth.currentUser.uid,
        teacherName: teacherName,
        date: new Date().toLocaleDateString("en-GB"),
        createdAt: serverTimestamp(),
        type: "Class Update",
      });

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

  const renderHistoryItem = ({ item }) => {
    let icon = "notifications";
    if (item.tag === "Homework") icon = "book";
    if (item.tag === "Test") icon = "document-text";
    if (item.tag === "Urgent") icon = "alert-circle";
    if (item.tag === "Holiday") icon = "airplane";

    return (
      <View
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
        }}
        className="p-4 rounded-2xl mb-4 border"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center">
            <View
              style={{ backgroundColor: theme.accentSoft20 }}
              className="p-2 rounded-full mr-3"
            >
              <Ionicons name={icon} size={16} color={theme.accent} />
            </View>
            <View>
              <Text
                style={{ color: theme.textPrimary }}
                className="font-bold text-base"
              >
                {item.title}
              </Text>
              <Text style={{ color: theme.textSecondary }} className="text-xs">
                {item.classId} • {item.subject}
              </Text>
            </View>
          </View>
          <Text style={{ color: theme.textMuted }} className="text-[10px]">
            {item.date}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.bgTertiary,
            borderColor: theme.borderSoft,
          }}
          className="p-3 rounded-xl border"
        >
          <Text
            style={{ color: theme.textSecondary }}
            className="text-sm leading-5"
          >
            {item.message || item.content}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ backgroundColor: theme.bgPrimary }}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

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
          New Announcement
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
          <View className="mb-6">
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs font-bold uppercase mb-2 ml-1"
            >
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
                  style={{
                    backgroundColor:
                      selectedClass === cls ? theme.accent : theme.bgSecondary,
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
              ))}
            </ScrollView>

            {selectedClass && (
              <>
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs font-bold uppercase mb-2 ml-1"
                >
                  Target Subject
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {availableSubjects.map((sub) => (
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

          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="p-4 rounded-2xl border mb-6"
          >
            <TextInput
              placeholder="Title (e.g. Test Syllabus)"
              placeholderTextColor={theme.placeholder}
              value={title}
              onChangeText={setTitle}
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
                color: theme.textPrimary,
              }}
              className="p-4 rounded-xl border mb-3 font-bold text-base"
            />

            <TextInput
              placeholder="Write your message here..."
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={5}
              value={message}
              onChangeText={setMessage}
              style={{
                textAlignVertical: "top",
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
                color: theme.textPrimary,
              }}
              className="p-4 rounded-xl border mb-4 text-sm"
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={sending}
              style={{ backgroundColor: theme.accent }}
              className="py-4 rounded-xl flex-row justify-center items-center shadow-lg"
            >
              {sending ? (
                <ActivityIndicator color={theme.textDark} />
              ) : (
                <>
                  <Ionicons
                    name="send"
                    size={20}
                    color={theme.textDark}
                    className="mr-2"
                  />
                  <Text
                    style={{ color: theme.textDark }}
                    className="font-bold text-lg"
                  >
                    Post Announcement
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text
            style={{ color: theme.accent }}
            className="font-bold text-lg mb-4 px-1"
          >
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
                  color={theme.textMuted}
                />
                <Text style={{ color: theme.textMuted }} className="mt-2">
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
