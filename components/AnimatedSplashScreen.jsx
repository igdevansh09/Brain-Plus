import React, { useEffect, useRef } from "react";
import { View, Animated, Image, Text } from "react-native";
import { useTheme } from "../context/ThemeContext"; // Import Theme Hook

const AnimatedSplashScreen = () => {
  const { theme } = useTheme(); // Get theme values
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
    <View
      className="flex-1 justify-center items-center"
      style={{ backgroundColor: theme.bgPrimary }} // Dynamic Background
    >
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
        <Text
          className="text-3xl font-bold tracking-wider"
          style={{ color: theme.accent }} // Dynamic Accent
        >
          Brain Plus
        </Text>
        <Text
          className="text-lg tracking-[5px] uppercase mt-2"
          style={{ color: theme.textSecondary }} // Dynamic Secondary Text
        >
          Academy
        </Text>

        {/* Optional: Subtle Loading Indicator at bottom */}
        <View className="mt-10">
          {/* You can remove this ActivityIndicator if you want a clean look */}
          {/* <ActivityIndicator size="small" color={theme.accent} /> */}
        </View>
      </Animated.View>
    </View>
  );
};

export default AnimatedSplashScreen;
 
