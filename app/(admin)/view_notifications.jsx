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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";

const theme = {
  bg: "bg-[#282C34]",
  card: "bg-[#333842]",
  accent: "text-[#f49b33]",
  text: "text-white",
  subText: "text-gray-400",
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

  // --- 1. FETCH DATA ---
  useEffect(() => {
    setLoading(true);

    // Listener 1: Global Notices
    const unsubGlobal = firestore()
      .collection("notices")
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          sourceType: "Global",
          author: doc.data().author || "Admin",
        }));
        setGlobalNotices(list);
      });

    // Listener 2: Class Notices
    const unsubClass = firestore()
      .collection("class_notices")
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          sourceType: "Class",
          author: doc.data().teacherName || "Teacher",
        }));
        setClassNotices(list);
      });

    return () => {
      unsubGlobal();
      unsubClass();
    };
  }, []);

  // --- 2. COMBINE & FILTER ---
  useEffect(() => {
    const combineAndEnrich = async () => {
      let all = [...globalNotices, ...classNotices];

      // Enrich each notice with authorImage when possible
      if (all.length > 0) {
        const enriched = await Promise.all(
          all.map(async (item) => {
            try {
              // If notice already has an authorImage stored, use it
              if (item.authorImage) return item;

              // Global notices without teacherId -> admin author
              if (item.sourceType === "Global" && !item.teacherId) {
                const adminSnap = await firestore()
                  .collection("users")
                  .where("role", "==", "admin")
                  .limit(1)
                  .get();

                if (!adminSnap.empty) {
                  const adminData = adminSnap.docs[0].data();
                  return {
                    ...item,
                    author: adminData.name || item.author || "Admin",
                    authorImage: adminData.profileImage || null,
                  };
                }
                return { ...item, authorImage: null };
              }

              // For class/teacher notices, try to resolve teacherId or authorId
              const authorId = item.teacherId || item.authorId || null;
              if (authorId) {
                const userDoc = await firestore()
                  .collection("users")
                  .doc(authorId)
                  .get();
                if (userDoc.exists) {
                  const u = userDoc.data();
                  return {
                    ...item,
                    author: u.name || item.author,
                    authorImage: u.profileImage || null,
                  };
                }
              }
            } catch (e) {
              console.log("Failed to enrich notice with author image", e);
            }
            return { ...item, authorImage: null };
          })
        );

        all = enriched;
      }

      // Sort by Date (Newest First)
      all.sort((a, b) => {
        const dateA = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.date || 0);
        const dateB = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.date || 0);
        return dateB - dateA;
      });

      setCombinedNotices(all);
    };

    combineAndEnrich();
  }, [globalNotices, classNotices]);

  useEffect(() => {
    if (filter === "All") {
      setFilteredNotices(combinedNotices);
    } else {
      setFilteredNotices(
        combinedNotices.filter((n) => n.sourceType === filter)
      );
    }
    setLoading(false);
  }, [filter, combinedNotices]);

  const handlePress = (item) => {
    setSelectedNotice(item);
    setShowModal(true);
  };

  // --- RENDER CARD (Matches Student Dashboard) ---
  const renderItem = ({ item }) => {
    const isGlobal = item.sourceType === "Global";
    const targetText = isGlobal
      ? "All Students"
      : `${item.classId} • ${item.subject || "General"}`;

    return (
      <TouchableOpacity
        onPress={() => handlePress(item)}
        activeOpacity={0.8}
        className={`${theme.card} rounded-lg p-4 mb-3 border ${theme.borderColor}`}
      >
        <View className="flex-row justify-between items-start mb-1">
          <View className="flex-row items-start flex-1 mr-2">
            {/* Avatar / Icon */}
            <View className="w-10 h-10 rounded-full overflow-hidden mr-3 items-center justify-center bg-[#444] border border-[#f49b33]/30">
              {item.authorImage ? (
                <Image
                  source={{ uri: item.authorImage }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : item.author === "Admin" ? (
                <Image
                  source={require("../../assets/images/icon.png")}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-white font-bold text-lg">
                  {item.author ? item.author.charAt(0).toUpperCase() : "T"}
                </Text>
              )}
            </View>

            {/* Content */}
            <View className="flex-1">
              <Text
                className={`${theme.text} text-base font-semibold`}
                numberOfLines={1}
              >
                {item.title || "Notice"}
              </Text>

              <View className="flex-row mt-1 flex-wrap items-center">
                <Text
                  className="text-xs font-bold mr-2"
                  style={{ color: isGlobal ? "#4CAF50" : "#29B6F6" }}
                >
                  {isGlobal ? "Global Notice" : "Class Notice"}
                </Text>
                <Text className="text-xs text-gray-400 mr-2">
                  By: {item.author}
                </Text>
              </View>

              {!isGlobal && (
                <Text className="text-xs text-[#f49b33] font-bold mt-1">
                  {targetText}
                </Text>
              )}
            </View>
          </View>

          {/* Date */}
          <Text className={`${theme.subText} text-xs`}>{item.date}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${theme.bg}`}>
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      {/* HEADER */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`${theme.card} p-2 rounded-full border ${theme.borderColor} mr-4`}
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">
            Notifications Log
          </Text>
        </View>
      </View>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator size="large" color="#f49b33" className="mt-10" />
      ) : (
        <FlatList
          data={filteredNotices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          ListEmptyComponent={
            <View className="mt-20 items-center opacity-50">
              <MaterialCommunityIcons
                name="bell-sleep-outline"
                size={60}
                color="gray"
              />
              <Text className="text-gray-400 mt-4">
                No notifications found.
              </Text>
            </View>
          }
        />
      )}

      {/* DETAIL MODAL */}
      <Modal
        visible={showModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-black/80 justify-center items-center p-5">
          <View
            className={`${theme.card} w-full max-h-[70%] rounded-2xl p-6 border ${theme.borderColor}`}
          >
            {selectedNotice && (
              <>
                <View
                  className={`flex-row justify-between items-center mb-4 border-b ${theme.borderColor} pb-4`}
                >
                  <Text
                    className={`${theme.accent} text-xl font-bold flex-1 mr-2`}
                  >
                    {selectedNotice.title}
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Ionicons name="close-circle" size={28} color="white" />
                  </TouchableOpacity>
                </View>

                <ScrollView>
                  <Text className="text-white text-base leading-6">
                    {selectedNotice.content ||
                      selectedNotice.message ||
                      "No content."}
                  </Text>

                  <View
                    className={`mt-6 pt-4 border-t ${theme.borderColor}/50`}
                  >
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-gray-500 text-xs">Posted on:</Text>
                      <Text className="text-gray-300 text-xs font-bold">
                        {selectedNotice.date}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-gray-500 text-xs">Type:</Text>
                      <Text
                        className={`text-xs font-bold ${selectedNotice.sourceType === "Global" ? "text-green-400" : "text-blue-400"}`}
                      >
                        {selectedNotice.sourceType} Notice
                      </Text>
                    </View>
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
