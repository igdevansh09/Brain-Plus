import React, { useState } from "react";
import { View, Button, Image, Alert, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";

export default function TestStorage() {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

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
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Button title="Pick & Upload Image" onPress={pickImage} />
      {uploading && <Text>Uploading...</Text>}
      {image && (
        <Image
          source={{ uri: image }}
          style={{ width: 200, height: 200, marginTop: 20 }}
        />
      )}
    </View>
  );
}
