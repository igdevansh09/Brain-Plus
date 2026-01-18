🎓 Brain Plus Academy - Coaching Management App
===============================================

**Brain Plus** is a comprehensive, full-stack mobile application designed to digitize the operations of a coaching institute. Built with **React Native (Expo)** and **Firebase**, it provides a seamless experience for Administrators, Teachers, and Students to manage academics, administrative tasks, and communication.

* * * * *

🚀 Overview
-----------

This application utilizes a **Role-Based Access Control (RBAC)** system to serve three distinct user types:

1.  **Admin:** Complete control over the institute's data, user management, and finances.

2.  **Teacher:** Tools to manage classrooms, attendance, homework, and view payroll.

3.  **Student:** Access to learning materials, attendance tracking, fee status, and notices.

* * * * *

✨ Key Features
--------------

### 🛡️ Admin Module

-   **Dashboard:** High-level statistics on students, teachers, and finances.

-   **User Management:** Create and manage profiles for Students and Teachers.

-   **Fee Management:** Track paid and pending fees, view financial reports.

-   **Leave Management:** Approve or reject leave applications from teachers and students.

-   **Content Management:** Upload global notices and manage course structures.

-   **Notifications:** Send alerts to specific groups (All, Teachers, Students).

### 👨‍🏫 Teacher Module

-   **Attendance System:** Mark student attendance using a calendar interface.

-   **Academic Uploads:** Upload Homework and Class Notes (PDFs/Images) to specific classes.

-   **My Students:** View list of assigned students and contact details.

-   **Salary Status:** View salary payment history and pending dues.

-   **Leave Requests:** Apply for leave and track status.

-   **Exam Results:** Upload test scores for students.

### 👨‍🎓 Student Module

-   **Learning Hub:** Access Video Courses, Class Notes, and Homework assignments.

-   **Performance:** View Test Scores and Attendance history.

-   **Fee Status:** Check pending dues and payment history (with QR code integration for manual payments).

-   **Leave Application:** Apply for leave and notify teachers/admin.

-   **Dashboard:** Quick view of recent notices and daily schedule.

* * * * *

🛠️ Tech Stack
--------------

### Frontend

-   **Framework:** [React Native](https://reactnative.dev/) via [Expo SDK 52](https://expo.dev/).

-   **Routing:** [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing).

-   **Styling:** [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native).

-   **Icons:** `@expo/vector-icons`.

-   **Media:** `expo-av` (Video), `react-native-pdf`, `expo-image-picker`, `expo-document-picker`.

### Backend (Firebase)

-   **Authentication:** Firebase Auth (Email/Password).

-   **Database:** Cloud Firestore (NoSQL).

-   **Storage:** Firebase Storage (Profile pics, PDFs, Homework images).

-   **Serverless:** Firebase Cloud Functions (Node.js) for setting Admin claims.

### Tools & DevOps

-   **Build Service:** EAS (Expo Application Services).

-   **Linting:** ESLint.

* * * * *

📂 Project Structure
--------------------

The project follows the **Expo Router** directory structure:

```
brain-plus/
├── app/                        # Main application logic (Routes)
│   ├── (admin)/                # Protected Admin Routes
│   ├── (auth)/                 # Authentication Screens (Login/Signup)
│   ├── (guest)/                # Guest/Preview Routes
│   ├── (student)/              # Protected Student Routes
│   ├── (teacher)/              # Protected Teacher Routes
│   ├── _layout.jsx             # Root Layout & Context Providers
│   └── index.jsx               # Entry Point (Splash/Redirect Logic)
├── assets/                     # Images and Fonts
├── components/                 # Reusable UI Components (Headers, Cards, Alerts)
├── config/                     # Firebase Configuration
├── context/                    # React Context (Auth, Theme, Toast)
├── functions/                  # Firebase Cloud Functions (Backend logic)
├── utils/                      # Helper functions and Schemas
├── babel.config.js             # Babel Setup (NativeWind plugin)
├── eas.json                    # EAS Build Configuration
├── firebase.json               # Firebase Hosting/Functions Config
└── tailwind.config.js          # Tailwind Configuration

```

* * * * *

⚙️ Installation & Setup
-----------------------

### Prerequisites

-   Node.js (LTS version)

-   npm or yarn

-   Expo CLI (`npm install -g eas-cli`)

-   A Firebase Project

### 1\. Clone the Repository

Bash

```
git clone https://github.com/your-username/brain-plus.git
cd brain-plus

```

### 2\. Install Dependencies

Bash

```
npm install

```

### 3\. Firebase Configuration

1.  Create a project in the [Firebase Console](https://console.firebase.google.com/).

2.  Enable **Authentication**, **Firestore**, and **Storage**.

3.  Download `google-services.json` (for Android) and place it in the root directory.

4.  Update `config/firebaseConfig.js` with your web credentials if necessary.

### 4\. Admin Setup (Cloud Functions)

To utilize the Admin role, you must deploy the Cloud Functions to set custom claims.

Bash

```
cd functions
npm install
# Ensure you have firebase-tools installed globally
firebase login
firebase deploy --only functions

```

*Note: You may need to manually run the `setAdmin` script or use a script to assign the "admin" role to your first user.*

### 5\. Run the App

Bash

```
npx expo start

```

-   Press `a` for Android Emulator.

-   Press `i` for iOS Simulator.

-   Scan the QR code with the Expo Go app on a physical device.

* * * * *

📱 Navigation & Routing
-----------------------

The app uses **File-based routing** via Expo Router. Access control is handled in `app/_layout.jsx` and `context/AuthContext.js`.

-   **Group Syntax:** `(admin)`, `(teacher)`, etc., represent route groups that share a layout but don't affect the URL path.

-   **Protection:** The `AuthContext` listens to the user's role (stored in Firestore `users/{uid}`) and redirects them to the appropriate dashboard upon login.

* * * * *

🎨 UI/UX Design
---------------

-   **Dark/Light Mode:** Fully supported via `ThemeContext`.

-   **Responsive:** Uses `ScreenWrapper` component to handle Safe Area Insets (Notches/Islands) consistently.

-   **Custom Components:**

    -   `CustomHeader`: Standardized navigation header.

    -   `CustomToast`: In-app notification feedback.

    -   `AnimatedSplashScreen`: Custom loading experience.

* * * * *

📦 Build & Deployment
---------------------

This project is configured for **EAS Build**.

**To build for Android:**

Bash

```
eas build --profile preview --platform android

```

**To build for Production:**

Bash

```
eas build --profile production --platform android

```

* * * * *

🤝 Contribution
---------------

1.  Fork the repository.

2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).

3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).

4.  Push to the branch (`git push origin feature/AmazingFeature`).

5.  Open a Pull Request.

* * * * *

📄 License
----------

Distributed under the MIT License. See `LICENSE` for more information.

* * * * *

**Developed by Devansh Gupta 😋**
