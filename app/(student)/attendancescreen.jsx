import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  FlatList,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import { auth, db } from "../../config/firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const AttendanceCalendar = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(dayjs());

  const [attendanceMap, setAttendanceMap] = useState({});
  const [stats, setStats] = useState({ present: 0, total: 0 });

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [fullData, setFullData] = useState([]);

  const screenWidth = Dimensions.get("window").width;
  const padding = 32; 
  const colWidth = (screenWidth - padding) / 7;

  const colors = {
    bg: "#282C34",
    card: "#333842",
    accent: "#f49b33",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    present: "#4CAF50",
    absent: "#F44336",
    today: "#29B6F6",
    border: "#4C5361",
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  useEffect(() => {
    processDataForSubject();
  }, [selectedSubject, fullData]);

  const fetchAttendance = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) return;
      const studentClass = userDoc.data().standard;

      if (!studentClass) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "attendance"),
        where("classId", "==", studentClass)
      );

      const querySnapshot = await getDocs(q);
      const rawData = [];
      const subjectsSet = new Set(["All"]);

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const myStatus = data.records[user.uid];
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

  const processDataForSubject = () => {
    const newMap = {};
    let p = 0;
    let t = 0;

    fullData.forEach((item) => {
      if (selectedSubject === "All" || item.subject === selectedSubject) {
        const [d, m, y] = item.date.split("-");
        const formattedDate = `${y}-${m}-${d}`;

        if (!newMap[formattedDate]) {
          newMap[formattedDate] = item.status;
          if (item.status === "Present") p++;
          t++;
        }
      }
    });

    setAttendanceMap(newMap);
    setStats({ present: p, total: t });
  };

  const generateDays = () => {
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
  };

  const changeMonth = (dir) => {
    setCurrentDate(currentDate.add(dir, "month"));
  };

  const percentage =
    stats.total > 0
      ? ((stats.present / stats.total) * 100).toFixed(0) + "%"
      : "0%";

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${colors.bg} justify-center items-center`}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      className="pt-8"
    >
      <StatusBar backgroundColor={colors.bg} barStyle="light-content" />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <Ionicons
          name="arrow-back"
          size={24}
          color={colors.text}
          onPress={() => router.back()}
        />
        <Text
          style={{ color: colors.text }}
          className="text-2xl font-semibold ml-4"
        >
          Attendance
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
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
                    selectedSubject === item ? colors.accent : colors.card,
                  borderColor: colors.border,
                  borderWidth: selectedSubject === item ? 0 : 1,
                }}
                className="px-5 py-2 rounded-full mr-3 justify-center"
              >
                <Text
                  style={{
                    color: selectedSubject === item ? colors.bg : colors.text,
                    fontWeight: "bold",
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View
          style={{ backgroundColor: colors.card }}
          className="p-5 rounded-2xl mb-6 border border-[#4C5361] shadow-lg"
        >
          <View className="flex-row justify-between items-start">
            <View>
              <Text
                style={{ color: colors.subText }}
                className="text-sm font-medium tracking-wider uppercase"
              >
                Attendance Rate
              </Text>
              <Text
                style={{ color: colors.accent }}
                className="text-5xl font-bold mt-1"
              >
                {percentage}
              </Text>
            </View>

            <View className="bg-[#282C34] p-3 rounded-xl border border-[#4C5361]">
              <View className="flex-row items-center mb-1">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.present,
                    marginRight: 6,
                  }}
                />
                <Text
                  style={{ color: colors.text }}
                  className="font-bold text-sm"
                >
                  {stats.present} Present
                </Text>
              </View>
              <View className="flex-row items-center mb-1">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.absent,
                    marginRight: 6,
                  }}
                />
                <Text
                  style={{ color: colors.text }}
                  className="font-bold text-sm"
                >
                  {stats.total - stats.present} Absent
                </Text>
              </View>
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.subText,
                    marginRight: 6,
                  }}
                />
                <Text
                  style={{ color: colors.text }}
                  className="font-bold text-sm"
                >
                  {stats.total} Total Classes
                </Text>
              </View>
            </View>
          </View>
          <View className="mt-4 bg-[#282C34] h-2 rounded-full overflow-hidden w-full">
            <View
              style={{
                width: percentage,
                height: "100%",
                backgroundColor: colors.accent,
              }}
            />
          </View>
        </View>

        <View
          style={{ backgroundColor: colors.card }}
          className="rounded-2xl border border-[#4C5361] overflow-hidden pb-4 shadow-sm"
        >
          <View className="flex-row justify-between items-center p-4 border-b border-[#4C5361] mb-2 bg-[#3a404b]">
            <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2">
              <Ionicons name="chevron-back" size={24} color={colors.accent} />
            </TouchableOpacity>
            <Text
              style={{ color: colors.text }}
              className="text-lg font-bold tracking-wide"
            >
              {currentDate.format("MMMM YYYY")}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)} className="p-2">
              <Ionicons
                name="chevron-forward"
                size={24}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-around mb-2 px-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <Text
                key={i}
                style={{
                  width: colWidth,
                  textAlign: "center",
                  color: colors.subText,
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
            renderItem={({ item }) => {
              if (item.type === "empty") {
                return <View style={{ width: colWidth, height: 48 }} />;
              }

              let bg = "transparent";
              let textCol = colors.text;
              let borderCol = "transparent";
              let borderWidth = 0;

              if (item.status === "Present") {
                bg = colors.present;
                textCol = "#FFF";
              } else if (item.status === "Absent") {
                bg = colors.absent;
                textCol = "#FFF";
              }

              if (item.fullDate === dayjs().format("YYYY-MM-DD")) {
                borderCol = colors.today;
                borderWidth = 2;
                if (!item.status) textCol = colors.today;
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
            }}
          />
        </View>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default AttendanceCalendar;
