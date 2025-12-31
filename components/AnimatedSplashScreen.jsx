import React, { useEffect, useRef } from "react";
import { View, Animated, Image, Text, Dimensions } from "react-native";

const AnimatedSplashScreen = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current; // Start invisible
  const scaleAnim = useRef(new Animated.Value(0.3)).current; // Start small
  const textAnim = useRef(new Animated.Value(0)).current; // Text opacity

  useEffect(() => {
    // Sequence: Logo Pop -> Text Fade In
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View className="flex-1 bg-[#282C34] justify-center items-center">
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          alignItems: "center",
        }}
      >
        {/* LOGO */}
        <Image
          source={require("../assets/images/icon.png")}
          style={{
            width: 120,
            height: 120,
            marginBottom: 20,
            borderRadius: 25,
          }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* TEXT (Welcome Message) */}
      <Animated.View style={{ opacity: textAnim, alignItems: "center" }}>
        <Text className="text-[#f49b33] text-3xl font-bold tracking-wider">
          Brain Plus
        </Text>
        <Text className="text-gray-400 text-lg tracking-[5px] uppercase mt-2">
          Academy
        </Text>

        {/* Optional: Subtle Loading Indicator at bottom */}
        <View className="mt-10">
          {/* You can remove this ActivityIndicator if you want a clean look */}
          {/* <ActivityIndicator size="small" color="#f49b33" /> */}
        </View>
      </Animated.View>
    </View>
  );
};

export default AnimatedSplashScreen;
