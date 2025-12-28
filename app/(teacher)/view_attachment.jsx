import React, { useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  StyleSheet,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import Pdf from "react-native-pdf";

const ViewAttachment = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const rawUrl = params.url ? decodeURIComponent(params.url) : "";
  const title = params.title || "Attachment";
  const type = params.type || "file";

  const [loading, setLoading] = useState(true);

  const colors = {
    BG: "#282C34",
    HEADER: "#333842",
    TEXT: "#FFFFFF",
    ACCENT: "#f49b33",
  };

  const isImage =
    type === "image" ||
    (rawUrl && rawUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.BG }}
      className="pt-8"
    >
      <StatusBar backgroundColor={colors.BG} barStyle="light-content" />

      <View
        style={{
          backgroundColor: colors.HEADER,
          borderBottomColor: "#4C5361",
          borderBottomWidth: 1,
        }}
        className="px-4 py-4 flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1 mr-2">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color={colors.TEXT} />
          </TouchableOpacity>
          <Text
            style={{ color: colors.TEXT }}
            className="text-lg font-semibold"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {isImage ? (
          <Image
            source={{ uri: rawUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
          />
        ) : (
          <Pdf
            source={{ uri: rawUrl, cache: true }}
            onLoadComplete={(numberOfPages, filePath) => {
              console.log(`Number of pages: ${numberOfPages}`);
              setLoading(false);
            }}
            onPageChanged={(page, numberOfPages) => {
              console.log(`Current page: ${page}`);
            }}
            onError={(error) => {
              console.log("PDF Error:", error);
              setLoading(false);
              alert("Could not load PDF. Try opening externally.");
            }}
            onPressLink={(uri) => {
              console.log(`Link pressed: ${uri}`);
              Linking.openURL(uri);
            }}
            style={styles.pdf}
            trustAllCerts={false}
          />
        )}

        {loading && (
          <View className="absolute inset-0 justify-center items-center bg-[#282C34]">
            <ActivityIndicator size="large" color={colors.ACCENT} />
            <Text style={{ color: colors.TEXT, marginTop: 10 }}>
              Loading...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    backgroundColor: "#282C34",
  },
});

export default ViewAttachment;
