/**
 * Brain Plus Academy - Complete Backend
 * Includes: Auth, Fees, Salaries, and ALL 10 Notification Triggers
 * Status: Production Ready (Refactored & Safe)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");

// --- CONFIGURATION ---
// Increased timeout to 300s (5 mins) to prevent cleanup crashes
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
  concurrency: 80,
  timeoutSeconds: 300,
});

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ==================================================================
// 🛠️ HELPER FUNCTIONS (Notification Logic)
// ==================================================================

// 1. Send Notifications (With Batching for >500 users)
const sendNotifications = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return;

  // Remove duplicates and nulls
  const uniqueTokens = [...new Set(tokens.filter((t) => t))];
  if (uniqueTokens.length === 0) return;

  // Firebase allows max 500 tokens per batch. Chunk it.
  const chunks = [];
  const chunkSize = 500;
  for (let i = 0; i < uniqueTokens.length; i += chunkSize) {
    chunks.push(uniqueTokens.slice(i, i + chunkSize));
  }

  // Send chunks in parallel
  const promises = chunks.map(async (chunk) => {
    const payload = {
      notification: { title, body },
      data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
      tokens: chunk,
    };
    try {
      return await admin.messaging().sendEachForMulticast(payload);
    } catch (error) {
      console.error("❌ Notification Chunk Error:", error);
      return null;
    }
  });

  const results = await Promise.all(promises);
  const totalSuccess = results.reduce(
    (acc, curr) => acc + (curr ? curr.successCount : 0),
    0
  );

  console.log(`📣 Notification: "${title}" sent to ${totalSuccess} devices.`);
};

// 2. Get Tokens for all users of a specific Role
const getTokensByRole = async (role) => {
  const snap = await admin
    .firestore()
    .collection("users")
    .where("role", "==", role)
    .get();
  return snap.docs.map((d) => d.data().fcmToken);
};

// 3. Get Tokens for Students in a specific Class
const getStudentTokensByClass = async (standard) => {
  if (!standard) return [];
  const snap = await admin
    .firestore()
    .collection("users")
    .where("role", "==", "student")
    .where("standard", "==", standard)
    .get();
  return snap.docs.map((d) => d.data().fcmToken);
};

// 4. Find Teachers for a specific Class
const getTeacherTokensForClass = async (targetClass) => {
  const teachersSnap = await admin
    .firestore()
    .collection("users")
    .where("role", "==", "teacher")
    .get();
  const tokens = [];

  teachersSnap.forEach((doc) => {
    const data = doc.data();
    const classes =
      data.classesTaught || (data.teachingProfile || []).map((p) => p.class);
    if (classes.includes(targetClass)) {
      if (data.fcmToken) tokens.push(data.fcmToken);
    }
  });
  return tokens;
};

// ==================================================================
// 1️⃣ CORE USER MANAGEMENT
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
    const userRole = userDoc.data()?.role || "student";

    await admin
      .auth()
      .setCustomUserClaims(targetUid, { role: userRole, verified: true });
    await admin
      .firestore()
      .collection("users")
      .doc(targetUid)
      .update({ verified: true });

    return { success: true, message: "User approved successfully." };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

// --- 3. DELETE/REJECT USER (Admin Only) ---
exports.deleteTargetUser = onCall(async (request) => {
  if (request.auth?.token?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const { targetUid } = request.data;

  try {
    // 1. Fetch user data BEFORE deleting to check status/role
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(targetUid)
      .get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const token = userData.fcmToken;
      const isPending = !userData.verified;

      if (token) {
        if (isPending) {
          // SCENARIO: REJECT
          await sendNotifications(
            [token],
            "Registration Rejected ❌",
            "Your registration request was declined by the administrator."
          );
        } else {
          // SCENARIO: DELETE
          await sendNotifications(
            [token],
            "Account Terminated ⚠️",
            "Your account has been permanently removed by the administrator."
          );
        }
      }
    }

    // 2. Perform Deletion
    await admin.auth().deleteUser(targetUid);
    await admin.firestore().collection("users").doc(targetUid).delete();

    return { success: true, message: "User processed successfully." };
  } catch (error) {
    console.error("Delete Error:", error);
    // Cleanup Firestore even if Auth fails
    try {
      await admin.firestore().collection("users").doc(targetUid).delete();
    } catch (e) {
      console.error("Firestore cleanup failed:", e);
    }

    throw new HttpsError("internal", error.message);
  }
});

// ==================================================================
// 🔔 NOTIFICATION TRIGGERS
// ==================================================================

// SCENARIO 1: Signup -> Admin Notification
exports.onUserCreated = onDocumentCreated("users/{uid}", async (event) => {
  const newUser = event.data.data();
  if (newUser.role === "admin") return;

  const adminTokens = await getTokensByRole("admin");
  await sendNotifications(
    adminTokens,
    "New Registration 📝",
    `${newUser.name} has registered as a ${newUser.role}.`
  );
});

// SCENARIO 2: Admin Updates User (Approve OR Edit Data)
// ✅ FIXED: Added Safe Sorting to prevent read-only errors
exports.onUserUpdated = onDocumentUpdated("users/{uid}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const token = after.fcmToken;

  if (!token) return;

  // --- A. APPROVAL NOTIFICATION ---
  if (!before.verified && after.verified) {
    await sendNotifications(
      [token],
      "Account Approved ✅",
      "Welcome! Your account has been verified. You can now access the app."
    );
    return;
  }

  // --- B. DATA UPDATE NOTIFICATION ---
  if (before.verified && after.verified) {
    const changes = [];

    // 1. Common Fields
    if (before.name !== after.name) changes.push("Name");
    if (before.phone !== after.phone) changes.push("Phone Number");

    // 2. Student Specific Fields
    if (after.role === "student") {
      if (before.standard !== after.standard) changes.push("Class");
      if (before.stream !== after.stream) changes.push("Stream");
      if (before.monthlyFeeAmount !== after.monthlyFeeAmount)
        changes.push("Fees");

      // FIX: Safe Sort (Create copy before sorting)
      const beforeSub = JSON.stringify(
        [...(before.enrolledSubjects || [])].sort()
      );
      const afterSub = JSON.stringify(
        [...(after.enrolledSubjects || [])].sort()
      );

      if (beforeSub !== afterSub) changes.push("Subjects");
    }

    // 3. Teacher Specific Fields
    if (after.role === "teacher") {
      if (before.salary !== after.salary) changes.push("Salary");
      if (before.salaryType !== after.salaryType) changes.push("Salary Type");

      // FIX: Safe Sort for Classes
      const beforeClasses = JSON.stringify(
        [...(before.classesTaught || [])].sort()
      );
      const afterClasses = JSON.stringify(
        [...(after.classesTaught || [])].sort()
      );
      if (beforeClasses !== afterClasses) changes.push("Classes Taught");

      // FIX: Safe Sort for Subjects
      const beforeTSub = JSON.stringify([...(before.subjects || [])].sort());
      const afterTSub = JSON.stringify([...(after.subjects || [])].sort());
      if (beforeTSub !== afterTSub) changes.push("Subjects");
    }

    // --- C. SEND NOTIFICATION ---
    if (changes.length > 0) {
      const changeStr = changes.join(", ");
      await sendNotifications(
        [token],
        "Profile Updated 🔄",
        `Admin has updated your: ${changeStr}.`
      );
    }
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

// SCENARIO 1 & 5: Leave Management (Apply & Approve/Reject)
exports.onLeaveWrite = onDocumentWritten("leaves/{id}", async (event) => {
  // A. NEW LEAVE REQUEST
  if (!event.data.before.exists && event.data.after.exists) {
    const leave = event.data.after.data();
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(leave.studentId)
      .get();

    if (!userDoc.exists) return;
    const userData = userDoc.data();

    if (userData.role === "teacher") {
      const adminTokens = await getTokensByRole("admin");
      await sendNotifications(
        adminTokens,
        "Teacher Leave Request 📅",
        `${userData.name} has applied for leave.`
      );
    } else {
      const teacherTokens = await getTeacherTokensForClass(userData.standard);
      const days = leave.duration || leave.days || "1";
      await sendNotifications(
        teacherTokens,
        "Student Leave 🤒",
        `${userData.name} (${userData.standard}) applied for ${days} days leave.`
      );
    }
    return;
  }

  // B. STATUS UPDATE
  if (event.data.before.exists && event.data.after.exists) {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status !== after.status) {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(after.studentId)
        .get();
      const token = userDoc.data()?.fcmToken;

      const emoji = after.status === "Approved" ? "✅" : "❌";
      await sendNotifications(
        [token],
        `Leave ${after.status} ${emoji}`,
        `Your leave request has been ${after.status.toLowerCase()}.`
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

    const studentTokens = await getStudentTokensByClass(classId);
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
  if (!event.data.after.exists) return;

  const course = event.data.after.data();
  const before = event.data.before.exists ? event.data.before.data() : null;

  const target = course.target || "";
  const standard = target.split(" ")[0];

  let title = "";
  let body = "";

  if (!before) {
    title = "New Course Added 📚";
    body = `New course '${course.title}' is available for ${target}.`;
  } else {
    title = "Course Updated 🔄";
    body = `'${course.title}' content has been updated. Check it out!`;
  }

  const tokens = await getStudentTokensByClass(standard);
  await sendNotifications(tokens, title, body);
});

// SCENARIO 8a: Attendance -> Student
exports.onAttendance = onDocumentCreated("attendance/{id}", async (event) => {
  const data = event.data.data();
  const studentIds = Object.keys(data.records || {});

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
    `${hw.subject}: ${hw.title}`
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
// 💰 MANUAL FEE & SALARY GENERATION (OnCall - Optimized)
// ==================================================================

exports.generateMonthlyFees = onCall(async (request) => {
  if (request.auth?.token?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const db = admin.firestore();
  const date = new Date();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  const currentTitle = `Tuition Fee - ${month} ${year}`;
  const feeDate = date.toLocaleDateString("en-GB");

  console.log(`Starting manual fee generation: ${currentTitle}`);

  const writer = db.bulkWriter();

  writer.onWriteError((error) => {
    if (error.code === 6) return false; // Ignore ALREADY_EXISTS
    return true;
  });

  try {
    const studentsStream = db
      .collection("users")
      .where("role", "==", "student")
      .where("verified", "==", true)
      .stream();

    let count = 0;

    for await (const doc of studentsStream) {
      const student = doc.data();
      const docId = `${doc.id}_${month}_${year}`;
      const feeRef = db.collection("fees").doc(docId);

      writer.create(feeRef, {
        studentId: doc.id,
        studentName: student.name || "Unknown",
        studentClass: student.standard || "N/A",
        studentPhone: student.phone || "",
        title: currentTitle,
        amount: student.monthlyFeeAmount || "5000",
        status: "Pending",
        date: feeDate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    }

    await writer.close();
    console.log(`Fee generation process handled ${count} students.`);

    return {
      success: true,
      message: `Fee generation process started for ${count} students.`,
    };
  } catch (error) {
    console.error("Error in generateMonthlyFees:", error);
    throw new HttpsError("internal", error.message);
  }
});

exports.generateMonthlySalaries = onCall(async (request) => {
  if (request.auth?.token?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const db = admin.firestore();
  const date = new Date();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  const currentTitle = `Salary - ${month} ${year}`;
  const salaryDate = date.toLocaleDateString("en-GB");

  console.log(`Starting manual salary generation: ${currentTitle}`);

  const writer = db.bulkWriter();

  writer.onWriteError((error) => {
    if (error.code === 6) return false;
    return true;
  });

  try {
    const teachersStream = db
      .collection("users")
      .where("role", "==", "teacher")
      .where("verified", "==", true)
      .where("salaryType", "==", "Fixed")
      .stream();

    let count = 0;

    for await (const doc of teachersStream) {
      const teacher = doc.data();
      const docId = `${doc.id}_${month}_${year}`;
      const salaryRef = db.collection("salaries").doc(docId);

      writer.create(salaryRef, {
        teacherId: doc.id,
        teacherName: teacher.name || "Unknown",
        teacherEmail: teacher.email || "",
        teacherPhone: teacher.phone || "",
        title: currentTitle,
        amount: teacher.salary || "0",
        status: "Pending",
        date: salaryDate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    }

    await writer.close();
    console.log(`Salary generation process handled ${count} teachers.`);

    return {
      success: true,
      message: `Salary generation process started for ${count} teachers.`,
    };
  } catch (error) {
    console.error("Error generating salaries:", error);
    throw new HttpsError("internal", error.message);
  }
});

// ==================================================================
// 🗑️ AUTOMATIC CLEANUP (Cascading Delete)
// ==================================================================

exports.cleanupUserData = onDocumentDeleted("users/{uid}", async (event) => {
  const uid = event.params.uid;
  const userData = event.data.data();
  const db = admin.firestore();

  if (!userData) return;

  console.log(
    `🗑️ Starting cleanup for ${userData.role}: ${userData.name} (${uid})`
  );

  try {
    let batch = db.batch();
    let operationCount = 0;

    const commitIfFull = async () => {
      if (operationCount >= 450) {
        await batch.commit();
        console.log("📦 Intermediate batch committed.");
        batch = db.batch();
        operationCount = 0;
      }
    };

    // --- 1. CLEANUP FOR STUDENTS ---
    if (userData.role === "student") {
      // Fees
      const feesSnap = await db
        .collection("fees")
        .where("studentId", "==", uid)
        .get();
      for (const doc of feesSnap.docs) {
        batch.delete(doc.ref);
        operationCount++;
        await commitIfFull();
      }

      // Leaves
      const leavesSnap = await db
        .collection("leaves")
        .where("studentId", "==", uid)
        .get();
      for (const doc of leavesSnap.docs) {
        batch.delete(doc.ref);
        operationCount++;
        await commitIfFull();
      }

      // Test Results
      const resultsSnap = await db
        .collection("test_results")
        .where("studentId", "==", uid)
        .get();
      for (const doc of resultsSnap.docs) {
        batch.delete(doc.ref);
        operationCount++;
        await commitIfFull();
      }

      // Exam Sheets (Map Field)
      if (userData.standard) {
        const examsSnap = await db
          .collection("exam_results")
          .where("classId", "==", userData.standard)
          .get();
        for (const doc of examsSnap.docs) {
          batch.update(doc.ref, {
            [`results.${uid}`]: admin.firestore.FieldValue.delete(),
          });
          operationCount++;
          await commitIfFull();
        }
      }

      // Attendance (Map Field)
      if (userData.standard) {
        const attendanceSnap = await db
          .collection("attendance")
          .where("classId", "==", userData.standard)
          .get();
        for (const doc of attendanceSnap.docs) {
          if (doc.data().records && doc.data().records[uid]) {
            batch.update(doc.ref, {
              [`records.${uid}`]: admin.firestore.FieldValue.delete(),
            });
            operationCount++;
            await commitIfFull();
          }
        }
      }
    }

    // --- 2. CLEANUP FOR TEACHERS ---
    if (userData.role === "teacher") {
      // Salaries
      const salarySnap = await db
        .collection("salaries")
        .where("teacherId", "==", uid)
        .get();
      for (const doc of salarySnap.docs) {
        batch.delete(doc.ref);
        operationCount++;
        await commitIfFull();
      }

      // Notices
      const noticesSnap = await db
        .collection("class_notices")
        .where("teacherId", "==", uid)
        .get();
      for (const doc of noticesSnap.docs) {
        batch.delete(doc.ref);
        operationCount++;
        await commitIfFull();
      }

      // Attendance
      const attendanceSnap = await db
        .collection("attendance")
        .where("teacherId", "==", uid)
        .get();
      for (const doc of attendanceSnap.docs) {
        batch.delete(doc.ref);
        operationCount++;
        await commitIfFull();
      }
    }

    if (operationCount > 0) {
      await batch.commit();
      console.log(
        `✅ Successfully deleted ${operationCount} related documents.`
      );
    }
  } catch (error) {
    console.error("❌ Cleanup Error:", error);
  }
});

// ==================================================================
// 🗑️ CONTENT CLEANUP (Homework & Class Notes)
// ==================================================================

const getStoragePathFromUrl = (url) => {
  try {
    const baseUrl = "https://firebasestorage.googleapis.com/v0/b/";
    if (!url.startsWith(baseUrl)) return null;

    let path = url.replace(baseUrl, "");
    const bucketEndIndex = path.indexOf("/o/");
    if (bucketEndIndex === -1) return null;

    path = path.substring(bucketEndIndex + 3);
    const queryIndex = path.indexOf("?");
    if (queryIndex !== -1) path = path.substring(0, queryIndex);

    return decodeURIComponent(path);
  } catch (e) {
    console.error("Error parsing URL:", url, e);
    return null;
  }
};

const deleteAttachments = async (data) => {
  const bucket = admin.storage().bucket();
  const filesToDelete = [];

  if (data.attachments && Array.isArray(data.attachments)) {
    data.attachments.forEach((file) => {
      if (file.url) filesToDelete.push(file.url);
    });
  }

  if (data.link) filesToDelete.push(data.link);

  const deletePromises = filesToDelete.map(async (url) => {
    const path = getStoragePathFromUrl(url);
    if (path) {
      try {
        await bucket.file(path).delete();
        console.log(`Deleted file: ${path}`);
      } catch (error) {
        if (error.code !== 404)
          console.error(`Failed to delete ${path}:`, error);
      }
    }
  });

  await Promise.all(deletePromises);
};

exports.cleanupHomework = onDocumentDeleted("homework/{id}", async (event) => {
  const data = event.data.data();
  if (data) {
    console.log(`🗑️ Cleaning up homework: ${event.params.id}`);
    await deleteAttachments(data);
  }
});

exports.cleanupMaterials = onDocumentDeleted(
  "materials/{id}",
  async (event) => {
    const data = event.data.data();
    if (data) {
      console.log(`🗑️ Cleaning up material: ${event.params.id}`);
      await deleteAttachments(data);
    }
  }
);

// SCENARIO 2, 3, 4, 5: Fee Management
exports.onFeeWrite = onDocumentWritten("fees/{id}", async (event) => {
  // A. FEE GENERATED
  if (!event.data.before.exists && event.data.after.exists) {
    const fee = event.data.after.data();
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(fee.studentId)
      .get();
    const token = userDoc.data()?.fcmToken;

    await sendNotifications(
      [token],
      "Fee Generated 💰",
      `Invoice: ${fee.title}. Amount: ₹${fee.amount}`
    );
    return;
  }

  // B. FEE UPDATED
  if (event.data.before.exists && event.data.after.exists) {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(after.studentId)
      .get();
    const studentToken = userDoc.data()?.fcmToken;

    // 1. Proof Uploaded
    const proofUploaded = !before.paymentProof && after.paymentProof;
    const statusChangedToReview =
      before.status !== "Verifying" && after.status === "Verifying";

    if (proofUploaded || statusChangedToReview) {
      const adminTokens = await getTokensByRole("admin");
      await sendNotifications(
        adminTokens,
        "Fee Payment Submitted 🧾",
        `${after.studentName} has submitted payment proof. Verify now.`
      );
    }

    // 2. Paid
    if (before.status !== "Paid" && after.status === "Paid") {
      await sendNotifications(
        [studentToken],
        "Payment Received ✅",
        `Your payment for ${after.title} has been confirmed.`
      );
    }

    // 3. Rejected
    if (before.status !== "Rejected" && after.status === "Rejected") {
      await sendNotifications(
        [studentToken],
        "Payment Rejected ❌",
        "Your fee submission was rejected. Please check comments or contact admin."
      );
    }
  }
});

// SCENARIO 2, 3, 5: Salary Management
exports.onSalaryWrite = onDocumentWritten("salaries/{id}", async (event) => {
  // A. SALARY GENERATED
  if (!event.data.before.exists && event.data.after.exists) {
    const salary = event.data.after.data();
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(salary.teacherId)
      .get();
    const token = userDoc.data()?.fcmToken;

    await sendNotifications(
      [token],
      "Salary Slip Generated 💵",
      `Payslip for ${salary.title} is now available.`
    );
    return;
  }

  // B. SALARY PAID
  if (event.data.before.exists && event.data.after.exists) {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.status !== "Paid" && after.status === "Paid") {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(after.teacherId)
        .get();
      const token = userDoc.data()?.fcmToken;

      await sendNotifications(
        [token],
        "Salary Credited 🏦",
        `Your salary for ${after.title} has been marked as Paid.`
      );
    }
  }
});
 
