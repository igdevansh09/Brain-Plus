import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "../../config/firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const StudentCourses = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState(null);
  const [courses, setCourses] = useState([]);

  const [selectedFilter, setSelectedFilter] = useState("All");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setMyProfile(data);

            const { standard, enrolledSubjects } = data;
            let validTargets = [];

            if (standard) {
              if (standard === "CS") {
                validTargets = ["CS"];
              } else if (
                enrolledSubjects &&
                enrolledSubjects.includes("All Subjects")
              ) {
                validTargets = [standard];
              } else if (enrolledSubjects && enrolledSubjects.length > 0) {
                validTargets = enrolledSubjects.map(
                  (subj) => `${standard} ${subj}`
                );
              }

              if (validTargets.length > 0) {
                const q = query(
                  collection(db, "courses"),
                  where("target", "in", validTargets)
                );
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                }));
                setCourses(list);
              }
            }
          }
        }
      } catch (error) {
        console.log("Error fetching courses:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleWatch = (item) => {
    router.push({
      pathname: "/(student)/videoplayer",
      params: {
        courseTitle: item.title,
        playlist: JSON.stringify(item.playlist),
        description: item.description,
      },
    });
  };

  const getFilteredCourses = () => {
    if (selectedFilter === "All") return courses;
    return courses.filter((c) => c.target.includes(selectedFilter));
  };

  const showSubjectFilters =
    myProfile?.enrolledSubjects &&
    !myProfile.enrolledSubjects.includes("All Subjects") &&
    !myProfile.enrolledSubjects.includes("N/A");

  const renderCourse = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => handleWatch(item)}
      className="bg-[#333842] rounded-xl p-4 mb-4 border border-[#4C5361] flex-row items-center"
    >
      <View className="mr-4">
        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={{ width: 60, height: 60, borderRadius: 8 }}
          />
        ) : (
          <View className="w-12 h-12 rounded-full bg-[#f49b33]/20 items-center justify-center">
            <Ionicons name="play" size={24} color="#f49b33" />
          </View>
        )}
      </View>

      <View className="flex-1">
        <Text className="text-white text-lg font-bold">{item.title}</Text>
        <Text className="text-gray-400 text-sm" numberOfLines={1}>
          {item.target} • {item.description}
        </Text>
        <Text className="text-[#f49b33] text-xs mt-1">
          Tap to Start Learning
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#282C34] justify-center items-center">
        <ActivityIndicator size="large" color="#f49b33" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#282C34] pt-8">
      <StatusBar backgroundColor="#282C34" barStyle="light-content" />

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <Ionicons
          name="arrow-back"
          size={24}
          color="white"
          onPress={() => router.back()}
        />
        <Text className="text-white text-2xl font-semibold ml-4">
          My Courses
        </Text>
      </View>

      {showSubjectFilters ? (
        <View className="mb-4 pl-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setSelectedFilter("All")}
              className={`mr-2 px-4 py-1.5 rounded-full border ${
                selectedFilter === "All"
                  ? "bg-[#f49b33] border-[#f49b33]"
                  : "border-[#4C5361] bg-[#333842]"
              }`}
            >
              <Text
                className={`${
                  selectedFilter === "All" ? "text-[#282C34]" : "text-white"
                } font-bold`}
              >
                All
              </Text>
            </TouchableOpacity>

            {myProfile.enrolledSubjects.map((subj, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedFilter(subj)}
                className={`mr-2 px-4 py-1.5 rounded-full border ${
                  selectedFilter === subj
                    ? "bg-[#f49b33] border-[#f49b33]"
                    : "border-[#4C5361] bg-[#333842]"
                }`}
              >
                <Text
                  className={`${
                    selectedFilter === subj ? "text-[#282C34]" : "text-white"
                  } font-bold`}
                >
                  {subj}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View className="px-4 mb-4">
          <Text className="text-gray-400">
            Class:{" "}
            <Text className="text-[#f49b33] font-bold">
              {myProfile?.standard || "N/A"}
            </Text>
          </Text>
        </View>
      )}

      <FlatList
        data={getFilteredCourses()}
        keyExtractor={(item) => item.id}
        renderItem={renderCourse}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View className="mt-10 items-center px-6">
            <Ionicons name="library-outline" size={50} color="#666" />
            <Text className="text-gray-500 text-center mt-4 text-lg font-semibold">
              No courses found.
            </Text>
            <Text className="text-gray-600 text-center mt-2 text-sm">
              Current Filter: {selectedFilter}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default StudentCourses;
