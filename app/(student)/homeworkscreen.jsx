import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../../config/firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

import CustomToast from "../../components/CustomToast";

const StudentHomework = () => {
  const router = useRouter();
  const [homeworkList, setHomeworkList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentClass, setStudentClass] = useState(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const colors = {
    bg: "#282C34",
    card: "#333842",
    accent: "#f49b33",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    linkColor: "#2196F3",
    date: "#4CAF50",
  };

  const fetchHomework = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      let currentClass = studentClass;
      let mySubjects = [];

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        currentClass = userData.standard;
        mySubjects = userData.enrolledSubjects || [];
        setStudentClass(currentClass);
      }

      if (currentClass) {
        const q = query(
          collection(db, "homework"),
          where("classId", "==", currentClass)
        );
        const querySnapshot = await getDocs(q);

        const list = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setHomeworkList(list);
      }
    } catch (error) {
      console.log("Error fetching homework:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomework();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setStudentClass(null);
    await fetchHomework();
    setRefreshing(false);
  }, []);

  const handleOpenLink = (url, title, attachmentName) => {
    if (url) {
      const isPdf =
        attachmentName?.toLowerCase().endsWith(".pdf") ||
        url.toLowerCase().includes(".pdf");
      const type = isPdf ? "pdf" : "image";

      router.push({
        pathname: "/(student)/view_attachment",
        params: {
          url: url,
          title: title || "Homework",
          type: type,
        },
      });
    } else {
      showToast("No document attached.", "info");
    }
  };

  const renderItem = ({ item }) => (
    <View
      style={{ backgroundColor: colors.card }}
      className="p-4 rounded-xl mb-3 border border-[#4C5361]"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-2">
          <Text style={{ color: colors.text }} className="font-bold text-base">
            {item.title}
          </Text>
          <Text
            style={{
              color: colors.accent,
              fontSize: 12,
              fontWeight: "bold",
              marginTop: 2,
            }}
          >
            {item.subject}
          </Text>
          {item.description ? (
            <Text style={{ color: colors.subText, fontSize: 12, marginTop: 4 }}>
              {item.description}
            </Text>
          ) : null}
        </View>

        <View className="items-end">
          <Text
            style={{ color: colors.subText, fontSize: 10, marginBottom: 6 }}
          >
            {item.date}
          </Text>

          {item.link ? (
            <TouchableOpacity
              onPress={() =>
                handleOpenLink(item.link, item.title, item.attachmentName)
              }
              className="mt-1"
            >
              <Ionicons
                name="cloud-download-outline"
                size={22}
                color={colors.linkColor}
              />
            </TouchableOpacity>
          ) : (
            <Ionicons name="ban-outline" size={22} color={colors.subText} />
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${colors.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      className="pt-8"
    >
      <StatusBar backgroundColor={colors.bg} barStyle="light-content" />

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
          color={colors.text}
          onPress={() => router.back()}
        />
        <Text
          style={{ color: colors.text }}
          className="text-2xl font-semibold ml-4"
        >
          My Homework
        </Text>
      </View>

      <FlatList
        data={homeworkList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={() => (
          <View className="items-center justify-center mt-20">
            <Ionicons name="book-outline" size={50} color={colors.subText} />
            <Text className="text-gray-500 text-center mt-4">
              {studentClass
                ? `No homework found for Class "${studentClass}"`
                : "No Class assigned to your profile."}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default StudentHomework;
