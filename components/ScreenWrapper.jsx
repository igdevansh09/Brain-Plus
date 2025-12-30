import React, { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Common Theme Background
const BG_COLOR = "#282C34";
const ACCENT_COLOR = "#f49b33";

const ScreenWrapper = ({
  children,
  onRefresh,
  scrollable = true,
  contentContainerStyle,
  className,
}) => {
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
      className={`flex-1 bg-[${BG_COLOR}] ${className || ""}`}
      edges={["top", "left", "right"]}
    >
      <StatusBar backgroundColor={BG_COLOR} barStyle="light-content" />

      {scrollable ? (
        <ScrollView
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={ACCENT_COLOR}
                colors={[ACCENT_COLOR]}
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
