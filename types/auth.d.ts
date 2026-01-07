declare module '#auth-utils' {
  interface User {
    id: string;
    username: string;
    passkey: string; // Private - never expose in public API responses
    isAdmin: boolean;
    isModerator: boolean;
    uploaded: number;
    downloaded: number;
  }

  interface UserSession {
    user: User;
    loggedInAt: number;
  }
}

// Public user type - safe to return in API responses (excludes passkey)
export interface PublicUser {
  id: string;
  username: string;
  isAdmin: boolean;
  isModerator: boolean;
  uploaded: number;
  downloaded: number;
}

export {};
