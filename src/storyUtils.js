import {
  GRAD_YEAR_MAX,
  GRAD_YEAR_MIN,
  HOMETOWN_MAX_LENGTH,
  MAJOR_MAX_LENGTH,
  NAME_MAX_LENGTH,
  OCCUPATION_MAX_LENGTH,
  PRONOUNS_MAX_LENGTH,
  SOCIAL_PLATFORM_OPTIONS,
  isValidGraduationYear,
  normalizeSocialLinks,
  sanitizeGraduationYear,
  sanitizeStoryText,
  sanitizeText,
} from "./storyValidation";

export const AUDIO_BUCKET = "story-audio";
export const IMAGE_BUCKET = "story-images";
export const STORIES_FETCH_LIMIT = 500;

function sanitizeCountryCode(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function sanitizeProfileList(value, maxItemLength) {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const dedupedValues = [];
  const seen = new Set();

  rawList.forEach((item) => {
    const sanitizedItem = sanitizeText(item, maxItemLength);
    if (!sanitizedItem) return;

    const normalizedItem = sanitizedItem.toLowerCase();
    if (seen.has(normalizedItem)) return;

    seen.add(normalizedItem);
    dedupedValues.push(sanitizedItem);
  });

  return dedupedValues;
}

export function getStoryType(hasTextStory, hasAudioStory) {
  if (hasTextStory && hasAudioStory) return "both";
  if (hasAudioStory) return "audio";
  if (hasTextStory) return "text";
  return "profile";
}

export function buildAudioFilePath(fileName) {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "webm";
  const safeExtension = (extension || "webm")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `stories/${Date.now()}-${randomSuffix}.${safeExtension || "webm"}`;
}

export function buildImageFilePath(fileName) {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "jpg";
  const safeExtension = (extension || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `stories/${Date.now()}-${randomSuffix}.${safeExtension || "jpg"}`;
}

function sanitizePublicHttpUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsedUrl = new URL(trimmed);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")
      return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function sanitizeAudioUrl(value) {
  return sanitizePublicHttpUrl(value);
}

export function sanitizeImageUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) return trimmed;
  return sanitizePublicHttpUrl(trimmed);
}

export function sanitizeStoryRow(row) {
  if (!row || row.id === null || row.id === undefined) return null;

  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    return null;

  const story = sanitizeStoryText(row.story);
  const shareText = sanitizeStoryText(row.share_text);
  const audioUrl = sanitizeAudioUrl(row.audio_url);
  const imageUrl = sanitizeImageUrl(row.image_url);
  const parsedGradYear = sanitizeGraduationYear(row.graduation_year);
  const graduationYear = isValidGraduationYear(parsedGradYear)
    ? parsedGradYear
    : null;
  const socialLinksRaw = Array.isArray(row.social_links)
    ? row.social_links.map((link) => ({
        platform: link?.platform,
        value: link?.url,
      }))
    : [];
  const socialLinks = normalizeSocialLinks(socialLinksRaw);
  const majors = sanitizeProfileList(row.majors, MAJOR_MAX_LENGTH);
  const occupations = sanitizeProfileList(
    row.occupations,
    OCCUPATION_MAX_LENGTH,
  );

  return {
    id: row.id,
    user_id: row.user_id || null,
    name: sanitizeText(row.name, NAME_MAX_LENGTH),
    hometown: sanitizeText(row.hometown, HOMETOWN_MAX_LENGTH),
    country_code: sanitizeCountryCode(row.country_code),
    story,
    share_text: shareText,
    audio_url: audioUrl,
    image_url: imageUrl,
    story_type:
      row.story_type || getStoryType(Boolean(story), Boolean(audioUrl)),
    graduation_year: graduationYear,
    pronouns: sanitizeText(row.pronouns, PRONOUNS_MAX_LENGTH),
    social_links: socialLinks,
    majors,
    occupations,
    latitude,
    longitude,
    created_at: row.created_at || null,
  };
}

export function sanitizeStoryRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(sanitizeStoryRow).filter(Boolean);
}

export function getStoryTypeFromRecord(story) {
  const rawType =
    typeof story?.story_type === "string" ? story.story_type.toLowerCase() : "";
  if (
    rawType === "text" ||
    rawType === "audio" ||
    rawType === "both" ||
    rawType === "profile"
  ) {
    return rawType;
  }
  return getStoryType(Boolean(story?.story), Boolean(story?.audio_url));
}

export function getStoryTypeLabel(storyType) {
  if (storyType === "audio") return "Audio";
  if (storyType === "both") return "Text + Audio";
  if (storyType === "profile") return "Profile";
  return "Text";
}

export function getSocialPlatformLabel(platform) {
  const match = SOCIAL_PLATFORM_OPTIONS.find((item) => item.value === platform);
  return match?.label || "Profile";
}

export function getGraduationYearLabel(graduationYear) {
  if (!isValidGraduationYear(graduationYear)) return "";
  return `Class of ${graduationYear}`;
}

export function getGraduationYearOptions(stories) {
  if (!Array.isArray(stories)) return [];

  const years = new Set();
  stories.forEach((story) => {
    const year = sanitizeGraduationYear(story?.graduation_year);
    if (isValidGraduationYear(year)) years.add(year);
  });

  return [...years].sort((a, b) => b - a);
}

export function getGraduationYearBoundsText() {
  return `${GRAD_YEAR_MIN}-${GRAD_YEAR_MAX}`;
}

export function formatStoryDate(createdAt) {
  if (!createdAt) return "";
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getStoryPreview(storyText, hasAudio, maxLength = 100) {
  const cleanedStory = sanitizeStoryText(storyText);
  if (!cleanedStory) {
    return hasAudio
      ? "Audio story available. Press play to listen."
      : "No text story available.";
  }

  if (cleanedStory.length <= maxLength) return cleanedStory;
  return `${cleanedStory.slice(0, maxLength - 1)}…`;
}

export function getCountryFlagEmoji(countryCode) {
  const sanitizedCode = sanitizeCountryCode(countryCode);
  if (!sanitizedCode) return "";

  const codePoints = [...sanitizedCode].map(
    (char) => 127397 + char.charCodeAt(0),
  );
  return String.fromCodePoint(...codePoints);
}

export function getHometownWithFlag(hometown, countryCode) {
  const safeHometown = sanitizeText(hometown, HOMETOWN_MAX_LENGTH);
  if (!safeHometown) return "Unknown hometown";

  const flag = getCountryFlagEmoji(countryCode);
  return flag ? `${safeHometown} ${flag}` : safeHometown;
}
