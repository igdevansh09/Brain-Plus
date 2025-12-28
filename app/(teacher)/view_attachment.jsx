import React, { useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import Pdf from "react-native-pdf";

const ViewAttachment = () => {
  const router = useRouter();
  const { url, title = "Attachment", type } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!url) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white" }}>Invalid file</Text>
      </SafeAreaView>
    );
  }

  const fileType = type === "pdf" ? "pdf" : "image";

  const openExternal = () => Linking.openURL(url);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <SafeAreaView>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 12,
            justifyContent: "space-between",
            backgroundColor: "#111",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Text
            style={{
              color: "#fff",
              fontWeight: "bold",
              flex: 1,
              marginLeft: 12,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>

          <TouchableOpacity onPress={openExternal}>
            <Ionicons name="open-outline" size={22} color="#f49b33" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* CONTENT */}
      <View style={{ flex: 1 }}>
        {fileType === "image" && (
          <Image
            source={{ uri: url }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        )}

        {fileType === "pdf" && (
          <Pdf
            source={{ uri: url }}
            style={{ flex: 1 }}
            trustAllCerts={false}
            onLoadComplete={() => setLoading(false)}
            onError={(err) => {
              console.log("PDF Error:", err);
              setLoading(false);
              setError(true);
            }}
          />
        )}

        {loading && (
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#000",
            }}
          >
            <ActivityIndicator size="large" color="#f49b33" />
          </View>
        )}

        {error && (
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text style={{ color: "#fff", marginTop: 12, fontWeight: "bold" }}>
              Preview failed
            </Text>
            <TouchableOpacity
              onPress={openExternal}
              style={{
                marginTop: 20,
                backgroundColor: "#f49b33",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 30,
              }}
            >
              <Text style={{ color: "#000", fontWeight: "bold" }}>
                Open in Browser
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

export default ViewAttachment;
