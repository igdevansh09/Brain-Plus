import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";

const theme = {
  bg: "bg-[#282C34]",
  card: "bg-[#333842]",
  accent: "text-[#f49b33]",
  borderColor: "border-[#4C5361]",
};

const AdminViewNotifications = () => {
  const router = useRouter();
  const [combinedNotices, setCombinedNotices] = useState([]);
  const [filteredNotices, setFilteredNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Data Buckets
  const [globalNotices, setGlobalNotices] = useState([]);
  const [classNotices, setClassNotices] = useState([]);

  // Filter State
  const [filter, setFilter] = useState("All"); // All, Global, Class

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);

  // --- LISTENERS ---
  useEffect(() => {
    const unsub1 = firestore()
      .collection("notices")
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        if (!snap) return;
        setGlobalNotices(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            sourceType: "Global",
          }))
        );
      });

    const unsub2 = firestore()
      .collection("class_notices")
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        if (!snap) return;
        setClassNotices(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            sourceType: "Class",
          }))
        );
      });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // --- MERGE & SORT ---
  useEffect(() => {
    const merged = [...globalNotices, ...classNotices];
    merged.sort((a, b) => {
      const tA = a.createdAt?.toDate
        ? a.createdAt.toDate()
        : new Date(a.createdAt || 0);
      const tB = b.createdAt?.toDate
        ? b.createdAt.toDate()
        : new Date(b.createdAt || 0);
      return tB - tA;
    });
    setCombinedNotices(merged);
    setLoading(false);
  }, [globalNotices, classNotices]);

  // --- FILTERING ---
  useEffect(() => {
    if (filter === "All") setFilteredNotices(combinedNotices);
    else
      setFilteredNotices(
        combinedNotices.filter((n) => n.sourceType === filter)
      );
  }, [filter, combinedNotices]);

  // --- RENDER ITEM ---
  const renderNotice = ({ item }) => {
    const isGlobal = item.sourceType === "Global";
    const detailContent =
      item.content ||
      item.message ||
      item.reason ||
      item.description ||
      "No content.";

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedNotice({ ...item, fullContent: detailContent });
          setShowModal(true);
        }}
        activeOpacity={0.8}
        className={`${theme.card} p-4 rounded-2xl mb-3 border ${theme.borderColor} shadow-sm`}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <View className="flex-row items-center mb-2">
              {isGlobal ? (
                <View className="bg-green-500/20 px-2 py-1 rounded-md mr-2">
                  <Text className="text-green-400 text-[10px] font-bold">
                    GLOBAL
                  </Text>
                </View>
              ) : (
                <View className="bg-blue-500/20 px-2 py-1 rounded-md mr-2">
                  <Text className="text-blue-400 text-[10px] font-bold">
                    CLASS
                  </Text>
                </View>
              )}
              <Text className="text-gray-400 text-xs">{item.date}</Text>
            </View>

            <Text
              className="text-white font-bold text-lg mb-1"
              numberOfLines={1}
            >
              {item.title || "Notice"}
            </Text>

            <Text className="text-gray-400 text-xs mb-2">
              By:{" "}
              <Text className="text-white">
                {isGlobal ? "Admin (You)" : item.teacherName || "Teacher"}
              </Text>
            </Text>

            {!isGlobal && (
              <Text className="text-[#f49b33] text-xs font-bold">
                Target: {item.classId} • {item.subject}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#4C5361" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      {/* --- HEADER --- */}
      <View className="px-5 py-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#333842] p-2 rounded-full border border-[#4C5361] mr-4"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Announcements</Text>
      </View>

      {/* --- FILTERS --- */}
      <View className="px-5 mb-4 flex-row">
        {["All", "Global", "Class"].map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => setFilter(opt)}
            className={`mr-3 px-5 py-2 rounded-xl border ${filter === opt ? "bg-[#f49b33] border-[#f49b33]" : "bg-[#333842] border-[#4C5361]"}`}
          >
            <Text
              className={`${filter === opt ? "text-[#282C34] font-bold" : "text-gray-400"}`}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* --- LIST --- */}
      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
      ) : (
        <FlatList
          data={filteredNotices}
          keyExtractor={(item) => item.id}
          renderItem={renderNotice}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="mt-20 items-center opacity-30">
              <MaterialCommunityIcons
                name="bell-off-outline"
                size={80}
                color="gray"
              />
              <Text className="text-white text-center mt-4">
                No announcements found.
              </Text>
            </View>
          }
        />
      )}

      {/* --- DETAILS MODAL --- */}
      <Modal visible={showModal} animationType="fade" transparent>
        <View className="flex-1 bg-black/80 justify-center items-center p-5">
          <View className="bg-[#333842] w-full max-h-[70%] rounded-2xl p-6 border border-[#f49b33]">
            {selectedNotice && (
              <>
                <View className="flex-row justify-between items-center mb-4 border-b border-[#4C5361] pb-4">
                  <Text className="text-[#f49b33] text-xl font-bold flex-1 mr-2">
                    {selectedNotice.title}
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Ionicons name="close-circle" size={28} color="white" />
                  </TouchableOpacity>
                </View>
                <ScrollView>
                  <Text className="text-white text-base leading-6">
                    {selectedNotice.fullContent}
                  </Text>
                  <View className="mt-6 pt-4 border-t border-[#4C5361]/50">
                    <Text className="text-gray-500 text-xs">
                      Posted on: {selectedNotice.date}
                    </Text>
                    <Text className="text-gray-500 text-xs">
                      Source: {selectedNotice.sourceType}
                    </Text>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AdminViewNotifications;
