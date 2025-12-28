import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// NATIVE SDK
import firestore from "@react-native-firebase/firestore";

const LeaveCard = ({ item }) => {
  const [teacherData, setTeacherData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  const colors = {
    card: "#333842",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    accent: "#f49b33",
    info: "#29B6F6",
  };

  useEffect(() => {
    const fetchTeacherProfile = async () => {
      try {
        if (item.teacherId) {
          const userDoc = await firestore()
            .collection("users")
            .doc(item.teacherId)
            .get();
          if (userDoc.exists) {
            setTeacherData(userDoc.data());
          }
        }
      } catch (error) {
        console.log("Error fetching teacher:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchTeacherProfile();
  }, [item.teacherId]);

  const handleCall = () => {
    if (teacherData?.phone) {
      Linking.openURL(`tel:${teacherData.phone}`);
    } else {
      Alert.alert("Info", "No phone number available.");
    }
  };

  return (
    <View
      style={{ backgroundColor: colors.card }}
      className="p-4 rounded-xl mb-4 border border-[#4C5361]"
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-[#f49b33]/20 items-center justify-center mr-3">
            <Text className="text-[#f49b33] font-bold text-lg">
              {item.teacherName?.charAt(0) || "T"}
            </Text>
          </View>
          <View>
            <Text
              style={{ color: colors.text, fontWeight: "bold", fontSize: 16 }}
            >
              {item.teacherName}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleCall(item.phone)}
          className="p-2 bg-blue-500/20 rounded-lg mr-2 border border-blue-500"
        >
          <Ionicons name="call" size={20} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {loadingData ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={{ alignSelf: "flex-start", marginVertical: 5 }}
        />
      ) : teacherData ? (
        <View className="mb-3 pb-3 border-b border-[#4C5361]">
          <Text style={{ color: colors.subText, fontSize: 12 }}>
            <Text style={{ fontWeight: "bold", color: "#FFF" }}>Classes: </Text>
            {teacherData.classesTaught?.join(", ") || "N/A"}
          </Text>
          <Text style={{ color: colors.subText, fontSize: 12 }}>
            <Text style={{ fontWeight: "bold", color: "#FFF" }}>
              Subjects:{" "}
            </Text>
            {teacherData.subjects?.join(", ") || "N/A"}
          </Text>
        </View>
      ) : null}

      <View className="ml-1">
        <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 4 }}>
          Absence Period:{" "}
          <Text style={{ color: colors.info, fontWeight: "bold" }}>
            {item.startDate} ➔ {item.endDate}
          </Text>
        </Text>
        <View className="bg-black/20 p-2 rounded-lg mt-1">
          <Text
            style={{ color: colors.text, fontStyle: "italic", fontSize: 13 }}
          >
            {item.reason}
          </Text>
        </View>
      </View>
    </View>
  );
};

const AdminTeacherLeaves = () => {
  const router = useRouter();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const colors = { bg: "#282C34", accent: "#f49b33", subText: "#BBBBBB" };

  useEffect(() => {
    const unsubscribe = firestore()
      .collection("teacher_leaves")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLeaves(list);
        setLoading(false);
      });
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      className="pt-2"
    >
      <StatusBar backgroundColor={colors.bg} barStyle="light-content" />

      <View className="px-4 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold ml-4">
          Teacher Absence Log
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.accent}
          className="mt-10"
        />
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LeaveCard item={item} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text
              style={{
                color: colors.subText,
                textAlign: "center",
                marginTop: 20,
              }}
            >
              No absence notifications.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AdminTeacherLeaves;
