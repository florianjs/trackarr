declare module '#auth-utils' {
  interface User {
    id: string;
    username: string;
    isAdmin: boolean;
    isModerator: boolean;
    uploaded: number;
    downloaded: number;
    // Paid registration: locked until the sign-up payment is confirmed
    paymentPending?: boolean;
    // Multi-account guard: held until staff approve an appeal
    ipHold?: boolean;
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
  paymentPending?: boolean;
  ipHold?: boolean;
}

export {};
