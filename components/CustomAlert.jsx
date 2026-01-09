import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../context/ThemeContext"; // Import Theme Hook

const CustomAlert = ({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "default",
}) => {
  const { theme } = useTheme(); // Get dynamic theme

  const getIconName = () => {
    switch (type) {
      case "success":
        return "checkmark-circle";
      case "error":
        return "alert-circle";
      default:
        return "warning";
    }
  };

  const getIconColor = () => {
    switch (type) {
      case "success":
        return theme.success;
      case "error":
        return theme.error;
      case "warning":
        return theme.warning;
      default:
        return theme.accent;
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View
        style={[
          styles.centeredView,
          { backgroundColor: theme.blackSoft75 || "rgba(0,0,0,0.75)" },
        ]}
      >
        <View
          style={[
            styles.modalView,
            {
              backgroundColor: theme.bgSecondary,
              borderColor: theme.accent,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={getIconName()} size={48} color={getIconColor()} />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {title}
          </Text>

          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {message}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={onCancel}
              style={[
                styles.button,
                styles.cancelButton,
                {
                  borderColor: theme.textSecondary,
                  backgroundColor: theme.bgTertiary || "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Text
                style={[styles.cancelButtonText, { color: theme.textPrimary }]}
              >
                {cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              style={[
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor: getIconColor(),
                  shadowColor: getIconColor(),
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  { color: type === "warning" ? "#000" : "#fff" }, // Adjust text color for visibility
                ]}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  confirmButton: {
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export default CustomAlert;
