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

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  where,
  limit,
} from "@react-native-firebase/firestore";
import { db } from "../../config/firebaseConfig"; // Import instance
// --- REFACTOR END ---

import { useTheme } from "../../context/ThemeContext";

const AdminViewNotifications = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
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

  // --- 1. FETCH DATA (MODULAR) ---
  useEffect(() => {
    setLoading(true);

    // Listener 1: Global Notices
    const qGlobal = query(
      collection(db, "notices"),
      orderBy("createdAt", "desc")
    );
    const unsubGlobal = onSnapshot(qGlobal, (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        sourceType: "Global",
        author: doc.data().author || "Admin",
      }));
      setGlobalNotices(list);
    });

    // Listener 2: Class Notices
    const qClass = query(
      collection(db, "class_notices"),
      orderBy("createdAt", "desc")
    );
    const unsubClass = onSnapshot(qClass, (snap) => {
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

  // --- 2. COMBINE & FILTER (MODULAR) ---
  useEffect(() => {
    const combineAndEnrich = async () => {
      let all = [...globalNotices, ...classNotices];

      if (all.length > 0) {
        const enriched = await Promise.all(
          all.map(async (item) => {
            try {
              if (item.authorImage) return item;

              // Global notices without teacherId -> admin author
              if (item.sourceType === "Global" && !item.teacherId) {
                // Modular: query with limit
                const qAdmin = query(
                  collection(db, "users"),
                  where("role", "==", "admin"),
                  limit(1)
                );
                const adminSnap = await getDocs(qAdmin);

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

              // For class/teacher notices, resolve teacherId
              const authorId = item.teacherId || item.authorId || null;
              if (authorId) {
                // Modular: getDoc
                const userDocRef = doc(db, "users", authorId);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
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

  // --- RENDER CARD ---
  const renderItem = ({ item }) => {
    const isGlobal = item.sourceType === "Global";
    const targetText = isGlobal
      ? "All Students"
      : `${item.classId} • ${item.subject || "General"}`;

    return (
      <TouchableOpacity
        onPress={() => handlePress(item)}
        activeOpacity={0.8}
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        }}
        className="rounded-lg p-4 mb-3 border shadow-sm"
      >
        <View className="flex-row justify-between items-start mb-1">
          <View className="flex-row items-start flex-1 mr-2">
            {/* Avatar / Icon */}
            <View
              style={{
                backgroundColor: theme.accentSoft20,
                borderColor: theme.accentSoft30,
              }}
              className="w-10 h-10 rounded-full overflow-hidden mr-3 items-center justify-center border"
            >
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
                <Text
                  style={{ color: theme.accent }}
                  className="font-bold text-lg"
                >
                  {item.author ? item.author.charAt(0).toUpperCase() : "T"}
                </Text>
              )}
            </View>

            {/* Content */}
            <View className="flex-1">
              <Text
                style={{ color: theme.textPrimary }}
                className="text-base font-semibold"
                numberOfLines={1}
              >
                {item.title || "Notice"}
              </Text>

              <View className="flex-row mt-1 flex-wrap items-center">
                <Text
                  className="text-xs font-bold mr-2"
                  style={{
                    color: isGlobal ? theme.successBright : theme.infoBright,
                  }}
                >
                  {isGlobal ? "Global Notice" : "Class Notice"}
                </Text>
                <Text
                  style={{ color: theme.textSecondary }}
                  className="text-xs mr-2"
                >
                  By: {item.author}
                </Text>
              </View>

              {!isGlobal && (
                <Text
                  style={{ color: theme.accent }}
                  className="text-xs font-bold mt-1"
                >
                  {targetText}
                </Text>
              )}
            </View>
          </View>

          {/* Date */}
          <Text style={{ color: theme.textMuted }} className="text-xs">
            {item.date}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* HEADER */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="p-2 rounded-full border mr-4"
          >
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{ color: theme.textPrimary }}
            className="text-xl font-bold"
          >
            Notifications Log
          </Text>
        </View>
      </View>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.accent}
          className="mt-10"
        />
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
                color={theme.textMuted}
              />
              <Text style={{ color: theme.textMuted }} className="mt-4">
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
        <View
          style={{ backgroundColor: theme.blackSoft80 }}
          className="flex-1 justify-center items-center p-5"
        >
          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="w-full max-h-[70%] rounded-2xl p-6 border"
          >
            {selectedNotice && (
              <>
                <View
                  style={{ borderColor: theme.border }}
                  className="flex-row justify-between items-center mb-4 border-b pb-4"
                >
                  <Text
                    style={{ color: theme.accent }}
                    className="text-xl font-bold flex-1 mr-2"
                  >
                    {selectedNotice.title}
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Ionicons
                      name="close-circle"
                      size={28}
                      color={theme.textPrimary}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView>
                  <Text
                    style={{ color: theme.textPrimary }}
                    className="text-base leading-6"
                  >
                    {selectedNotice.content ||
                      selectedNotice.message ||
                      "No content."}
                  </Text>

                  <View
                    style={{ borderColor: theme.borderSoft }}
                    className="mt-6 pt-4 border-t"
                  >
                    <View className="flex-row justify-between mb-2">
                      <Text
                        style={{ color: theme.textSecondary }}
                        className="text-xs"
                      >
                        Posted on:
                      </Text>
                      <Text
                        style={{ color: theme.textMuted }}
                        className="text-xs font-bold"
                      >
                        {selectedNotice.date}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text
                        style={{ color: theme.textSecondary }}
                        className="text-xs"
                      >
                        Type:
                      </Text>
                      <Text
                        className="text-xs font-bold"
                        style={{
                          color:
                            selectedNotice.sourceType === "Global"
                              ? theme.successBright
                              : theme.infoBright,
                        }}
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