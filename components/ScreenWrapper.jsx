import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext"; // Import Theme Hook

const ScreenWrapper = ({
  children,
  onRefresh,
  scrollable = true,
  contentContainerStyle,
  className,
}) => {
  const { theme, isDark } = useTheme(); // Get dynamic theme values
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error("Global Refresh Error:", error);
      } finally {
        setRefreshing(false);
      }
    }
  }, [onRefresh]);

  return (
    <SafeAreaView
      style={{ backgroundColor: theme.bgPrimary, flex: 1 }} // Dynamic Background
      className={className || ""}
      edges={["top", "left", "right"]}
    >
      {/* Dynamic Status Bar */}
      <StatusBar
        backgroundColor={theme.bgPrimary}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {scrollable ? (
        <ScrollView
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.accent} // Dynamic Spinner Color (iOS)
                colors={[theme.accent]} // Dynamic Spinner Color (Android)
              />
            ) : null
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
};

export default ScreenWrapper;
 
