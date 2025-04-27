// Mock implementation for Supabase client during development
const mockUsers = new Map();
const mockUserSessions = new Map();

// Generate a random UUID
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Mock Supabase client for development
export const mockSupabase = {
  auth: {
    signUp: async ({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: any;
    }) => {
      console.log("[MOCK] Signing up user:", email);

      // Check if user already exists
      if (mockUsers.has(email)) {
        return {
          data: { user: null, session: null },
          error: { message: "User already exists" },
        };
      }

      // Create a new user
      const userId = generateUUID();
      const user = {
        id: userId,
        email,
        created_at: new Date().toISOString(),
      };

      mockUsers.set(email, { user, password });

      return {
        data: { user, session: null },
        error: null,
      };
    },

    signInWithPassword: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      console.log("[MOCK] Signing in user:", email);

      // Check if user exists and password matches
      const userData = mockUsers.get(email);
      if (!userData || userData.password !== password) {
        return {
          data: { user: null, session: null },
          error: { message: "Invalid login credentials" },
        };
      }

      // Create a session
      const session = {
        id: generateUUID(),
        user: userData.user,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      };

      mockUserSessions.set(email, session);

      return {
        data: { user: userData.user, session },
        error: null,
      };
    },

    signOut: async () => {
      console.log("[MOCK] Signing out user");
      return { error: null };
    },

    getUser: async () => {
      // For simplicity, return the first user in development
      const firstUser =
        mockUsers.size > 0
          ? { user: Array.from(mockUsers.values())[0].user }
          : { user: null };

      return {
        data: firstUser,
        error: null,
      };
    },

    exchangeCodeForSession: async (code: string) => {
      console.log("[MOCK] Exchanging code for session:", code);
      return { error: null };
    },

    updateUser: async (updates: any) => {
      console.log("[MOCK] Updating user:", updates);
      return { error: null };
    },
  },

  from: (table: string) => {
    return {
      select: (columns: string) => {
        return {
          eq: (column: string, value: any) => {
            return {
              single: async () => {
                console.log(
                  `[MOCK] Selecting from ${table} where ${column} = ${value}`
                );
                if (table === "profiles") {
                  // Return mock profile
                  return {
                    data: {
                      id: value,
                      full_name: "Mock User",
                      created_at: new Date().toISOString(),
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
              order: (
                column: string,
                { ascending }: { ascending: boolean }
              ) => {
                console.log(
                  `[MOCK] Ordering by ${column} ${ascending ? "ASC" : "DESC"}`
                );
                if (table === "detection_events") {
                  // Return mock events
                  const mockEvents = [
                    {
                      id: generateUUID(),
                      created_at: new Date().toISOString(),
                      user_id: value,
                      object_type: "person",
                      confidence: 0.95,
                    },
                    {
                      id: generateUUID(),
                      created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                      user_id: value,
                      object_type: "car",
                      confidence: 0.87,
                    },
                  ];
                  return {
                    data: mockEvents,
                    error: null,
                  };
                }
                return { data: [], error: null };
              },
            };
          },
        };
      },
      upsert: async (data: any) => {
        console.log(`[MOCK] Upserting into ${table}:`, data);
        return { error: null };
      },
    };
  },
};
