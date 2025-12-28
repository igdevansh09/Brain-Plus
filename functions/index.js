/**
 * Brain Plus Academy - Gatekeeper Backend
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

// --- 1. SELF-REGISTRATION (Called by Student/Teacher after Phone Auth) ---
exports.registerUser = onCall(async (request) => {
  // User must be logged in via Phone Auth first
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to register."
    );
  }

  const { role, name, ...otherData } = request.data;
  const uid = request.auth.uid;
  const phone = request.auth.token.phone_number || "";

  // SECURITY: Prevent users from making themselves Admins
  if (!["student", "teacher"].includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "Role must be student or teacher."
    );
  }

  // CHECK: Don't let them overwrite an existing profile
  const userRecord = await admin.auth().getUser(uid);
  if (userRecord.customClaims && userRecord.customClaims.role) {
    throw new HttpsError("already-exists", "You are already registered.");
  }

  try {
    // 1. Set Auth Claims (Role + Unverified)
    await admin.auth().setCustomUserClaims(uid, {
      role: role,
      verified: false, // <--- The Gate
    });

    // 2. Create Firestore Profile
    await admin
      .firestore()
      .collection("users")
      .doc(uid)
      .set({
        name,
        phone,
        role,
        verified: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...otherData,
      });

    return {
      success: true,
      message: "Registration successful. Pending approval.",
    };
  } catch (error) {
    console.error("Registration Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

// --- 2. APPROVE USER (Admin Only) ---
exports.approveUser = onCall(async (request) => {
  // SECURITY: Only Admins can approve
  if (!request.auth || request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Access Denied.");
  }

  const { targetUid } = request.data;

  try {
    // 1. Get current claims to preserve role
    const user = await admin.auth().getUser(targetUid);
    const currentClaims = user.customClaims || {};

    // 2. Set Verified = True
    await admin.auth().setCustomUserClaims(targetUid, {
      ...currentClaims,
      verified: true,
    });

    // 3. Update Firestore
    await admin.firestore().collection("users").doc(targetUid).update({
      verified: true,
    });

    return { success: true, message: "User approved successfully." };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

// --- 3. DELETE USER (Admin Only) ---
exports.deleteTargetUser = onCall(async (request) => {
  // SECURITY: Only Admins can delete
  if (!request.auth || request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied", "Access Denied.");
  }

  const { targetUid } = request.data;

  try {
    // 1. Delete from Authentication
    await admin.auth().deleteUser(targetUid);

    // 2. Delete from Database
    await admin.firestore().collection("users").doc(targetUid).delete();

    return { success: true, message: "User deleted permanently." };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});
