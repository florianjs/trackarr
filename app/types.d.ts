declare module '#auth-utils' {
  interface User {
    id: string;
    username: string;
    email: string;
    passkey: string;
    isAdmin: boolean;
    isModerator: boolean;
    uploaded: number;
    downloaded: number;
  }

  interface UserSession {
    user: User;
    loggedInAt: number;
  }

  interface SecureSessionData {
    // Server-only session data
  }
}

export {};
