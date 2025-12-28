/**
 * Brain Plus Academy - Gatekeeper Backend
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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

// --- 4. AUTO GENERATE MONTHLY FEES (Scheduled: 5th of every month) ---
// Runs at 10:00 AM on the 5th day of every month
exports.generateMonthlyFees = onSchedule("0 10 5 * *", async (event) => {
  const date = new Date();
  const currentTitle = `Tuition Fee - ${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
  
  console.log(`Starting automated fee generation: ${currentTitle}`);

  try {
    // 1. Get all verified students
    const studentsSnap = await admin.firestore()
      .collection("users")
      .where("role", "==", "student")
      .where("verified", "==", true)
      .get();

    if (studentsSnap.empty) {
      console.log("No verified students found.");
      return;
    }

    // 2. Check which fees already exist for this month to avoid duplicates
    const feesSnap = await admin.firestore()
      .collection("fees")
      .where("title", "==", currentTitle)
      .get();
    
    const billedIds = feesSnap.docs.map((doc) => doc.data().studentId);

    const batch = admin.firestore().batch();
    let count = 0;

    // 3. Create fee records
    studentsSnap.forEach((doc) => {
      if (!billedIds.includes(doc.id)) {
        const student = doc.data();
        const newRef = admin.firestore().collection("fees").doc();
        
        batch.set(newRef, {
          studentId: doc.id,
          studentName: student.name,
          studentClass: student.standard || "N/A",
          studentPhone: student.phone || "", // Included for the Call button
          title: currentTitle,
          amount: student.monthlyFeeAmount || "5000",
          status: "Pending",
          date: new Date().toLocaleDateString("en-GB"), // DD/MM/YYYY
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Successfully generated fees for ${count} students.`);
    } else {
      console.log("All eligible students have already been billed for this month.");
    }

  } catch (error) {
    console.error("Error in generateMonthlyFees:", error);
  }
});

// --- 5. AUTO GENERATE MONTHLY SALARIES (Scheduled: 5th of every month) ---
// Runs at 10:00 AM on the 5th day of every month
exports.generateMonthlySalaries = onSchedule("0 10 5 * *", async (event) => {
  const date = new Date();
  const currentTitle = `Salary - ${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;

  console.log(`Starting automated salary generation: ${currentTitle}`);

  try {
    // 1. Get ONLY Fixed Salary Teachers
    const teachersSnap = await admin
      .firestore()
      .collection("users")
      .where("role", "==", "teacher")
      .where("verified", "==", true)
      .where("salaryType", "==", "Fixed") // <--- STRICT FILTER
      .get();

    if (teachersSnap.empty) return;

    // 2. Check duplicates
    const salariesSnap = await admin
      .firestore()
      .collection("salaries")
      .where("title", "==", currentTitle)
      .get();

    const paidTeacherIds = salariesSnap.docs.map((doc) => doc.data().teacherId);

    const batch = admin.firestore().batch();
    let count = 0;

    teachersSnap.forEach((doc) => {
      if (!paidTeacherIds.includes(doc.id)) {
        const teacher = doc.data();
        const newRef = admin.firestore().collection("salaries").doc();

        batch.set(newRef, {
          teacherId: doc.id,
          teacherName: teacher.name,
          teacherEmail: teacher.email,
          teacherPhone: teacher.phone || "",
          title: currentTitle,
          amount: teacher.salary || "0",
          status: "Pending",
          date: new Date().toLocaleDateString("en-GB"),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Generated salaries for ${count} teachers.`);
    }
  } catch (error) {
    console.error("Error generating salaries:", error);
  }
});


