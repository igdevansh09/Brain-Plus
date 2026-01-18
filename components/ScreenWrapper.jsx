import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

const ScreenWrapper = ({
  children,
  onRefresh,
  scrollable = true,
  contentContainerStyle,
  className,
  // NEW PROP: Allow overriding edges (Default includes top)
  edges = ["top", "left", "right"],
}) => {
  const { theme, isDark } = useTheme();
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
      style={{ backgroundColor: theme.bgPrimary, flex: 1 }}
      className={className || ""}
      edges={edges} // <--- PASS THE PROP HERE
    >
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
                tintColor={theme.accent}
                colors={[theme.accent]}
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
