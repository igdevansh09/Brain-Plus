import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
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

const ClassNotes = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [studentClass, setStudentClass] = useState("");

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
    downloadColor: "#4CAF50",
    softCard: "#4C5361",
  };

  const fetchNotes = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      let currentClass = studentClass;
      if (!currentClass) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          currentClass = userDoc.data().standard;
          setStudentClass(currentClass);
        }
      }

      if (currentClass) {
        const q = query(
          collection(db, "materials"),
          where("classId", "==", currentClass)
        );
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotes(list);
      }
    } catch (error) {
      console.log("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotes();
    setRefreshing(false);
  }, [studentClass]);

  const handleOpenLink = (url, title, attachmentName) => {
    if (url) {
      const isPdf =
        attachmentName?.toLowerCase().endsWith(".pdf") ||
        url.toLowerCase().includes(".pdf");
      const type = isPdf ? "pdf" : "image";

      router.push({
        pathname: "/view_attachment",
        params: {
          url: url,
          title: title || "Class Note",
          type: type,
        },
      });
    } else {
      showToast("This is a text-only note.", "info");
    }
  };

  const renderNoteCard = ({ item }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderLeftColor: item.link ? colors.downloadColor : colors.subText,
      }}
      className="p-4 rounded-xl mb-3 flex-row justify-between border-l-4"
    >
      <View className="flex-1 pr-3">
        <Text
          style={{ color: colors.subText }}
          className="text-xs font-medium mb-1"
        >
          {item.classId} • {item.date}
        </Text>
        <Text
          style={{ color: colors.text }}
          className="text-base font-semibold"
        >
          {item.title}
        </Text>
        {item.description ? (
          <Text
            style={{ color: colors.subText }}
            className="text-xs mt-2"
            numberOfLines={2}
          >
            {item.description}
          </Text>
        ) : null}
      </View>

      <View className="items-end justify-center pl-2">
        {item.link ? (
          <TouchableOpacity
            onPress={() =>
              handleOpenLink(item.link, item.title, item.attachmentName)
            }
            style={{ borderColor: colors.downloadColor }}
            className="rounded-lg px-3 py-1.5 border flex-row items-center"
          >
            <Ionicons
              name="open-outline"
              size={16}
              color={colors.downloadColor}
            />
            <Text
              style={{ color: colors.downloadColor }}
              className="font-bold text-sm ml-1"
            >
              Open
            </Text>
          </TouchableOpacity>
        ) : (
          <Ionicons
            name="document-text-outline"
            size={24}
            color={colors.subText}
          />
        )}
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={{ color: colors.text }}
          className="text-2xl font-semibold ml-4"
        >
          Class Notes
        </Text>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={renderNoteCard}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={() => (
          <View className="p-10 items-center justify-center">
            <Ionicons
              name="folder-open-outline"
              size={32}
              color={colors.subText}
            />
            <Text
              style={{ color: colors.text }}
              className="mt-4 text-lg font-semibold"
            >
              No Notes Found
            </Text>
            <Text
              style={{ color: colors.subText }}
              className="mt-1 text-sm text-center"
            >
              For Class {studentClass || "..."}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default ClassNotes;
