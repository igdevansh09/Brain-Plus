import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../../config/firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

const TeacherLeaveViewer = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [myClass, setMyClass] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);

  const colors = {
    BG: "#282C34",
    CARD: "#333842",
    ACCENT: "#f49b33",
    TEXT: "#FFFFFF",
    SUB_TEXT: "#BBBBBB",
    INFO: "#29B6F6", 
  };

  const fetchRequests = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      let currentClass = myClass;
      if (!currentClass) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const classes = userDoc.data().classesTaught || [];
          if (classes.length > 0) {
            currentClass = classes[0];
            setMyClass(currentClass);
          }
        }
      }

      if (currentClass) {
        const q = query(
          collection(db, "leaves"),
          where("classId", "==", currentClass)
        );

        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setLeaveRequests(list);
      }
    } catch (error) {
      console.log("Error fetching leaves:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, [myClass]);

  const renderLeaveCard = ({ item }) => (
    <View
      style={{ backgroundColor: colors.CARD, borderLeftColor: colors.INFO }}
      className="p-4 rounded-xl mb-3 border-l-4"
    >
      <View className="flex-row justify-between items-center mb-2">
        <Text style={{ color: colors.TEXT }} className="text-lg font-bold">
          {item.studentName}
        </Text>
        <Text style={{ color: colors.SUB_TEXT, fontSize: 10 }}>
          {item.startDate}
        </Text>
      </View>

      <Text style={{ color: colors.SUB_TEXT }} className="text-xs mb-1">
        From: {item.startDate} To: {item.endDate}
      </Text>
      <View
        style={{
          marginTop: 4,
          paddingTop: 4,
          borderTopWidth: 1,
          borderTopColor: "#4C5361",
        }}
      >
        <Text
          style={{ color: colors.SUB_TEXT }}
          className="text-lg font-semibold italic "
        >
          {item.reason}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        className={`flex-1 ${colors.BG} justify-center items-center`}
      >
        <ActivityIndicator size="large" color={colors.ACCENT} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.BG }}
      className="pt-8"
    >
      <StatusBar backgroundColor={colors.BG} barStyle="light-content" />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <Ionicons
          name="arrow-back"
          size={24}
          color={colors.TEXT}
          onPress={() => router.back()}
        />
        <Text
          style={{ color: colors.TEXT }}
          className="text-2xl font-semibold ml-4"
        >
          Absence Notifications
        </Text>
      </View>

      <FlatList
        data={leaveRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderLeaveCard}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.ACCENT}
          />
        }
        ListEmptyComponent={() => (
          <View className="mt-10 items-center">
            <Text style={{ color: colors.SUB_TEXT }}>
              No notifications for Class {myClass}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default TeacherLeaveViewer;
