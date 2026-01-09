import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import Pdf from "react-native-pdf";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext"; // Import Theme Hook

const ViewAttachment = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme, isDark } = useTheme(); // Get dynamic theme values

  // Robustly decode the URL passed from params (handle single/double-encoding)
  const decodeSafe = (u) => {
    if (!u) return null;
    let decoded = u;
    try {
      // Try decoding up to 3 times (handles double-encoded values)
      for (let i = 0; i < 3; i++) {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      }
    } catch (e) {
      // If decoding fails, fall back to original
    }
    return decoded;
  };

  const rawUrl = params.url ? decodeSafe(params.url) : null;
  const titleParam = params.title || "Attachment";
  const typeParam = params.type;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [urlToShow, setUrlToShow] = useState(rawUrl);
  const [fileTitle, setFileTitle] = useState(titleParam);
  const [fileTypeState, setFileTypeState] = useState(typeParam);

  // Fallback type detection
  const fileType =
    fileTypeState === "pdf" ||
    (urlToShow && urlToShow.toLowerCase().includes(".pdf"))
      ? "pdf"
      : "image";

  // If a docId was passed, fetch the real attachment URL from Firestore
  useEffect(() => {
    let cancelled = false;
    const fetchUrl = async () => {
      if (!params.docId) return;
      try {
        // Students might be viewing homework or materials
        const collectionsToTry = ["homework", "materials"];
        for (const col of collectionsToTry) {
          const doc = await firestore().collection(col).doc(params.docId).get();
          if (!doc.exists) continue;
          const data = doc.data() || {};

          const idx = params.idx != null ? parseInt(params.idx, 10) : null;
          if (
            Array.isArray(data.attachments) &&
            idx != null &&
            data.attachments[idx]
          ) {
            const attachment = data.attachments[idx];
            if (!cancelled) {
              setUrlToShow(attachment.url || attachment.link || rawUrl);
              setFileTitle(attachment.name || titleParam);
              setFileTypeState(attachment.type || typeParam);
            }
            return;
          }

          // Legacy support
          if (data.link) {
            if (!cancelled) {
              setUrlToShow(data.link);
              setFileTitle(data.attachmentName || titleParam);
              setFileTypeState(data.fileType || typeParam);
            }
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching document for attachment:", err);
      }
    };

    fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [params.docId, params.idx, rawUrl, titleParam, typeParam]);

  const isInvalid = !rawUrl && !params.docId;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.bgPrimary }]}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.bgSecondary}
      />

      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.bgSecondary,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <Text
          style={[styles.headerTitle, { color: theme.textPrimary }]}
          numberOfLines={1}
        >
          {fileTitle}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* CONTENT AREA */}
      <View style={[styles.content, { backgroundColor: theme.bgPrimary }]}>
        {isInvalid ? (
          <View style={styles.centerContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={theme.error}
            />
            <Text style={[styles.errorText, { color: theme.error }]}>
              Invalid File URL
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="warning-outline" size={48} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.error }]}>
              Failed to load file
            </Text>
            <TouchableOpacity
              onPress={() => {
                setError(false);
                setLoading(true);
              }}
              style={[
                styles.retryButton,
                { backgroundColor: theme.bgTertiary },
              ]}
            >
              <Text style={{ color: theme.textPrimary }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {fileType === "image" && urlToShow && (
              <Image
                source={{ uri: urlToShow }}
                style={styles.fullScreen}
                resizeMode="contain"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            )}

            {fileType === "pdf" && urlToShow && (
              <Pdf
                source={{ uri: urlToShow, cache: true }}
                style={[
                  styles.fullScreen,
                  { backgroundColor: theme.bgPrimary },
                ]}
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
                style={[
                  styles.loadingOverlay,
                  { backgroundColor: theme.blackSoft60 },
                ]}
              >
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  content: {
    flex: 1,
    position: "relative",
  },
  fullScreen: {
    width: "100%",
    height: "100%",
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ViewAttachment;