export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
export const USERNAME_HELP = "Use 3–30 letters, numbers, dots or underscores.";

export const normalizeUsername = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
