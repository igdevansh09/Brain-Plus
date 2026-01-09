import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext"; // Import hook
import logo from "../assets/images/dinetimelogo.png";
const entryImg = require("../assets/images/Frame.png");

export default function LoginOptions() {
  const router = useRouter();
  const { theme, isDark } = useTheme(); // Get theme values

  return (
    <SafeAreaView style={{ backgroundColor: theme.bgPrimary, flex: 1 }}>
      <ScrollView contentContainerStyle={{ height: "100%" }}>
        <View className="m-2 flex justify-center items-center">
          <Image source={logo} style={{ width: 300, height: 300 }} />
          <View className="w-3/4">
            {/* Student Button */}
            <TouchableOpacity
              onPress={() => router.push("/(auth)/studentsignin")}
              style={{
                backgroundColor: theme.bgSecondary,
                borderColor: theme.accent,
              }}
              className="p-4 mb-4 border rounded-xl flex-row items-center"
            >
              <Ionicons name="school-outline" size={24} color={theme.accent} />
              <Text
                style={{ color: theme.textPrimary }}
                className="text-lg font-semibold ml-4"
              >
                Student
              </Text>
            </TouchableOpacity>

            {/* Teacher Button */}
            <TouchableOpacity
              onPress={() => router.push("/(auth)/teachersignin")}
              style={{
                backgroundColor: theme.bgSecondary,
                borderColor: theme.accent,
              }}
              className="p-4 mb-4 border rounded-xl flex-row items-center"
            >
              <Ionicons
                name="briefcase-outline"
                size={24}
                color={theme.accent}
              />
              <Text
                style={{ color: theme.textPrimary }}
                className="text-lg font-semibold ml-4"
              >
                Teacher
              </Text>
            </TouchableOpacity>

            {/* Admin Button */}
            <TouchableOpacity
              onPress={() => router.push("/(auth)/adminsignin")}
              style={{
                backgroundColor: theme.bgSecondary,
                borderColor: theme.accent,
              }}
              className="p-4 mb-4 border rounded-xl flex-row items-center"
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color={theme.accent}
              />
              <Text
                style={{ color: theme.textPrimary }}
                className="text-lg font-semibold ml-4"
              >
                Admin
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View className="flex-1">
          <Image
            source={entryImg}
            className="w-full h-full"
            resizeMode="contain"
          />
        </View>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={theme.bgPrimary}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
