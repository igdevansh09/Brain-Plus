import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

/**
 * CustomHeader - Reusable across all project screens
 * Supports back buttons, right-side actions, and theme switching.
 */
const CustomHeader = ({
  title,
  showBack = false,
  onBackPress,
  rightIcon,
  onRightPress,
  rightComponent,
  subtitle,
}) => {
  const router = useRouter();
  const { theme } = useTheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={{
        backgroundColor: theme.bgPrimary,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
      className="flex-row items-center justify-between px-4 py-3"
    >
      {/* Left Section: Navigation & Title */}
      <View className="flex-row items-center flex-1">
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            className="mr-3 p-1 rounded-full"
            style={{ backgroundColor: theme.bgSecondary }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        )}

        <View>
          {title && (
            <Text
              style={{ color: theme.textPrimary }}
              className="text-xl font-bold"
              numberOfLines={1}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={{ color: theme.textMuted }}
              className="text-xs"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {/* Right Section: Contextual Actions */}
      <View className="flex-row items-center">
        {rightComponent ? (
          rightComponent
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={onRightPress}
            className="p-2 rounded-full"
            style={{ backgroundColor: theme.bgSecondary }}
          >
            <Ionicons name={rightIcon} size={22} color={theme.accent} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export default CustomHeader;
