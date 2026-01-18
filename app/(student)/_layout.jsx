import React from "react";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomHeader from "../../components/CustomHeader";
import { useTheme } from "../../context/ThemeContext";

export default function StudentLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        header: ({ options, route }) => {
          // Fallback title logic (if no specific title is set below)
          const title =
            options.title ||
            route.name
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase());

          return (
            // 1. SafeAreaView gives the "Margin on Top" (Status Bar Space)
            <SafeAreaView
              edges={["top"]}
              style={{ backgroundColor: theme.bgPrimary }}
            >
              <CustomHeader title={title} showBack={true} />
            </SafeAreaView>
          );
        },
      }}
    >
      {/* --- DASHBOARD (No Header) --- */}
      <Stack.Screen name="studentdashboard" options={{ headerShown: false }} />
      <Stack.Screen name="videoplayer" options={{ headerShown: false }} />
      <Stack.Screen name="view_attachment" options={{ headerShown: false }} />

      {/* --- SCREENS WITH FIXED TITLES (Spaces Added) --- */}
      <Stack.Screen name="classnotes" options={{ title: "Class Notes" }} />
      <Stack.Screen name="homeworkscreen" options={{ title: "My Homework" }} />
      <Stack.Screen name="attendancescreen" options={{ title: "Attendance" }} />
      <Stack.Screen name="testscores" options={{ title: "Test Scores" }} />
      <Stack.Screen name="studentfees" options={{ title: "Fee Status" }} />
      <Stack.Screen name="submitleaves" options={{ title: "Apply Leave" }} />
      <Stack.Screen name="courses" options={{ title: "All Courses" }} />
    </Stack>
  );
}
