import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  FlatList,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

// --- NATIVE SDK IMPORTS ---
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

const AttendanceCalendar = () => {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get dynamic theme values
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(dayjs());
  const [attendanceMap, setAttendanceMap] = useState({});
  const [fullData, setFullData] = useState([]);

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");

  const screenWidth = Dimensions.get("window").width;
  const padding = 32;
  const colWidth = (screenWidth - padding) / 7;

  // --- 1. FETCH DATA (NATIVE) ---
  const fetchAttendance = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      const userDoc = await firestore().collection("users").doc(user.uid).get();
      if (!userDoc.exists) return;

      const studentClass = userDoc.data().standard;
      if (!studentClass) {
        setLoading(false);
        return;
      }

      const querySnapshot = await firestore()
        .collection("attendance")
        .where("classId", "==", studentClass)
        .get();

      const rawData = [];
      const subjectsSet = new Set(["All"]);

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const myStatus = data.records?.[user.uid]; // Safety check
        if (myStatus) {
          rawData.push({
            date: data.date,
            subject: data.subject || "General",
            status: myStatus,
          });
          subjectsSet.add(data.subject || "General");
        }
      });

      setAvailableSubjects(Array.from(subjectsSet));
      setFullData(rawData);
    } catch (error) {
      console.log("Error loading attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  // --- 2. PROCESS DATA (MEMOIZED) ---
  const { stats, processedMap } = useMemo(() => {
    const newMap = {};
    let p = 0;
    let t = 0;

    fullData.forEach((item) => {
      if (selectedSubject === "All" || item.subject === selectedSubject) {
        // Handle date formats (DD-MM-YYYY -> YYYY-MM-DD) safely
        const parts = item.date.split("-");
        let formattedDate = item.date;
        if (parts.length === 3) {
          formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        if (!newMap[formattedDate]) {
          newMap[formattedDate] = item.status;
          if (item.status === "Present") p++;
          t++;
        }
      }
    });

    return { stats: { present: p, total: t }, processedMap: newMap };
  }, [selectedSubject, fullData]);

  // Update map only when processing changes
  useEffect(() => {
    setAttendanceMap(processedMap);
  }, [processedMap]);

  // --- 3. HELPERS ---
  const generateDays = useCallback(() => {
    const days = [];
    const startOfMonth = currentDate.startOf("month");
    const daysInMonth = currentDate.daysInMonth();
    const startDay = startOfMonth.day();

    for (let i = 0; i < startDay; i++) {
      days.push({ key: `empty-${i}`, type: "empty" });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = currentDate.date(i);
      const dateString = dateObj.format("YYYY-MM-DD");
      days.push({
        key: dateString,
        type: "day",
        val: i,
        fullDate: dateString,
        status: attendanceMap[dateString] || null,
      });
    }
    return days;
  }, [currentDate, attendanceMap]);

  const changeMonth = (dir) => {
    setCurrentDate(currentDate.add(dir, "month"));
  };

  const percentage = useMemo(() => {
    return stats.total > 0
      ? ((stats.present / stats.total) * 100).toFixed(0) + "%"
      : "0%";
  }, [stats]);

  // --- 4. RENDER ITEM ---
  const renderCalendarItem = useCallback(
    ({ item }) => {
      if (item.type === "empty") {
        return <View style={{ width: colWidth, height: 48 }} />;
      }

      let bg = "transparent";
      let textCol = theme.textPrimary;
      let borderCol = "transparent";
      let borderWidth = 0;

      if (item.status === "Present") {
        bg = theme.present; // Dynamic Present Color
        textCol = "#FFF";
      } else if (item.status === "Absent") {
        bg = theme.absent; // Dynamic Absent Color
        textCol = "#FFF";
      }

      if (item.fullDate === dayjs().format("YYYY-MM-DD")) {
        borderCol = theme.today; // Dynamic Today Border
        borderWidth = 2;
        if (!item.status) textCol = theme.today;
      }

      return (
        <View
          style={{
            width: colWidth,
            height: 48,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: bg,
              borderColor: borderCol,
              borderWidth: borderWidth,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: textCol,
                fontWeight: item.status ? "bold" : "normal",
                fontSize: 14,
              }}
            >
              {item.val}
            </Text>
          </View>
        </View>
      );
    },
    [colWidth, theme, attendanceMap]
  );

  if (loading) {
    return (
      <SafeAreaView
        style={{ backgroundColor: theme.bgPrimary }}
        className="flex-1 justify-center items-center"
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

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <Ionicons
          name="arrow-back"
          size={24}
          color={theme.textPrimary}
          onPress={() => router.back()}
        />
        <Text
          style={{ color: theme.textPrimary }}
          className="text-2xl font-semibold ml-4"
        >
          Attendance
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Subject Filter */}
        <View className="mb-6">
          <FlatList
            horizontal
            data={availableSubjects}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedSubject(item)}
                style={{
                  backgroundColor:
                    selectedSubject === item ? theme.accent : theme.bgSecondary,
                  borderColor: theme.border,
                  borderWidth: selectedSubject === item ? 0 : 1,
                }}
                className="px-5 py-2 rounded-full mr-3 justify-center"
              >
                <Text
                  style={{
                    color:
                      selectedSubject === item
                        ? theme.textDark
                        : theme.textPrimary,
                    fontWeight: "bold",
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Stats Card */}
        <View
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          }}
          className="p-5 rounded-2xl mb-6 border shadow-lg"
        >
          <View className="flex-row justify-between items-start">
            <View>
              <Text
                style={{ color: theme.textSecondary }}
                className="text-sm font-medium tracking-wider uppercase"
              >
                Attendance Rate
              </Text>
              <Text
                style={{ color: theme.accent }}
                className="text-5xl font-bold mt-1"
              >
                {percentage}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
              }}
              className="p-3 rounded-xl border"
            >
              <View className="flex-row items-center mb-1">
                <View
                  style={{ backgroundColor: theme.present }}
                  className="w-2 h-2 rounded-full mr-2"
                />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="font-bold text-sm"
                >
                  {stats.present} Present
                </Text>
              </View>
              <View className="flex-row items-center mb-1">
                <View
                  style={{ backgroundColor: theme.absent }}
                  className="w-2 h-2 rounded-full mr-2"
                />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="font-bold text-sm"
                >
                  {stats.total - stats.present} Absent
                </Text>
              </View>
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: theme.textMuted }}
                  className="w-2 h-2 rounded-full mr-2"
                />
                <Text
                  style={{ color: theme.textPrimary }}
                  className="font-bold text-sm"
                >
                  {stats.total} Total Classes
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{ backgroundColor: theme.bgTertiary }}
            className="mt-4 h-2 rounded-full overflow-hidden w-full"
          >
            <View
              style={{
                width: percentage,
                height: "100%",
                backgroundColor: theme.accent,
              }}
            />
          </View>
        </View>

        {/* Calendar View */}
        <View
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.border,
          }}
          className="rounded-2xl border overflow-hidden pb-4 shadow-sm"
        >
          <View
            style={{
              borderColor: theme.border,
              backgroundColor: theme.bgTertiary,
            }}
            className="flex-row justify-between items-center p-4 border-b mb-2"
          >
            <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2">
              <Ionicons name="chevron-back" size={24} color={theme.accent} />
            </TouchableOpacity>
            <Text
              style={{ color: theme.textPrimary }}
              className="text-lg font-bold tracking-wide"
            >
              {currentDate.format("MMMM YYYY")}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)} className="p-2">
              <Ionicons name="chevron-forward" size={24} color={theme.accent} />
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-around mb-2 px-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <Text
                key={i}
                style={{
                  width: colWidth,
                  textAlign: "center",
                  color: theme.textSecondary,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {d}
              </Text>
            ))}
          </View>

          <FlatList
            data={generateDays()}
            numColumns={7}
            keyExtractor={(item) => item.key}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 4 }}
            renderItem={renderCalendarItem}
          />
        </View>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AttendanceCalendar;
