import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
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
import CustomToast from "../../components/CustomToast";

const TeacherMyStudents = () => {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [myClasses, setMyClasses] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);
  
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedSubject, setSelectedSubject] = useState("All");

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const colors = {
    bg: "#282C34",
    card: "#333842",
    text: "#FFFFFF",
    subText: "#BBBBBB",
    accent: "#f49b33",
    inputBorder: "#4C5361",
    callBtn: "#2196F3",
    chipActive: "#f49b33",
    chipInactive: "#333842",
  };

  useEffect(() => {
    const fetchMyStudents = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const teacherDoc = await getDoc(doc(db, "users", user.uid));
        if (!teacherDoc.exists()) return;
        
        const teacherData = teacherDoc.data();
        const classesTaught = teacherData.classesTaught || [];
        const subjectsTaught = teacherData.subjects || [];

        setMyClasses(["All", ...classesTaught]);
        setMySubjects(["All", ...subjectsTaught]);

        if (classesTaught.length === 0) {
          setLoading(false);
          return;
        }

        const q = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("standard", "in", classesTaught),
          where("isApproved", "==", true)
        );

        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        list.sort((a, b) => a.standard.localeCompare(b.standard) || a.name.localeCompare(b.name));

        setStudents(list);
        setFilteredStudents(list);
      } catch (error) {
        console.log("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyStudents();
  }, []);

  useEffect(() => {
    let result = students;

    if (selectedClass !== "All") {
      result = result.filter((s) => s.standard === selectedClass);
    }

    if (selectedSubject !== "All") {
      result = result.filter((s) => 
        s.enrolledSubjects && s.enrolledSubjects.includes(selectedSubject)
      );
    }

    if (searchQuery.trim() !== "") {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(lower) ||
          s.email?.toLowerCase().includes(lower)
      );
    }

    setFilteredStudents(result);
  }, [selectedClass, selectedSubject, searchQuery, students]);

  const handleCall = (phoneNumber) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      showToast("No phone number registered.", "warning");
    }
  };

  const openDetailModal = (student) => {
    setSelectedStudent(student);
    setDetailModalVisible(true);
  };

  const renderStudentCard = ({ item }) => (
    <View className="bg-[#333842] p-4 rounded-xl mb-3 flex-row justify-between items-center border border-[#4C5361]">
      
      <TouchableOpacity 
        style={{ flex: 1 }} 
        onPress={() => openDetailModal(item)}
      >
        <Text className="text-white font-bold text-lg">{item.name}</Text>
        <View className="mt-1 flex-row">
            <View className="bg-[#f49b33]/20 px-2 py-0.5 rounded">
                <Text className="text-[#f49b33] text-xs font-bold">
                    Class: {item.standard}
                </Text>
            </View>
        </View>
        <Text className="text-gray-500 text-[10px] mt-1">Tap for details</Text>
      </TouchableOpacity>

      <View className="flex-row items-center">
        <TouchableOpacity 
            onPress={() => handleCall(item.phone)} 
            className="p-2 bg-blue-500/20 rounded-lg border border-blue-500"
        >
            <Ionicons name="call" size={20} color="#2196F3" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} className="pt-8">
      <StatusBar backgroundColor={colors.bg} barStyle="light-content" />

      <CustomToast 
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <Modal visible={detailModalVisible} animationType="fade" transparent={true} onRequestClose={() => setDetailModalVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/80 p-4">
            <View className="bg-[#333842] w-full rounded-xl p-6 border border-[#f49b33]">
                <Text className="text-white text-2xl font-bold mb-4 border-b border-gray-600 pb-2">{selectedStudent?.name}</Text>
                
                <View className="mb-4">
                    <Text className="text-gray-400 text-xs uppercase mb-1">Contact Info</Text>
                    <Text className="text-white text-base mb-1">📧 {selectedStudent?.email}</Text>
                    <TouchableOpacity onPress={() => handleCall(selectedStudent?.phone)} className="flex-row items-center">
                        <Text className="text-[#f49b33] text-base font-bold">📞 {selectedStudent?.phone || "N/A"}</Text>
                    </TouchableOpacity>
                </View>

                <View className="mb-4">
                    <Text className="text-gray-400 text-xs uppercase mb-1">Academic Info</Text>
                    <Text className="text-white text-base">Class: <Text className="font-bold">{selectedStudent?.standard}</Text></Text>
                    {selectedStudent?.stream !== "N/A" && <Text className="text-white text-base">Stream: {selectedStudent?.stream}</Text>}
                    <Text className="text-white text-sm mt-1 text-gray-300">Subjects: {selectedStudent?.enrolledSubjects?.join(", ")}</Text>
                </View>

                <TouchableOpacity onPress={() => setDetailModalVisible(false)} className="bg-[#f49b33] p-3 rounded-lg items-center">
                    <Text className="text-[#282C34] font-bold">Close</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      <View className="px-4 pb-4 py-7 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold ml-4">My Students</Text>
      </View>

      <View className="px-4 mb-4">
        <View style={{ backgroundColor: colors.card, borderColor: colors.inputBorder }} className="flex-row items-center rounded-lg px-3 border">
          <Ionicons name="search" size={20} color={colors.subText} />
          <TextInput
            placeholder="Search Name..."
            placeholderTextColor={colors.subText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ color: colors.text }}
            className="flex-1 p-3"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={colors.subText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="mb-2">
        <View className="mb-3 px-4">
            <Text className="text-gray-400 text-xs mb-1">Filter by Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {myClasses.map((cls) => (
                    <TouchableOpacity
                        key={cls}
                        onPress={() => setSelectedClass(cls)}
                        className={`mr-2 px-4 py-1.5 rounded-full border ${selectedClass === cls ? "bg-[#f49b33] border-[#f49b33]" : "border-[#4C5361] bg-[#333842]"}`}
                    >
                        <Text className={`${selectedClass === cls ? "text-[#282C34]" : "text-white"} font-bold text-xs`}>
                            {cls}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {mySubjects.length > 1 && (
            <View className="mb-2 px-4">
                <Text className="text-gray-400 text-xs mb-1">Filter by Subject</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {mySubjects.map((subj) => (
                        <TouchableOpacity
                            key={subj}
                            onPress={() => setSelectedSubject(subj)}
                            className={`mr-2 px-4 py-1.5 rounded-full border ${selectedSubject === subj ? "bg-[#f49b33] border-[#f49b33]" : "border-[#4C5361] bg-[#333842]"}`}
                        >
                            <Text className={`${selectedSubject === subj ? "text-[#282C34]" : "text-white"} font-bold text-xs`}>
                                {subj}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} className="mt-10" />
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          ListEmptyComponent={
            <View className="mt-10 items-center">
                <Ionicons name="school-outline" size={50} color={colors.inputBorder} />
                <Text style={{ color: colors.subText, marginTop: 10 }}>No students match your filters.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default TeacherMyStudents;