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

const ViewAttachment = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

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

  // Debug logs (only in dev) to help diagnose routing/encoding issues
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("ViewAttachment - received params:", params);
    console.log("ViewAttachment - decoded rawUrl:", rawUrl);
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [urlToShow, setUrlToShow] = useState(rawUrl);
  const [fileTitle, setFileTitle] = useState(titleParam);
  const [fileTypeState, setFileTypeState] = useState(typeParam);

  // Fallback type detection if 'type' param isn't reliable
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

          if (data.link) {
            if (!cancelled) {
              setUrlToShow(data.link);
              setFileTitle(data.attachmentName || titleParam);
              setFileTypeState(data.fileType || typeParam);
            }
            return;
          }
        }
        console.warn(
          "Document not found in homework or materials:",
          params.docId
        );
      } catch (err) {
        console.error("Error fetching document for attachment:", err);
      }
    };

    fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [params.docId, params.idx, rawUrl, titleParam, typeParam]);

  useEffect(() => {
    console.log("ViewAttachment - urlToShow:", urlToShow);
  }, [urlToShow]);

  const isInvalid = !rawUrl && !params.docId;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {fileTitle}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* CONTENT AREA */}
      <View style={styles.content}>
        {isInvalid ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF5252" />
            <Text style={styles.errorText}>Invalid File URL</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="warning-outline" size={48} color="#FF5252" />
            <Text style={styles.errorText}>Failed to load file</Text>
            <TouchableOpacity
              onPress={() => {
                setError(false);
                setLoading(true);
                // Trigger re-render/re-fetch trick could go here
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
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
                style={styles.fullScreen}
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
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#f49b33" />
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
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    backgroundColor: "#111",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  content: {
    flex: 1,
    backgroundColor: "#000",
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
    color: "#FF5252",
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: "#333",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ViewAttachment;
