import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
import { colors } from "../utils/colors"; // Ensure this matches your path
import { lightColors } from "../utils/lightColors"; // Ensure this matches your path

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme(); // 'light' or 'dark'

  // You can default to system, or store a manual override in AsyncStorage
  const [themeMode, setThemeMode] = useState("system");

  const isDark =
    themeMode === "system" ? systemScheme === "dark" : themeMode === "dark";

  const theme = isDark ? colors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, setThemeMode, themeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for easy access
export const useTheme = () => useContext(ThemeContext);
