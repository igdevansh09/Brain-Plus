import React from "react";
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableWithoutFeedback,
  ScrollView
} from "react-native";

const CustomAlert2 = ({ 
  visible, 
  title, 
  message, 
  onClose,
  icon = "information-circle" 
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.centeredView}>
          
          <TouchableWithoutFeedback>
            <View style={styles.modalView}>

              <Text style={styles.title}>{title}</Text>
              
              <ScrollView style={{ maxHeight: 200 }}>
                <Text style={styles.message}>{message}</Text>
              </ScrollView>

              <Text style={styles.hint}>Tap outside to close</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalView: {
    width: "85%",
    backgroundColor: "#333842",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f49b33", 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: "rgba(244, 155, 51, 0.1)",
    padding: 12,
    borderRadius: 50,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "#BBBBBB",
    textAlign: "center",
    lineHeight: 22,
  },
  hint: {
    marginTop: 20,
    fontSize: 10,
    color: "#616A7D",
    textTransform: "uppercase",
    letterSpacing: 1,
  }
});

export default CustomAlert2;