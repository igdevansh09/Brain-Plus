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
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const StudentNotes = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");

  const theme = {
    bg: "bg-[#282C34]",
    card: "bg-[#333842]",
    accent: "text-[#f49b33]",
    border: "border-[#4C5361]",
  };

  const fetchNotes = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      const userDoc = await firestore().collection("users").doc(user.uid).get();
      const studentClass = userDoc.data()?.standard;

      if (!studentClass) {
        setLoading(false);
        return;
      }

      const snapshot = await firestore()
        .collection("materials")
        .where("classId", "==", studentClass)
        .orderBy("createdAt", "desc")
        .get();

      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setNotes(data);
    } catch (error) {
      console.log("Notes Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const filteredData = useMemo(() => {
    if (selectedSubject === "All") return notes;
    return notes.filter((n) => n.subject === selectedSubject);
  }, [selectedSubject, notes]);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(notes.map((n) => n.subject));
    return ["All", ...Array.from(subjects)];
  }, [notes]);

  const openAttachment = (docId, attachmentIndex, name, type) => {
    if (!docId) return;
    router.push({
      pathname: "/(student)/view_attachment",
      params: {
        docId,
        idx: String(attachmentIndex),
        title: name,
        type,
      },
    });
  };

  const renderNoteItem = ({ item }) => {
    const displayAttachments =
      item.attachments ||
      (item.link
        ? [{ name: item.attachmentName, url: item.link, type: item.fileType }]
        : []);

    return (
      <View
        className={`${theme.card} w-[92%] self-center rounded-2xl mb-4 border ${theme.border} shadow-sm overflow-hidden flex-row`}
      >
        {/* Left color strip */}
        <View
          className={`w-1.5 h-full ${
            item.subject === "Maths"
              ? "bg-blue-500"
              : item.subject === "Science"
                ? "bg-green-500"
                : "bg-[#f49b33]"
          }`}
        />

        <View className="flex-1 p-4 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center mb-1">
              <View
                className={`${theme.card} px-2 py-0.5 rounded mr-2 border border-[#4C5361]`}
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

            <Text className="text-white font-bold text-base mb-1 leading-tight">
              {item.title}
            </Text>

            {item.description ? (
              <Text
                className="text-gray-400 text-xs leading-relaxed mb-2"
                numberOfLines={2}
              >
                {item.description}
              </Text>
            ) : null}
          </View>

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
      <SafeAreaView className="flex-1 items-center justify-center bg-[#282C34]">
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#282C34]">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 pt-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Class Notes</Text>
        <View className="w-10" />
      </View>

      {/* Subject filter */}
      <View className="px-5 mb-4">
        <FlatList
          horizontal
          data={uniqueSubjects}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedSubject(item)}
              className={`mr-3 px-5 py-2 rounded-full border ${
                selectedSubject === item
                  ? "bg-[#f49b33] border-[#f49b33]"
                  : "bg-[#333842] border-[#4C5361]"
              }`}
            >
              <Text
                className={`font-bold text-xs ${
                  selectedSubject === item ? "text-[#282C34]" : "text-gray-400"
                }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Notes list */}
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderNoteItem}
        contentContainerStyle={{ paddingBottom: 50 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchNotes();
            }}
            tintColor="#f49b33"
          />
        }
        ListEmptyComponent={() => (
          <View className="items-center py-20 opacity-30">
            <MaterialCommunityIcons
              name="folder-outline"
              size={80}
              color="gray"
            />
            <Text className="text-gray-400 mt-4 text-center">
              No study materials available.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default StudentNotes;
