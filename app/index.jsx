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
              onPress={() => router.push("/login_options")}
              className="p-2 py-4 my-2 bg-[#f49b33] text-black rounded-lg "
            >
              <Text className="text-lg font-semibold text-center">Sign in</Text>
            </TouchableOpacity>

            <View className="flex-row items-center my-4">
              <View className="flex-1 h-px bg-[#f49b33]" />
              <Text className="mx-4 font-semibold text-white">or</Text>
              <View className="flex-1 h-px bg-[#f49b33]" />
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(guest)/guest_dashboard")}
              className="p-2 my-2 py-4 bg-[#282C34] border border-[#f49b33] rounded-lg max-w-fit "
            >
              <Text className="text-lg font-semibold text-[#f49b33] text-center">
                Guest User
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