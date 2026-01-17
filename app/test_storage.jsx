import { useState } from "react";
import {
  View,
  Image,
  Alert,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
// Refactor: Import Modular SDK functions
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";
import { useTheme } from "../context/ThemeContext";

export default function TestStorage() {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { theme } = useTheme();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    // Modular: Initialize auth and get user
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) return Alert.alert("Login First");

    setUploading(true);
    const filename = `profile_pictures/${user.uid}/profile.jpg`;

    // Modular: Get storage instance and create reference
    const storage = getStorage();
    const storageRef = ref(storage, filename);

    try {
      // Note: In React Native Firebase Modular, putFile is available on the reference object
      // This is slightly different from Web SDK (uploadBytes) but is the correct way for RN local files
      await storageRef.putFile(uri);

      // Modular: getDownloadURL(ref)
      const url = await getDownloadURL(storageRef);
      Alert.alert("Success", "Image uploaded!");
      console.log(url);
    } catch (error) {
      console.error(error);
      Alert.alert("Upload Failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.bgPrimary,
      }}
    >
      <TouchableOpacity
        onPress={pickImage}
        disabled={uploading}
        style={{
          backgroundColor: theme.accent,
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 8,
          opacity: uploading ? 0.6 : 1,
        }}
      >
        <Text
          style={{ color: theme.textDark, fontWeight: "bold", fontSize: 16 }}
        >
          {uploading ? "Uploading..." : "Pick & Upload Image"}
        </Text>
      </TouchableOpacity>

      {uploading && (
        <View style={{ marginTop: 20 }}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={{ color: theme.textPrimary, marginTop: 8 }}>
            Uploading...
          </Text>
        </View>
      )}

      {image && (
        <Image
          source={{ uri: image }}
          style={{
            marginTop: 20,
            width: 200,
            height: 200,
            borderRadius: 100,
            borderWidth: 2,
            borderColor: theme.accent,
          }}
        />
      )}
    </View>
  );
}
 
