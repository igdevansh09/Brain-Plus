import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  FlatList,
  ActivityIndicator,
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
import CustomToast from "../../components/CustomToast";

const TeacherClassUpdates = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [myClasses, setMyClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [mySubjects, setMySubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [history, setHistory] = useState([]);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const colors = {
    BG: "#282C34",
    CARD: "#333842",
    ACCENT: "#f49b33",
    TEXT: "#FFFFFF",
    SUB_TEXT: "#BBBBBB",
    INPUT_BORDER: "#616A7D",
    SEND: "#4CAF50",
  };

  useEffect(() => {
    let unsubscribe;

    const init = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();

            const classes = data.classesTaught || [];
            setMyClasses(classes);
            if (classes.length > 0) setSelectedClass(classes[0]);

            const subjects = data.subjects || [];
            setMySubjects(subjects);
            if (subjects.length > 0) setSelectedSubject(subjects[0]);

            setTeacherName(data.name || "Teacher");
          }

          const q = query(
            collection(db, "class_notices"),
            where("teacherId", "==", user.uid)
          );

          unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setHistory(list);
          });
        }
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const getTodayDate = () => {
    const date = new Date();
    return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
  };

  const handleSend = async () => {
    if (
      !title.trim() ||
      !message.trim() ||
      !selectedClass ||
      !selectedSubject
    ) {
      showToast("Please fill all fields (Class, Subject, Title, Message).", "error");
      return;
    }

    setSending(true);
    try {
      await addDoc(collection(db, "class_notices"), {
        title: title.trim(),
        subject: selectedSubject,
        message: message.trim(),
        content: message.trim(),
        classId: selectedClass,
        teacherId: auth.currentUser.uid,
        teacherName: teacherName,
        date: getTodayDate(),
        createdAt: new Date().toISOString(),
        type: "Class Update",
      });

      showToast(`Update sent to Class ${selectedClass}!`, "success");
      setTitle("");
      setMessage("");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSending(false);
    }
  };

  const renderHistoryItem = ({ item }) => (
    <View
      style={{ backgroundColor: colors.CARD, borderLeftColor: colors.SEND }}
      className="p-4 rounded-xl mb-3 border-l-4"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-2">
          <Text
            style={{ color: colors.TEXT }}
            className="text-base font-semibold mb-1"
          >
            {item.title}
          </Text>
          <View className="flex-row flex-wrap mb-2">
            <Text
              style={{ color: colors.ACCENT }}
              className="text-xs font-bold mr-2"
            >
              [{item.subject || "General"}]
            </Text>
            <Text style={{ color: colors.SUB_TEXT }} className="text-xs italic">
              To: {item.classId}
            </Text>
          </View>
          <Text style={{ color: colors.TEXT }} className="text-sm">
            {item.content}
          </Text>
        </View>
      </View>
      <Text
        style={{ color: colors.SUB_TEXT }}
        className="text-xs text-right mt-2"
      >
        {item.date}
      </Text>
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
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <Ionicons
          name="arrow-back"
          size={24}
          color={colors.TEXT}
          onPress={() => router.back()}
        />
        <Text
          style={{ color: colors.TEXT }}
          className="text-2xl font-semibold ml-4"
        >
          Notify Students
        </Text>
      </View>

      <ScrollView className="flex-1">
        <View className="px-4 mb-4">
          <View className="flex-row justify-between mb-4">
            <View style={{ width: "48%" }}>
              <Text style={{ color: colors.SUB_TEXT }} className="text-xs mb-1">
                Class
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (myClasses.length > 1) {
                    const currentIndex = myClasses.indexOf(selectedClass);
                    const nextIndex = (currentIndex + 1) % myClasses.length;
                    setSelectedClass(myClasses[nextIndex]);
                  } else if (myClasses.length === 0) {
                    showToast("No classes assigned to you.", "warning");
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
                    const currentIndex = mySubjects.indexOf(selectedSubject);
                    const nextIndex = (currentIndex + 1) % mySubjects.length;
                    setSelectedSubject(mySubjects[nextIndex]);
                  } else if (mySubjects.length === 0) {
                    showToast("No subjects assigned to you.", "warning");
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
        </View>

        <View className="px-4">
          <Text style={{ color: colors.SUB_TEXT }} className="text-sm mb-2">
            Title
          </Text>
          <TextInput
            placeholder="E.g. Chapter 5 Test"
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
            Message
          </Text>
          <TextInput
            multiline
            numberOfLines={6}
            placeholder="Type your announcement..."
            placeholderTextColor={colors.SUB_TEXT}
            value={message}
            onChangeText={setMessage}
            style={{
              backgroundColor: colors.CARD,
              color: colors.TEXT,
              borderColor: colors.INPUT_BORDER,
              textAlignVertical: "top",
            }}
            className="p-3 rounded-lg border mb-6 text-base"
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={sending}
            style={{ backgroundColor: colors.SEND }}
            className="py-3 rounded-xl items-center mb-8"
          >
            {sending ? (
              <ActivityIndicator color={colors.BG} />
            ) : (
              <Text style={{ color: colors.BG }} className="text-lg font-bold">
                Send Update
              </Text>
            )}
          </TouchableOpacity>

          <Text
            style={{ color: colors.ACCENT }}
            className="text-xl font-semibold mb-4"
          >
            History
          </Text>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
            scrollEnabled={false}
            ListEmptyComponent={() => (
              <Text
                style={{ color: colors.SUB_TEXT }}
                className="text-center italic"
              >
                No updates sent yet.
              </Text>
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherClassUpdates;