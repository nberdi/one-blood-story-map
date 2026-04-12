export const STORY_MAX_WORDS = 600;
export const SHARE_TEXT_MAX_WORDS = 100;
export const NAME_MAX_LENGTH = 80;
export const HOMETOWN_MAX_LENGTH = 120;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const GRAD_YEAR_MIN = 1900;
export const GRAD_YEAR_MAX = new Date().getFullYear() + 10;
export const SOCIAL_LINK_MAX_LENGTH = 200;
export const PRONOUNS_MAX_LENGTH = 40;
export const PRONOUN_OPTIONS = [
  { value: "he/him", label: "he/him" },
  { value: "she/her", label: "she/her" },
  { value: "they/them", label: "they/them" },
  { value: "other", label: "other" },
];

export const SOCIAL_PLATFORM_OPTIONS = [
  {
    value: "instagram",
    label: "Instagram",
    baseUrl: "https://www.instagram.com/",
  },
  {
    value: "facebook",
    label: "Facebook",
    baseUrl: "https://www.facebook.com/",
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    baseUrl: "https://www.linkedin.com/in/",
  },
];
export const SOCIAL_LINK_MAX_COUNT = SOCIAL_PLATFORM_OPTIONS.length;

const SOCIAL_PLATFORM_MAP = SOCIAL_PLATFORM_OPTIONS.reduce((map, platform) => {
  map[platform.value] = platform;
  return map;
}, {});

const SOCIAL_PLATFORM_HOSTS = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  linkedin: ["linkedin.com"],
};

export const ALLOWED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".webm",
  ".ogg",
];
export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/webm",
  "audio/ogg",
];

export const AUDIO_ACCEPT_ATTR = ".mp3,.wav,.m4a,.aac,.webm,.ogg,audio/*";
export const AUDIO_HELPER_TEXT =
  "Accepted formats: .mp3, .wav, .m4a, .aac, .webm, .ogg (max 10MB).";
export const SOCIAL_HELPER_TEXT =
  "Add up to 3 links total: one each for Instagram, Facebook, and LinkedIn.";

export function sanitizeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function getWordCount(value) {
  if (typeof value !== "string") return 0;
  const normalized = value.trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

export function sanitizeStoryText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function sanitizeGraduationYear(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;

  const numericYear = Number(value);
  if (!Number.isInteger(numericYear)) return Number.NaN;
  return numericYear;
}

export function isValidGraduationYear(year) {
  return (
    Number.isInteger(year) && year >= GRAD_YEAR_MIN && year <= GRAD_YEAR_MAX
  );
}

function sanitizeCountryCode(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function sanitizeHometownLocation(location) {
  if (!location || typeof location !== "object") return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const label = sanitizeText(location.label, HOMETOWN_MAX_LENGTH);
  const countryCode = sanitizeCountryCode(location.countryCode);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    return null;
  if (!label) return null;

  return { latitude, longitude, label, countryCode };
}

function sanitizePronounsSelection(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const allowedValues = PRONOUN_OPTIONS.map((option) => option.value);
  return allowedValues.includes(trimmed) ? trimmed : null;
}

function resolvePronouns(selection, otherInput) {
  if (!selection) return null;
  if (selection === "other")
    return sanitizeText(otherInput, PRONOUNS_MAX_LENGTH);
  return selection;
}

function getPlatformConfig(platform) {
  if (typeof platform !== "string") return null;
  return SOCIAL_PLATFORM_MAP[platform.toLowerCase().trim()] || null;
}

function isHttpUrl(value) {
  return value.startsWith("https://") || value.startsWith("http://");
}

function hasMatchingDomain(platform, parsedUrl) {
  const platformHosts = SOCIAL_PLATFORM_HOSTS[platform] || [];
  const hostname = parsedUrl.hostname.toLowerCase();
  return platformHosts.some((allowedHost) => {
    const host = allowedHost.toLowerCase();
    return hostname === host || hostname.endsWith(`.${host}`);
  });
}

function buildSocialUrl(platform, rawValue) {
  const platformConfig = getPlatformConfig(platform);
  if (!platformConfig) {
    return { url: null, error: "Unsupported social media platform." };
  }

  const sanitizedValue = sanitizeText(rawValue, SOCIAL_LINK_MAX_LENGTH);
  if (!sanitizedValue) {
    return {
      url: null,
      error: `${platformConfig.label} profile link is required.`,
    };
  }

  if (isHttpUrl(sanitizedValue)) {
    try {
      const parsedUrl = new URL(sanitizedValue);
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        return {
          url: null,
          error: `${platformConfig.label} link must start with https:// or http://.`,
        };
      }
      if (!hasMatchingDomain(platformConfig.value, parsedUrl)) {
        return {
          url: null,
          error: `${platformConfig.label} link must point to ${platformConfig.label}.`,
        };
      }
      return { url: parsedUrl.toString(), error: "" };
    } catch {
      return { url: null, error: `Invalid ${platformConfig.label} URL.` };
    }
  }

  const handle = sanitizedValue.replace(/^@+/, "").replace(/\s+/g, "");
  if (!handle) {
    return { url: null, error: `${platformConfig.label} handle is invalid.` };
  }

  return { url: `${platformConfig.baseUrl}${handle}`, error: "" };
}

function normalizeSocialInputEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries.slice(0, SOCIAL_LINK_MAX_COUNT).map((entry) => ({
    platform:
      typeof entry?.platform === "string"
        ? entry.platform.toLowerCase().trim()
        : "",
    value: sanitizeText(entry?.value, SOCIAL_LINK_MAX_LENGTH) || "",
  }));
}

