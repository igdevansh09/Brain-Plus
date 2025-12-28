import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";

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

  const openAttachment = (url, name, type) => {
    router.push({
      pathname: "/(teacher)/view_attachment",
      params: { url: encodeURIComponent(url), title: name, type },
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
        className={`${theme.card} p-5 rounded-3xl mb-4 border ${theme.border} shadow-sm`}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-white font-bold text-lg mb-1">
              {item.title}
            </Text>
            <View className="flex-row">
              <View className="bg-blue-500/20 px-2 py-0.5 rounded mr-2">
                <Text className="text-blue-400 text-[10px] font-bold uppercase">
                  {item.subject}
                </Text>
              </View>
              <Text className="text-gray-500 text-[10px] font-bold uppercase">
                {item.createdAt?.toDate
                  ? dayjs(item.createdAt.toDate()).format("DD MMM")
                  : "Recent"}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={20}
            color="#f49b33"
          />
        </View>

        {item.description ? (
          <Text className="text-gray-400 text-sm mb-4 leading-5">
            {item.description}
          </Text>
        ) : null}

        {displayAttachments.length > 0 && (
          <View className="flex-row flex-wrap mt-2">
            {displayAttachments.map((file, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => openAttachment(file.url, file.name, file.type)}
                className="bg-[#282C34] px-3 py-2 rounded-xl border border-[#4C5361] flex-row items-center mr-2 mb-2"
              >
                <Ionicons
                  name={file.type === "pdf" ? "document-text" : "image"}
                  size={14}
                  color="#f49b33"
                  className="mr-2"
                />
                <Text className="text-gray-300 text-[10px]" numberOfLines={1}>
                  View File
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    <SafeAreaView className={`flex-1 ${theme.bg} pt-8`}>
      <StatusBar barStyle="light-content" />
      <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361]"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Class Notes</Text>
        <View className="w-10" />
      </View>

      <View className="px-5 mb-4">
        <FlatList
          horizontal
          data={uniqueSubjects}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedSubject(item)}
              className={`mr-3 px-5 py-2 rounded-full border ${selectedSubject === item ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-[#4C5361]"}`}
            >
              <Text
                className={`font-bold text-xs ${selectedSubject === item ? "text-[#282C34]" : "text-gray-400"}`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderNoteItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}
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
