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
import { useTheme } from "../../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig"; // Import instances
// --- REFACTOR END ---

dayjs.extend(relativeTime);

const StudentHomework = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [homework, setHomework] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");

  // --- FETCH HOMEWORK (MODULAR) ---
  const fetchHomework = async () => {
    try {
      // Modular: auth.currentUser
      const user = auth.currentUser;
      if (!user) return;

      // Modular: getDoc
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const studentClass = userDoc.data()?.standard || userDoc.data()?.class;

      if (!studentClass) {
        setLoading(false);
        return;
      }

      // Modular: query
      const q = query(
        collection(db, "homework"),
        where("classId", "==", studentClass),
        orderBy("createdAt", "desc")
      );

      // Modular: getDocs
      const snapshot = await getDocs(q);

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

    // Dynamic Strip Color based on Subject
    const getStripColor = (subj) => {
      if (subj === "Maths") return theme.info || "#29B6F6";
      if (subj === "Science") return theme.success || "#66BB6A";
      return theme.accent;
    };

    return (
      <View
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        }}
        className="w-[92%] self-center rounded-2xl mb-4 border shadow-sm overflow-hidden flex-row"
      >
        {/* 1. Left Color Strip */}
        <View
          style={{ backgroundColor: getStripColor(item.subject) }}
          className="w-1.5 h-full"
        />

        {/* 2. Main Content Area */}
        <View className="flex-1 p-4 flex-row items-center justify-between">
          {/* LEFT SIDE: Description & Info */}
          <View className="flex-1 mr-3">
            {/* Header: Subject & Date */}
            <View className="flex-row items-center mb-1">
              <View
                style={{
                  backgroundColor: theme.bgTertiary,
                  borderColor: theme.border,
                }}
                className="px-2 py-0.5 rounded mr-2 border"
              >
                <Text
                  style={{ color: theme.textMuted }}
                  className="text-[9px] font-bold uppercase tracking-wider"
                >
                  {item.subject}
                </Text>
              </View>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-[10px] font-medium"
              >
                {item.createdAt?.toDate
                  ? dayjs(item.createdAt.toDate()).fromNow()
                  : "Recently"}
              </Text>
            </View>

            {/* Title */}
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-base mb-1 leading-tight"
            >
              {item.title}
            </Text>

            {/* Description (Truncated) */}
            {item.description ? (
              <Text
                style={{ color: theme.textSecondary }}
                className="text-xs leading-relaxed mb-2"
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
              style={{
                backgroundColor: theme.bgPrimary,
                borderColor: theme.border,
              }}
              className="h-11 w-11 rounded-xl border items-center justify-center shadow-lg"
            >
              <Ionicons name="open-outline" size={20} color={theme.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View className="px-5 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-5">
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            }}
            className="w-9 h-9 rounded-full border items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{ color: theme.textPrimary }}
            className="text-xl font-bold"
          >
            Homework
          </Text>
          <View className="w-9" />
        </View>

        {/* Filter Pills */}
        <View className="mb-2">
          <FlatList
            horizontal
            data={uniqueSubjects}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedSubject(item)}
                style={{
                  backgroundColor:
                    selectedSubject === item ? theme.accent : theme.bgSecondary,
                  borderColor:
                    selectedSubject === item ? theme.accent : theme.border,
                }}
                className="mr-2 px-4 py-2 rounded-xl border"
              >
                <Text
                  style={{
                    color:
                      selectedSubject === item
                        ? theme.textDark
                        : theme.textSecondary,
                  }}
                  className="font-bold text-[11px]"
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
            tintColor={theme.accent}
            colors={[theme.accent]}
            progressBackgroundColor={theme.bgSecondary}
          />
        }
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-20">
            <View
              style={{
                backgroundColor: theme.bgSecondary,
                borderColor: theme.border,
              }}
              className="w-20 h-20 rounded-full items-center justify-center mb-4 border"
            >
              <MaterialCommunityIcons
                name="book-open-page-variant-outline"
                size={32}
                color={theme.accent}
              />
            </View>
            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-base"
            >
              No Assignments
            </Text>
            <Text
              style={{ color: theme.textSecondary }}
              className="text-xs mt-2 text-center px-10"
            >
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
