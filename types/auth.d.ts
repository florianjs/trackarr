declare module '#auth-utils' {
  interface User {
    id: string;
    username: string;
    isAdmin: boolean;
    isModerator: boolean;
    uploaded: number;
    downloaded: number;
  }

  interface UserSession {
    user: User;
    loggedInAt: number;
    // users.session_version at sign-in: a bump revokes the cookie
    sessionVersion?: number;
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
