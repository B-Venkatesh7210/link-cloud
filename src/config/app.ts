/**
 * Central product identity. Rename here when the temporary name changes.
 */
export const APP_NAME = "LinkCloud" as const;

export const APP_TAGLINE = "Your visual URL memory." as const;

export const APP_DESCRIPTION =
  "Save the links you reach for every day on a calm, searchable sky canvas." as const;

export const APP_ROUTES = {
  home: "/",
  login: "/login",
  authCallback: "/auth/callback",
  app: "/app",
  settings: "/settings",
  privacy: "/privacy",
} as const;

export const APP_HERO =
  "Every important link. Exactly where you remember it." as const;

export const APP_SUPPORTING =
  "Save work links once. Find them again by what you remember." as const;
