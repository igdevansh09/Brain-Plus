import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

dayjs.extend(relativeTime);

const StudentHomework = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [homework, setHomework] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    cardHighlight: "bg-[#3E4451]",
    accent: "text-[#f49b33]",
    accentBg: "bg-[#f49b33]",
    border: "border-[#4C5361]",
    text: "text-white",
    subText: "text-gray-400",
  };

  const fetchHomework = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      const userDoc = await firestore().collection("users").doc(user.uid).get();
      const studentClass = userDoc.data()?.standard || userDoc.data()?.class;

      if (!studentClass) {
        setLoading(false);
        return;
      }

      const snapshot = await firestore()
        .collection("homework")
        .where("classId", "==", studentClass)
        .orderBy("createdAt", "desc")
        .get();

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setHomework(data);
    } catch (error) {
      console.log("Homework Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHomework();
  }, []);

  const filteredData = useMemo(() => {
    if (selectedSubject === "All") return homework;
    return homework.filter((h) => h.subject === selectedSubject);
  }, [selectedSubject, homework]);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(homework.map((h) => h.subject));
    return ["All", ...Array.from(subjects)];
  }, [homework]);

  const openAttachment = (docId, attachmentIndex, name, type) => {
    if (!docId) return;
    router.push({
      pathname: "/(student)/view_attachment",
      params: {
        docId: docId,
        idx: String(attachmentIndex),
        title: name,
        type: type,
      },
    });
  };

  const renderHomeworkItem = ({ item }) => {
    const displayAttachments =
      item.attachments ||
      (item.link
        ? [{ name: item.attachmentName, url: item.link, type: item.fileType }]
        : []);

    return (
      <View
        className={`${theme.card} w-[92%] self-center rounded-2xl mb-4 border ${theme.border} shadow-sm overflow-hidden flex-row`}
      >
        {/* 1. Left Color Strip */}
        <View
          className={`w-1.5 h-full ${
            item.subject === "Maths"
              ? "bg-blue-500"
              : item.subject === "Science"
                ? "bg-green-500"
                : "bg-[#f49b33]"
          }`}
        />

        {/* 2. Main Content Area (Row Layout) */}
        <View className="flex-1 p-4 flex-row items-center justify-between">
          {/* LEFT SIDE: Description & Info */}
          <View className="flex-1 mr-3">
            {/* Header: Subject & Date */}
            <View className="flex-row items-center mb-1">
              <View
                className={`${theme.cardHighlight} px-2 py-0.5 rounded mr-2 border border-[#4C5361]`}
              >
                <Text className="text-gray-300 text-[9px] font-bold uppercase tracking-wider">
                  {item.subject}
                </Text>
              </View>
              <Text className="text-gray-500 text-[10px] font-medium">
                {item.createdAt?.toDate
                  ? dayjs(item.createdAt.toDate()).fromNow()
                  : "Recently"}
              </Text>
            </View>

            {/* Title */}
            <Text className="text-white font-bold text-base mb-1 leading-tight">
              {item.title}
            </Text>

            {/* Description (Truncated) */}
            {item.description ? (
              <Text
                className="text-gray-400 text-xs leading-relaxed mb-2"
                numberOfLines={2}
              >
                {item.description}
              </Text>
            ) : null}
          </View>

          {/* RIGHT SIDE: Open Button */}
          {displayAttachments.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                openAttachment(
                  item.id,
                  0,
                  displayAttachments[0].name,
                  displayAttachments[0].type
                )
              }
              className="bg-[#282C34] h-11 w-11 rounded-xl border border-[#f49b33]/50 items-center justify-center shadow-lg active:bg-[#f49b33]/20"
            >
              <Ionicons name="open-outline" size={20} color="#f49b33" />
            </TouchableOpacity>
          )}
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
      <StatusBar barStyle="light-content" backgroundColor="#282C34" />

      {/* Header */}
      <View className="px-5 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-5">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-[#333842] border border-[#4C5361] items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Homework</Text>
          <View className="w-9" />
        </View>

        {/* Filter Pills */}
        <View className="mb-2">
          <FlatList
            horizontal
            data={uniqueSubjects}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedSubject(item)}
                className={`mr-2 px-4 py-2 rounded-xl border ${
                  selectedSubject === item
                    ? "bg-[#f49b33] border-[#f49b33]"
                    : "bg-[#333842] border-[#4C5361]"
                }`}
              >
                <Text
                  className={`font-bold text-[11px] ${
                    selectedSubject === item
                      ? "text-[#282C34]"
                      : "text-gray-400"
                  }`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderHomeworkItem}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchHomework();
            }}
            tintColor="#f49b33"
            colors={["#f49b33"]}
            progressBackgroundColor="#333842"
          />
        }
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-20">
            <View className="w-20 h-20 rounded-full bg-[#333842] items-center justify-center mb-4 border border-[#4C5361]">
              <MaterialCommunityIcons
                name="book-open-page-variant-outline"
                size={32}
                color="#f49b33"
              />
            </View>
            <Text className="text-white font-bold text-base">
              No Assignments
            </Text>
            <Text className="text-gray-500 text-xs mt-2 text-center px-10">
              {selectedSubject === "All"
                ? "You're all caught up!"
                : `No homework for ${selectedSubject}.`}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default StudentHomework;
