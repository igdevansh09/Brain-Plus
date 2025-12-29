import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import Pdf from "react-native-pdf";

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
            marginTop: StatusBar.currentHeight || 0,
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
            {fileTitle}
          </Text>
        </View>
      </SafeAreaView>

      {/* CONTENT */}
      {/* CONTENT */}
      <View style={{ flex: 1 }}>
        {isInvalid ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#000",
            }}
          >
            <Text style={{ color: "white" }}>Invalid file URL</Text>
          </View>
        ) : (
          <>
            {fileType === "image" && urlToShow && (
              <Image
                source={{ uri: urlToShow }}
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

            {fileType === "pdf" && urlToShow && (
              <Pdf
                source={{ uri: urlToShow, cache: true }}
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
          </>
        )}
      </View>
    </View>
  );
};

export default ViewAttachment;
