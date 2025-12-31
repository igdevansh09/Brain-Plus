/**
 * Brain Plus Academy - Complete Backend
 * Includes: Auth, Fees, Salaries, and ALL 10 Notification Triggers
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");

// --- ADD THIS CONFIGURATION ---
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,      // Limits the number of concurrent instances to save resources
  concurrency: 80,       // Allows one instance to handle multiple requests
  cpu: "0.5",            // REDUCE CPU: Uses only 0.5 vCPU per function instead of 1
});

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ==================================================================
// 🛠️ HELPER FUNCTIONS (Notification Logic)
// ==================================================================

// 1. Send Notifications to specific tokens
const sendNotifications = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return;

  // Remove duplicates and nulls
  const uniqueTokens = [...new Set(tokens.filter((t) => t))];
  if (uniqueTokens.length === 0) return;

  const payload = {
    notification: { title, body },
    data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
    tokens: uniqueTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(payload);
    console.log(
      `📣 Notification: "${title}" sent to ${response.successCount} devices.`
    );
  } catch (error) {
    console.error("❌ Notification Error:", error);
  }
};

// 2. Get Tokens for all users of a specific Role (e.g. 'admin', 'teacher')
const getTokensByRole = async (role) => {
  const snap = await admin
    .firestore()
    .collection("users")
    .where("role", "==", role)
    .get();
  return snap.docs.map((d) => d.data().fcmToken);
};

// 3. Get Tokens for Students in a specific Class (e.g. '10th')
const getStudentTokensByClass = async (standard) => {
  if (!standard) return [];
  // Handle cases where standard might be "10th Grade" or just "10th"
  // This logic assumes the 'standard' field in users collection matches the input
  const snap = await admin
    .firestore()
    .collection("users")
    .where("role", "==", "student")
    .where("standard", "==", standard)
    .get();
  return snap.docs.map((d) => d.data().fcmToken);
};

// 4. Find Teachers for a specific Class (for Student Leave requests)
const getTeacherTokensForClass = async (targetClass) => {
  const teachersSnap = await admin
    .firestore()
    .collection("users")
    .where("role", "==", "teacher")
    .get();
  const tokens = [];

  teachersSnap.forEach((doc) => {
    const data = doc.data();
    // Check old array style OR new profile style
    const classes =
      data.classesTaught || (data.teachingProfile || []).map((p) => p.class);
    if (classes.includes(targetClass)) {
      if (data.fcmToken) tokens.push(data.fcmToken);
    }
  });
  return tokens;
};

// ==================================================================
// 1️⃣ CORE USER MANAGEMENT (Updated with Notifications)
// ==================================================================

// --- 1. SELF-REGISTRATION ---
exports.registerUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

  const { role, name, ...otherData } = request.data;
  const uid = request.auth.uid;
  const phone = request.auth.token.phone_number || "";

  if (!["student", "teacher"].includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "Role must be student or teacher."
    );
  }

  // Prevent overwrite
  const userRecord = await admin.auth().getUser(uid);
  if (userRecord.customClaims && userRecord.customClaims.role) {
    throw new HttpsError("already-exists", "You are already registered.");
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { role, verified: false });
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
    // Notification SCENARIO 1 (Signup -> Admin) is handled by the Trigger below
    return {
      success: true,
      message: "Registration successful. Pending approval.",
    };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

// --- 2. APPROVE USER (Admin Only) ---
exports.approveUser = onCall(async (request) => {
  if (request.auth?.token?.role !== "admin")
    throw new HttpsError("permission-denied", "Admin only.");

  const { targetUid } = request.data;

  try {
    // Determine role to preserve it
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(targetUid)
      .get();
    const userRole = userDoc.data()?.role || "student"; // fallback

    await admin
      .auth()
      .setCustomUserClaims(targetUid, { role: userRole, verified: true });
    await admin
      .firestore()
      .collection("users")
      .doc(targetUid)
      .update({ verified: true });

    // Notification SCENARIO 2 (Approve -> User) is handled by the Trigger below
    return { success: true, message: "User approved successfully." };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

// --- 3. DELETE USER (Admin Only) ---
exports.deleteTargetUser = onCall(async (request) => {
  if (request.auth?.token?.role !== "admin")
    throw new HttpsError("permission-denied", "Admin only.");

  const { targetUid } = request.data;

  try {
    // SCENARIO 3: Notify User BEFORE deletion
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(targetUid)
      .get();
    const token = userDoc.data()?.fcmToken;
    if (token) {
      await sendNotifications(
        [token],
        "Account Removed ⚠️",
        "Your account has been removed by the administrator."
      );
    }

    await admin.auth().deleteUser(targetUid);
    await admin.firestore().collection("users").doc(targetUid).delete();

    return { success: true, message: "User deleted permanently." };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

// ==================================================================
// 🔔 NOTIFICATION TRIGGERS (The Automation)
// ==================================================================

// SCENARIO 1: Signup -> Admin Notification
exports.onUserCreated = onDocumentCreated("users/{uid}", async (event) => {
  const newUser = event.data.data();
  // Don't notify if an admin creates themselves
  if (newUser.role === "admin") return;

  const adminTokens = await getTokensByRole("admin");
  await sendNotifications(
    adminTokens,
    "New Registration 📝",
    `${newUser.name} has registered as a ${newUser.role}.`
  );
});

// SCENARIO 2: Admin Approves -> User Notification
exports.onUserUpdated = onDocumentUpdated("users/{uid}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Trigger only when 'verified' changes from false to true
  if (!before.verified && after.verified) {
    const token = after.fcmToken;
    await sendNotifications(
      [token],
      "Account Approved ✅",
      "Welcome! Your account has been verified. You can now access all features."
    );
  }
});

// SCENARIO 4: Global Notice -> Everyone
exports.onGlobalNotice = onDocumentCreated("notices/{id}", async (event) => {
  const notice = event.data.data();

  const studentTokens = await getTokensByRole("student");
  const teacherTokens = await getTokensByRole("teacher");

  await sendNotifications(
    [...studentTokens, ...teacherTokens],
    `📢 ${notice.title}`,
    notice.content || "New global announcement from Admin."
  );
});

// SCENARIO 5 & 10: Leave Requests
exports.onLeaveCreated = onDocumentCreated("leaves/{id}", async (event) => {
  const leave = event.data.data();
  const applicantId = leave.studentId;

  // We need to fetch the applicant to know if they are a student or teacher
  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(applicantId)
    .get();
  if (!userDoc.exists) return;

  const userData = userDoc.data();
  const role = userData.role;
  const name = userData.name;

  if (role === "teacher") {
    // SCENARIO 5: Teacher sends leave -> Admin notified
    const adminTokens = await getTokensByRole("admin");
    await sendNotifications(
      adminTokens,
      "Teacher Leave Request 📅",
      `${name} has requested leave for ${leave.days} days.`
    );
  } else {
    // SCENARIO 10: Student sends leave -> Respective Teachers notified
    const studentClass = userData.standard; // e.g. "10th"
    if (studentClass) {
      const teacherTokens = await getTeacherTokensForClass(studentClass);
      await sendNotifications(
        teacherTokens,
        "Student Leave Request 🤒",
        `${name} (${studentClass}) has requested leave.`
      );
    }
  }
});

// SCENARIO 6: Class Update -> Admin & Students
exports.onClassUpdate = onDocumentCreated(
  "class_notices/{id}",
  async (event) => {
    const notice = event.data.data();
    const { classId, teacherName, title } = notice;

    // 1. Notify Students of that class
    const studentTokens = await getStudentTokensByClass(classId);

    // 2. Notify Admins
    const adminTokens = await getTokensByRole("admin");

    await sendNotifications(
      [...studentTokens, ...adminTokens],
      `New Update: ${classId} 🔔`,
      `${teacherName}: ${title}`
    );
  }
);

// SCENARIO 7: Course Created/Updated/Deleted -> Students
exports.onCourseWrite = onDocumentWritten("courses/{id}", async (event) => {
  // If deleted (after doesn't exist)
  if (!event.data.after.exists) {
    // Hard to find *who* to notify on delete since data is gone,
    // but we can try using 'before' data if needed.
    return;
  }

  const course = event.data.after.data();
  const before = event.data.before.exists ? event.data.before.data() : null;

  // Course usually has a 'target' field like "11th Physics" or just "Guest"
  const target = course.target || "";
  // Extract standard (e.g., "11th" from "11th Physics")
  const standard = target.split(" ")[0];

  let title = "";
  let body = "";

  if (!before) {
    // Created
    title = "New Course Added 📚";
    body = `New course '${course.title}' is available for ${target}.`;
  } else {
    // Updated
    title = "Course Updated 🔄";
    body = `'${course.title}' content has been updated. Check it out!`;
  }

  // Get students of that standard
  const tokens = await getStudentTokensByClass(standard);
  await sendNotifications(tokens, title, body);
});

// SCENARIO 8a: Attendance -> Student
exports.onAttendance = onDocumentCreated("attendance/{id}", async (event) => {
  const data = event.data.data();
  // data.records is { "uid1": "Present", "uid2": "Absent" }
  const studentIds = Object.keys(data.records || {});

  // Loop through and notify each student individually
  for (const uid of studentIds) {
    const status = data.records[uid];
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const token = userDoc.data()?.fcmToken;

    if (token) {
      const emoji = status === "Present" ? "✅" : "❌";
      await sendNotifications(
        [token],
        "Attendance Marked 📝",
        `You were marked ${status} for ${data.date} ${emoji}`
      );
    }
  }
});

// SCENARIO 8b: Test Scores -> Student
exports.onTestResult = onDocumentCreated("test_results/{id}", async (event) => {
  const result = event.data.data();
  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(result.studentId)
    .get();
  const token = userDoc.data()?.fcmToken;

  await sendNotifications(
    [token],
    "Test Score Released 📊",
    `You scored ${result.marksObtained}/${result.totalMarks} in ${result.testName}.`
  );
});

// SCENARIO 9: Homework & Class Notes -> Students
// 9a. Homework
exports.onHomework = onDocumentCreated("homework/{id}", async (event) => {
  const hw = event.data.data();
  const tokens = await getStudentTokensByClass(hw.classId);
  await sendNotifications(
    tokens,
    "New Homework 🏠",
    `${hw.subject}: ${hw.title} - Due ${hw.dueDate}`
  );
});

// 9b. Class Notes (Materials)
exports.onMaterials = onDocumentCreated("materials/{id}", async (event) => {
  const mat = event.data.data();
  const tokens = await getStudentTokensByClass(mat.classId);
  await sendNotifications(
    tokens,
    "New Class Note 📖",
    `${mat.subject}: ${mat.title}`
  );
});

// ==================================================================
// 💰 AUTOMATED CRON JOBS (Fees & Salaries)
// ==================================================================

exports.generateMonthlyFees = onSchedule("0 10 5 * *", async (event) => {
  const date = new Date();
  const currentTitle = `Tuition Fee - ${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
  console.log(`Starting fee generation: ${currentTitle}`);

  try {
    const studentsSnap = await admin
      .firestore()
      .collection("users")
      .where("role", "==", "student")
      .where("verified", "==", true)
      .get();

    const feesSnap = await admin
      .firestore()
      .collection("fees")
      .where("title", "==", currentTitle)
      .get();

    const billedIds = feesSnap.docs.map((doc) => doc.data().studentId);
    const batch = admin.firestore().batch();
    let count = 0;

    for (const doc of studentsSnap.docs) {
      if (!billedIds.includes(doc.id)) {
        const student = doc.data();
        const newRef = admin.firestore().collection("fees").doc();

        batch.set(newRef, {
          studentId: doc.id,
          studentName: student.name,
          studentClass: student.standard || "N/A",
          studentPhone: student.phone || "",
          title: currentTitle,
          amount: student.monthlyFeeAmount || "5000",
          status: "Pending",
          date: new Date().toLocaleDateString("en-GB"),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notify Student
        if (student.fcmToken) {
          await sendNotifications(
            [student.fcmToken],
            "Fee Generated 💰",
            `Your fee for ${currentTitle} is now due.`
          );
        }
        count++;
      }
    }

    if (count > 0) await batch.commit();
    console.log(`Generated fees for ${count} students.`);
  } catch (error) {
    console.error("Error in generateMonthlyFees:", error);
  }
});

exports.generateMonthlySalaries = onSchedule("0 10 5 * *", async (event) => {
  const date = new Date();
  const currentTitle = `Salary - ${date.toLocaleString("default", { month: "long" })} ${date.getFullYear()}`;
  console.log(`Starting salary generation: ${currentTitle}`);

  try {
    const teachersSnap = await admin
      .firestore()
      .collection("users")
      .where("role", "==", "teacher")
      .where("verified", "==", true)
      .where("salaryType", "==", "Fixed")
      .get();

    const salariesSnap = await admin
      .firestore()
      .collection("salaries")
      .where("title", "==", currentTitle)
      .get();

    const paidTeacherIds = salariesSnap.docs.map((doc) => doc.data().teacherId);
    const batch = admin.firestore().batch();
    let count = 0;

    for (const doc of teachersSnap.docs) {
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

        // Notify Teacher
        if (teacher.fcmToken) {
          await sendNotifications(
            [teacher.fcmToken],
            "Salary Slip Generated 💵",
            `Your salary slip for ${currentTitle} has been generated.`
          );
        }
        count++;
      }
    }

    if (count > 0) await batch.commit();
    console.log(`Generated salaries for ${count} teachers.`);
  } catch (error) {
    console.error("Error generating salaries:", error);
  }
});
