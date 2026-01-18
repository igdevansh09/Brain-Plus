import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useTheme } from "../../context/ThemeContext";
import ScreenWrapper from "../../components/ScreenWrapper"; // <--- IMPORTED

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "@react-native-firebase/firestore";
import { auth, db } from "../../config/firebaseConfig";

// Init dayjs plugin once
dayjs.extend(relativeTime);

const StudentNotes = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");

  const fetchNotes = useCallback(async () => {
    try {
      // 1. Robust Auth Check
      const user = auth.currentUser;
      if (!user) {
        console.warn("No user found. Auth might not be ready.");
        setLoading(false);
        return;
      }

      // 2. Fetch User Class
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.error("User document not found");
        setLoading(false);
        return;
      }

      const studentClass = userDoc.data()?.standard;

      if (!studentClass) {
        Alert.alert(
          "Profile Incomplete",
          "Please update your profile with your Class/Standard.",
        );
        setLoading(false);
        return;
      }

      // 3. Query with Index Awareness
      const q = query(
        collection(db, "materials"),
        where("classId", "==", studentClass),
        orderBy("createdAt", "desc"),
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setNotes(data);
    } catch (error) {
      console.error("Notes Fetch Error:", error);
      if (error.code === "failed-precondition") {
        console.error("FIREBASE INDEX MISSING: Check console link");
      }
      Alert.alert("Error", "Failed to load notes. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

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

  // --- OPTIMIZATION: Moved RenderItem to useCallback ---
  const renderNoteItem = useCallback(
    ({ item }) => {
      const displayAttachments =
        item.attachments ||
        (item.link
          ? [{ name: item.attachmentName, url: item.link, type: item.fileType }]
          : []);

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
                  {/* SAFE CHECK FOR TIMESTAMP */}
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
                    displayAttachments[0].type,
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
    },
    [theme, router],
  );

  if (loading) {
    return (
      <View
        style={{
          backgroundColor: theme.bgPrimary,
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    // FIX: Using ScreenWrapper with 'edges' prop to remove top padding space
    <ScreenWrapper scrollable={false} edges={["left", "right", "bottom"]}>
      {/* Subject Filter - Added pt-4 for spacing */}
      <View className="px-5 mb-4 pt-4">
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
                      ? theme.textDark || "#FFF"
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
    </ScreenWrapper>
  );
};

export default StudentNotes;