export function normalizeSocialLinks(entries) {
  const normalizedInput = normalizeSocialInputEntries(entries);
  const dedupedLinks = [];
  const seenPlatforms = new Set();

  normalizedInput.forEach((entry) => {
    if (!entry.platform || !entry.value) return;
    if (!getPlatformConfig(entry.platform)) return;
    if (seenPlatforms.has(entry.platform)) return;

    const { url, error } = buildSocialUrl(entry.platform, entry.value);
    if (error || !url) return;

    seenPlatforms.add(entry.platform);
    dedupedLinks.push({ platform: entry.platform, url });
  });

  return dedupedLinks;
}

export function getSocialLinksValidationError(entries) {
  if (!Array.isArray(entries)) return "";

  if (entries.length > SOCIAL_LINK_MAX_COUNT) {
    return `You can add up to ${SOCIAL_LINK_MAX_COUNT} social links.`;
  }

  const normalizedInput = normalizeSocialInputEntries(entries);
  const seenPlatforms = new Set();

  for (let index = 0; index < normalizedInput.length; index += 1) {
    const entry = normalizedInput[index];
    const rowNumber = index + 1;
    const hasPlatform = Boolean(entry.platform);
    const hasValue = Boolean(entry.value);

    if (!hasPlatform && !hasValue) continue;

    if (!hasPlatform || !hasValue) {
      return `Complete social link #${rowNumber} or remove it.`;
    }

    const platformConfig = getPlatformConfig(entry.platform);
    if (!platformConfig) {
      return `Social link #${rowNumber} uses an unsupported platform.`;
    }

    if (seenPlatforms.has(entry.platform)) {
      return `${platformConfig.label} can only be added once.`;
    }
    seenPlatforms.add(entry.platform);

    const { error } = buildSocialUrl(entry.platform, entry.value);
    if (error) return `Social link #${rowNumber}: ${error}`;
  }

  return "";
}

export function normalizeSubmissionValues(values) {
  const pronounsSelection = sanitizePronounsSelection(
    values?.pronounsSelection,
  );

  return {
    name: sanitizeText(values?.name, NAME_MAX_LENGTH),
    hometown: sanitizeText(values?.hometown, HOMETOWN_MAX_LENGTH),
    story: sanitizeStoryText(values?.story),
    shareText: sanitizeStoryText(values?.shareText),
    graduationYear: sanitizeGraduationYear(values?.graduationYear),
    pronounsSelection,
    pronouns: resolvePronouns(pronounsSelection, values?.pronounsOther),
    hometownLocation: sanitizeHometownLocation(values?.hometownLocation),
    socialLinks: normalizeSocialInputEntries(values?.socialLinks),
    audioFile: values?.audioFile || null,
    removeAudio: Boolean(values?.removeAudio),
  };
}

export function getAudioValidationError(file) {
  if (!file) return "";

  const fileName = (file.name || "").toLowerCase();
  const hasAllowedExtension = ALLOWED_AUDIO_EXTENSIONS.some((extension) =>
    fileName.endsWith(extension),
  );

  if (!hasAllowedExtension) {
    return "Unsupported audio format. Use .mp3, .wav, .m4a, .aac, .webm, or .ogg.";
  }

  const mimeType = (file.type || "").toLowerCase();
  const hasAllowedMimeType =
    Boolean(mimeType) &&
    (ALLOWED_AUDIO_MIME_TYPES.includes(mimeType) ||
      mimeType.startsWith("audio/"));

  if (!hasAllowedMimeType) {
    return "Invalid audio file type. Please choose a valid audio file.";
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return "Audio file is too large. Please upload a file up to 10MB.";
  }

  return "";
}

export function validateStorySubmission(values) {
  if (!values?.name) {
    return "Name is required.";
  }

  if (!values?.pronounsSelection) {
    return "Pronouns are required.";
  }

  if (!values?.hometown) {
    return "Hometown is required.";
  }

  if (values?.graduationYear === null || values?.graduationYear === undefined) {
    return "Graduation year is required.";
  }

  if (Number.isNaN(values?.graduationYear)) {
    return "Graduation year must be a valid number.";
  }

  if (values?.graduationYear !== null && values?.graduationYear !== undefined) {
    if (!isValidGraduationYear(values.graduationYear)) {
      return `Graduation year must be between ${GRAD_YEAR_MIN} and ${GRAD_YEAR_MAX}.`;
    }
  }

  if (values?.pronounsSelection === "other" && !values?.pronouns) {
    return "Please enter your pronouns in the Other field.";
  }

  if (getWordCount(values?.story) > STORY_MAX_WORDS) {
    return `Story must be ${STORY_MAX_WORDS} words or fewer.`;
  }

  if (getWordCount(values?.shareText) > SHARE_TEXT_MAX_WORDS) {
    return `Share text must be ${SHARE_TEXT_MAX_WORDS} words or fewer.`;
  }

  const socialError = getSocialLinksValidationError(values?.socialLinks);
  if (socialError) return socialError;

  if (values.audioFile) {
    return getAudioValidationError(values.audioFile);
  }

  return "";
}
