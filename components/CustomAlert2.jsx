import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { useTheme } from "../context/ThemeContext"; // Import Theme Hook

const CustomAlert2 = ({
  visible,
  title,
  message,
  onClose,
  icon = "information-circle",
}) => {
  const { theme } = useTheme(); // Get dynamic theme

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={[
            styles.centeredView,
            { backgroundColor: theme.blackSoft80 || "rgba(0, 0, 0, 0.8)" },
          ]}
        >
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalView,
                {
                  backgroundColor: theme.bgSecondary,
                  borderColor: theme.accent,
                  shadowColor: theme.shadow || "#000",
                },
              ]}
            >
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {title}
              </Text>

              <ScrollView style={{ maxHeight: 200 }}>
                <Text style={[styles.message, { color: theme.textSecondary }]}>
                  {message}
                </Text>
              </ScrollView>

              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Tap outside to close
              </Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    width: "85%",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 50,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  hint: {
    marginTop: 20,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

export default CustomAlert2;
 
