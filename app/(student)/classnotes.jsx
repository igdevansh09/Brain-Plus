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
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

// NATIVE SDK
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const StudentNotes = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get dynamic theme values
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");

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

    // Dynamic Color Strip based on Subject
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
        {/* Left color strip */}
        <View
          style={{ backgroundColor: getStripColor(item.subject) }}
          className="w-1.5 h-full"
        />

        <View className="flex-1 p-4 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
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

            <Text
              style={{ color: theme.textPrimary }}
              className="font-bold text-base mb-1 leading-tight"
            >
              {item.title}
            </Text>

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
                borderColor: theme.accentSoft50 || theme.border,
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

  if (loading) {
    return (
      <SafeAreaView
        style={{ backgroundColor: theme.bgPrimary }}
        className="flex-1 items-center justify-center"
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bgPrimary }}>
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 pt-3">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="p-2 rounded-full border"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{ color: theme.textPrimary }}
          className="text-2xl font-bold"
        >
          Class Notes
        </Text>
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
              style={{
                backgroundColor:
                  selectedSubject === item ? theme.accent : theme.bgSecondary,
                borderColor:
                  selectedSubject === item ? theme.accent : theme.border,
              }}
              className="mr-3 px-5 py-2 rounded-full border"
            >
              <Text
                style={{
                  color:
                    selectedSubject === item
                      ? theme.textDark
                      : theme.textSecondary,
                }}
                className="font-bold text-xs"
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
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        ListEmptyComponent={() => (
          <View className="items-center py-20 opacity-30">
            <MaterialCommunityIcons
              name="folder-outline"
              size={80}
              color={theme.textMuted}
            />
            <Text
              style={{ color: theme.textMuted }}
              className="mt-4 text-center"
            >
              No study materials available.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default StudentNotes;
