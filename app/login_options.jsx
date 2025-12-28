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
import logo from "../assets/images/dinetimelogo.png";
const entryImg = require("../assets/images/Frame.png");

export default function Index() {
  const router = useRouter();
  return (
    <SafeAreaView className={`bg-[#282C34]`}>
      <ScrollView contentContainerStyle={{ height: "100%" }}>
        <View className="m-2 flex justify-center items-center">
          <Image source={logo} style={{ width: 300, height: 300 }} />
          <View className="w-3/4">
            <TouchableOpacity
              onPress={() => router.push("/(auth)/studentsignin")}
              className="p-4 mb-4 bg-[#333842] border border-[#f49b33] rounded-xl flex-row items-center"
            >
              <Ionicons name="school-outline" size={24} color="#f49b33" />
              <Text className="text-white text-lg font-semibold ml-4">
                Student
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/teachersignin")}
              className="p-4 mb-4 bg-[#333842] border border-[#f49b33] rounded-xl flex-row items-center"
            >
              <Ionicons name="briefcase-outline" size={24} color="#f49b33" />
              <Text className="text-white text-lg font-semibold ml-4">
                Teacher
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/adminsignin")}
              className="p-4 mb-4 bg-[#333842] border border-[#f49b33] rounded-xl flex-row items-center"
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color="#f49b33"
              />
              <Text className="text-white text-lg font-semibold ml-4">
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
        <StatusBar barStyle={"light-content"} backgroundColor={"#282C34"} />
      </ScrollView>
    </SafeAreaView>
  );
}
