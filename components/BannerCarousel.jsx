import React, { useState, useEffect, useRef } from "react";
import { View, FlatList, Image, Dimensions } from "react-native";
import { useTheme } from "../context/ThemeContext";

// --- REFACTOR START: Modular Imports ---
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "@react-native-firebase/firestore";
import { db } from "../config/firebaseConfig"; // Import initialized db instance
// --- REFACTOR END ---

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32;

const BannerCarousel = () => {
  const { theme } = useTheme();
  const [originalBanners, setOriginalBanners] = useState([]);
  const [infiniteBanners, setInfiniteBanners] = useState([]);
  const flatListRef = useRef(null);

  // Track scroll position manually
  const scrollOffset = useRef(0);

  // --- FETCH DATA (MODULAR) ---
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        // Modular: query(collection, orderBy)
        const q = query(
          collection(db, "banners"),
          orderBy("createdAt", "desc")
        );

        // Modular: getDocs
        const snap = await getDocs(q);

        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        if (list.length > 0) {
          setOriginalBanners(list);
          // Create a large buffer for smooth looping
          const repeated = Array(100)
            .fill(list)
            .flat()
            .map((item, index) => ({
              ...item,
              uniqueId: `${item.id}_${index}`,
            }));
          setInfiniteBanners(repeated);
        }
      } catch (e) {
        console.log("Error fetching banners:", e);
      }
    };

    fetchBanners();
  }, []);

  // --- INFINITE SCROLL LOGIC (UNCHANGED) ---
  useEffect(() => {
    if (infiniteBanners.length === 0) return;

    // Calculate the width of ONE complete set of banners
    const singleSetWidth = originalBanners.length * CARD_WIDTH;

    // --- MOVIE SCROLL SETTINGS ---
    const speed = 2; // Pixels to move per tick (Lower = Slower/Smoother)
    const intervalTime = 20; // Milliseconds per tick (Lower = Smoother FPS)

    const timer = setInterval(() => {
      // 1. Move the offset forward
      scrollOffset.current += speed;

      // 2. Seamless Reset Logic
      if (scrollOffset.current >= singleSetWidth) {
        scrollOffset.current = 0;
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      } else {
        flatListRef.current?.scrollToOffset({
          offset: scrollOffset.current,
          animated: false,
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [infiniteBanners, originalBanners]);

  if (infiniteBanners.length === 0) return null;

  return (
    <View className="mb-6">
      <FlatList
        ref={flatListRef}
        data={infiniteBanners}
        keyExtractor={(item) => item.uniqueId}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false} // Disable manual scroll to behave like a movie/marquee
        getItemLayout={(data, index) => ({
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={{ width: CARD_WIDTH, height: 180 }} className="px-1">
            <Image
              source={{ uri: item.imageUrl }}
              className="w-full h-full rounded-2xl"
              resizeMode="cover"
              style={{
                backgroundColor: theme.bgTertiary,
                borderColor: theme.border,
                borderWidth: 1,
              }}
            />
          </View>
        )}
      />
    </View>
  );
};

export default BannerCarousel;
 
