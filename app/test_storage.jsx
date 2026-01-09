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
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { useTheme } from "../context/ThemeContext"; // Import theme hook

export default function TestStorage() {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { theme } = useTheme(); // Get dynamic theme

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
    const user = auth().currentUser;
    if (!user) return Alert.alert("Login First");

    setUploading(true);
    const filename = `profile_pictures/${user.uid}/profile.jpg`;
    const reference = storage().ref(filename);

    try {
      await reference.putFile(uri);
      const url = await reference.getDownloadURL();
      Alert.alert("Success!", "Image uploaded to: " + url);
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
        backgroundColor: theme.bgPrimary, // Dynamic Background
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
            width: 200,
            height: 200,
            marginTop: 20,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: theme.border,
          }}
        />
      )}
    </View>
  );
}
