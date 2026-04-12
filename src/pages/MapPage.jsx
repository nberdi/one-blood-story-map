import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "../Header";
import Map from "../Map";
import StorySidebar from "../StorySidebar";
import AddStoryModal from "../AddStoryModal";
import StoryCardModal from "../components/StoryCardModal";
import AudioPlayerModal from "../components/AudioPlayerModal";
import StoryReaderModal from "../components/StoryReaderModal";
import { geocodeHometown } from "../hometownSearch";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "../router";
import { supabase, supabaseConfigError } from "../supabaseClient";
import {
  downloadStoryCardBlob,
  generateStoryCard,
  STORY_CARD_FILENAME,
} from "../utils/generateStoryCard";
import {
  PRONOUN_OPTIONS,
  normalizeSocialLinks,
  normalizeSubmissionValues,
  validateStorySubmission,
} from "../storyValidation";
import {
  AUDIO_BUCKET,
  STORIES_FETCH_LIMIT,
  buildAudioFilePath,
  getGraduationYearOptions,
  getStoryType,
  sanitizeAudioUrl,
  sanitizeStoryRow,
  sanitizeStoryRows,
} from "../storyUtils";

const STORY_SELECT_FIELDS_BASE =
  "id,name,pronouns,hometown,country_code,story,audio_url,story_type,graduation_year,social_links,latitude,longitude,created_at,user_id";

function getStorySelectFields({ includeShareText, includeProfileDetails }) {
  const selectFields = [STORY_SELECT_FIELDS_BASE];
  if (includeShareText) selectFields.push("share_text");
  if (includeProfileDetails) selectFields.push("majors", "occupations");
  return selectFields.join(",");
}

function getMissingOptionalColumns(error) {
  const detailText =
    `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  const missingColumns = new Set();

  if (
    (detailText.includes("share_text") && detailText.includes("column")) ||
    detailText.includes("share_text does not exist")
  ) {
    missingColumns.add("share_text");
  }

  if (
    (detailText.includes("majors") && detailText.includes("column")) ||
    detailText.includes("majors does not exist")
  ) {
    missingColumns.add("majors");
  }

  if (
    (detailText.includes("occupations") && detailText.includes("column")) ||
    detailText.includes("occupations does not exist")
  ) {
    missingColumns.add("occupations");
  }

  return missingColumns;
}

function includesQuery(value, query) {
  return typeof value === "string" && value.toLowerCase().includes(query);
}

function includesListQuery(values, query) {
  if (!Array.isArray(values)) return false;
  return values.some((value) => includesQuery(value, query));
}

function matchesListValue(values, selectedValue) {
  if (!Array.isArray(values)) return false;
  const normalizedSelection = selectedValue.trim().toLowerCase();
  if (!normalizedSelection) return true;
  return values.some(
    (value) =>
      typeof value === "string" &&
      value.trim().toLowerCase() === normalizedSelection,
  );
}

function getPronounsInitialValues(pronounsValue) {
  if (typeof pronounsValue !== "string") {
    return { pronounsSelection: "", pronounsOther: "" };
  }

  const trimmedPronouns = pronounsValue.trim();
  if (!trimmedPronouns) {
    return { pronounsSelection: "", pronounsOther: "" };
  }

  const normalizedPronouns = trimmedPronouns.toLowerCase();
  const knownPronouns = new Set(PRONOUN_OPTIONS.map((option) => option.value));

  if (knownPronouns.has(normalizedPronouns) && normalizedPronouns !== "other") {
    return { pronounsSelection: normalizedPronouns, pronounsOther: "" };
  }

  return { pronounsSelection: "other", pronounsOther: trimmedPronouns };
}

export default function MapPage() {
  const { user, isVerified, authLoading, authError, refreshUser, signOut } =
    useAuth();
  const { navigate } = useRouter();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStoryCardModalOpen, setIsStoryCardModalOpen] = useState(false);
  const [storyCardBlob, setStoryCardBlob] = useState(null);
  const [storyCardPreviewUrl, setStoryCardPreviewUrl] = useState("");
  const [storyReaderStory, setStoryReaderStory] = useState(null);
  const [audioPlayerStory, setAudioPlayerStory] = useState(null);
  const [supportsShareText, setSupportsShareText] = useState(true);
  const [supportsProfileDetails, setSupportsProfileDetails] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [majorFilter, setMajorFilter] = useState("");
  const [occupationFilter, setOccupationFilter] = useState("");
  const [graduationYearFilter, setGraduationYearFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const fetchRequestIdRef = useRef(0);
  const isSavingRef = useRef(false);

  useEffect(
    () => () => {
      if (storyCardPreviewUrl) {
        URL.revokeObjectURL(storyCardPreviewUrl);
      }
    },
    [storyCardPreviewUrl],
  );

  const fetchStories = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++fetchRequestIdRef.current;
      if (!silent) setLoading(true);
      setLoadError("");

      if (!supabase) {
        const configMessage =
          supabaseConfigError ||
          "Supabase is not configured. Check your environment variables.";
        setLoadError(configMessage);
        if (!silent && requestId === fetchRequestIdRef.current)
          setLoading(false);
        return { success: false, error: configMessage };
      }

      try {
        let includeShareText = supportsShareText;
        let includeProfileDetails = supportsProfileDetails;
        let data = null;
        let fetchError = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const selectFields = getStorySelectFields({
            includeShareText,
            includeProfileDetails,
          });
          const fetchResult = await supabase
            .from("stories")
            .select(selectFields)
            .order("created_at", { ascending: false })
            .limit(STORIES_FETCH_LIMIT);

          data = fetchResult.data;
          fetchError = fetchResult.error;

          if (!fetchError) break;

          const missingColumns = getMissingOptionalColumns(fetchError);
          let shouldRetry = false;

          if (includeShareText && missingColumns.has("share_text")) {
            includeShareText = false;
            setSupportsShareText(false);
            shouldRetry = true;
          }
          if (
            includeProfileDetails &&
            (missingColumns.has("majors") || missingColumns.has("occupations"))
          ) {
            includeProfileDetails = false;
            setSupportsProfileDetails(false);
            shouldRetry = true;
          }

          if (!shouldRetry) break;
        }

        if (requestId !== fetchRequestIdRef.current) {
          return { success: false, stale: true };
        }

        if (fetchError) {
          console.error("Error loading stories:", fetchError);
          setLoadError("Could not load stories right now.");
          return {
            success: false,
            error: fetchError.message || "Fetch failed",
          };
        }

        const sanitizedStories = sanitizeStoryRows(data || []);
        setStories(sanitizedStories);
        setSelectedStoryId((currentId) =>
          sanitizedStories.some((story) => story.id === currentId)
            ? currentId
            : null,
        );

        return { success: true };
      } catch (unexpectedError) {
        if (requestId === fetchRequestIdRef.current) {
          console.error("Unexpected error loading stories:", unexpectedError);
          setLoadError("Unexpected error while loading stories.");
        }
        return {
          success: false,
          error: unexpectedError?.message || "Unexpected fetch error",
        };
      } finally {
        if (!silent && requestId === fetchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [supportsProfileDetails, supportsShareText],
  );

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const filteredStories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const majorQuery = majorFilter.trim().toLowerCase();
    const occupationQuery = occupationFilter.trim().toLowerCase();

    let nextStories = stories.filter((story) => {
      if (query) {
        const searchMatch =
          includesQuery(story.name, query) ||
          includesQuery(story.hometown, query) ||
          includesQuery(story.story, query) ||
          includesListQuery(story.majors, query) ||
          includesListQuery(story.occupations, query);
        if (!searchMatch) return false;
      }

      if (majorQuery && !matchesListValue(story.majors, majorQuery)) {
        return false;
      }

      if (
        occupationQuery &&
        !matchesListValue(story.occupations, occupationQuery)
      ) {
        return false;
      }

      if (graduationYearFilter !== "all") {
        const selectedGradYear = Number(graduationYearFilter);
        if (story.graduation_year !== selectedGradYear) return false;
      }

      return true;
    });

    if (sortBy === "hometown") {
      nextStories = [...nextStories].sort((a, b) =>
        (a.hometown || "").localeCompare(b.hometown || "", undefined, {
          sensitivity: "base",
        }),
      );
    } else {
      nextStories = [...nextStories].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
    }

    return nextStories;
  }, [
    stories,
    searchQuery,
    majorFilter,
    occupationFilter,
    graduationYearFilter,
    sortBy,
  ]);

  const graduationYearOptions = useMemo(
    () => getGraduationYearOptions(stories),
    [stories],
  );
  const majorOptions = useMemo(() => {
    const majorMap = new globalThis.Map();

    stories.forEach((story) => {
      if (!Array.isArray(story.majors)) return;
      story.majors.forEach((major) => {
        if (typeof major !== "string") return;
        const trimmedMajor = major.trim();
        if (!trimmedMajor) return;
        const normalizedMajor = trimmedMajor.toLowerCase();
        if (!majorMap.has(normalizedMajor)) {
          majorMap.set(normalizedMajor, trimmedMajor);
        }
      });
    });

    return [...majorMap.values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [stories]);
  const occupationOptions = useMemo(() => {
    const occupationMap = new globalThis.Map();

    stories.forEach((story) => {
      if (!Array.isArray(story.occupations)) return;
      story.occupations.forEach((occupation) => {
        if (typeof occupation !== "string") return;
        const trimmedOccupation = occupation.trim();
        if (!trimmedOccupation) return;
        const normalizedOccupation = trimmedOccupation.toLowerCase();
        if (!occupationMap.has(normalizedOccupation)) {
          occupationMap.set(normalizedOccupation, trimmedOccupation);
        }
      });
    });

    return [...occupationMap.values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [stories]);

  const userProfileStory = useMemo(() => {
    if (!user?.id) return null;
    const ownStories = stories.filter((story) => story.user_id === user.id);
    if (!ownStories.length) return null;

    return ownStories.reduce((latestStory, currentStory) => {
      if (!latestStory) return currentStory;
      const latestTime = latestStory.created_at
        ? new Date(latestStory.created_at).getTime()
        : 0;
      const currentTime = currentStory.created_at
        ? new Date(currentStory.created_at).getTime()
        : 0;
      return currentTime > latestTime ? currentStory : latestStory;
    }, null);
  }, [stories, user?.id]);

  const profileInitialValues = useMemo(() => {
    if (!userProfileStory) return null;

    const pronounsDefaults = getPronounsInitialValues(
      userProfileStory.pronouns,
    );

    return {
      name: userProfileStory.name || "",
      pronounsSelection: pronounsDefaults.pronounsSelection,
      pronounsOther: pronounsDefaults.pronounsOther,
      hometown: userProfileStory.hometown || "",
      hometownLocation:
        Number.isFinite(userProfileStory.latitude) &&
        Number.isFinite(userProfileStory.longitude)
          ? {
              label: userProfileStory.hometown || "",
              latitude: userProfileStory.latitude,
              longitude: userProfileStory.longitude,
              countryCode: userProfileStory.country_code || null,
            }
          : null,
      graduationYear: userProfileStory.graduation_year
        ? String(userProfileStory.graduation_year)
        : "",
      story: userProfileStory.story || "",
      shareText: userProfileStory.share_text || "",
      majors: Array.isArray(userProfileStory.majors)
        ? userProfileStory.majors
        : [],
      occupations: Array.isArray(userProfileStory.occupations)
        ? userProfileStory.occupations
        : [],
      socialLinks: Array.isArray(userProfileStory.social_links)
        ? userProfileStory.social_links.map((link) => ({
            platform: link?.platform || "",
            value: link?.url || "",
          }))
        : [],
      hasAudio: Boolean(userProfileStory.audio_url),
      audioUrl: userProfileStory.audio_url || "",
    };
  }, [userProfileStory]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    majorFilter.trim().length > 0 ||
    occupationFilter.trim().length > 0 ||
    graduationYearFilter !== "all";

  const openProfileModal = () => {
    setSubmitError("");
    setSubmitSuccess("");

    if (authLoading) {
      setSubmitError("Checking account status. Please wait a moment.");
      return;
    }

    if (!user) {
      setSubmitError(
        "Please log in with your Berea account to add your hometown profile.",
      );
      navigate("/login?next=/map");
      return;
    }

    if (!isVerified) {
      setSubmitError(
        "Please verify your email before adding your hometown profile.",
      );
      return;
    }

    setIsModalOpen(true);
  };

  const handleMarkerSelect = useCallback((story) => {
    if (!story) return;
    setSelectedStoryId(story.id);
    setMapFocusTarget({ storyId: story.id, token: Date.now() });
  }, []);

  const handleStorySelectFromList = useCallback((story) => {
    setSelectedStoryId(story.id);
    setMapFocusTarget({ storyId: story.id, token: Date.now() });
  }, []);

  const handleMapBackgroundClick = useCallback(() => {
    setSelectedStoryId(null);
  }, []);

  const handleOpenStoryReader = useCallback(async (story) => {
    if (!story) return;
    setStoryReaderStory(story);

    if (!supabase || !story.id) return;

    try {
      const { data, error } = await supabase
        .from("stories")
        .select("id,story")
        .eq("id", story.id)
        .maybeSingle();

      if (error) {
        console.error("Could not load full story text:", error);
        return;
      }

      if (data?.id === story.id && typeof data.story === "string") {
        setStoryReaderStory((currentStory) => {
          if (!currentStory || currentStory.id !== story.id)
            return currentStory;
          return { ...currentStory, story: data.story };
        });
      }
    } catch (fetchError) {
      console.error("Unexpected full story fetch error:", fetchError);
    }
  }, []);

  const handleCloseStoryReader = useCallback(() => {
    setStoryReaderStory(null);
  }, []);

  const handleOpenAudioPlayer = useCallback((story) => {
    if (!story) return;
    setAudioPlayerStory(story);
  }, []);

  const handleCloseAudioPlayer = useCallback(() => {
    setAudioPlayerStory(null);
  }, []);

  const closeStoryCardModal = useCallback(() => {
    setIsStoryCardModalOpen(false);
    setStoryCardBlob(null);
    setStoryCardPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return "";
    });
  }, []);

  const handleStoryCardDownload = useCallback(() => {
    if (!storyCardBlob) return;
    downloadStoryCardBlob(storyCardBlob, STORY_CARD_FILENAME);
  }, [storyCardBlob]);

  const handleShareStory = useCallback(async (story) => {
    if (!story) return;

    try {
      const generatedBlob = await generateStoryCard(story);

      setStoryCardBlob(generatedBlob);
      setStoryCardPreviewUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return URL.createObjectURL(generatedBlob);
      });
      setIsStoryCardModalOpen(true);
    } catch (error) {
      console.error("Error generating story card:", error);
      setSubmitError("Could not generate your story card. Please try again.");
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const cleanupUploadedAudio = useCallback(async (filePath) => {
    if (!filePath || !supabase) return;
    const { error: cleanupError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .remove([filePath]);
    if (cleanupError) {
      console.error("Uploaded audio cleanup failed:", cleanupError);
    }
  }, []);

  const getAudioStoragePathFromUrl = useCallback((audioPublicUrl) => {
    if (!audioPublicUrl) return "";
    try {
      const parsedUrl = new URL(audioPublicUrl);
      const bucketSegment = `/${AUDIO_BUCKET}/`;
      const segmentIndex = parsedUrl.pathname.indexOf(bucketSegment);
      if (segmentIndex === -1) return "";
      return decodeURIComponent(
        parsedUrl.pathname.slice(segmentIndex + bucketSegment.length),
      );
    } catch {
      return "";
    }
  }, []);

  const cleanupStoredAudioByUrl = useCallback(
    async (audioPublicUrl) => {
      const filePath = getAudioStoragePathFromUrl(audioPublicUrl);
      if (!filePath) return;
      await cleanupUploadedAudio(filePath);
    },
    [cleanupUploadedAudio, getAudioStoragePathFromUrl],
  );

  const handleSubmitStory = async (values) => {
    if (isSavingRef.current) {
      return {
        success: false,
        error: "Submission already in progress. Please wait.",
      };
    }

    if (!supabase) {
      return {
        success: false,
        error:
          supabaseConfigError ||
          "Supabase is not configured. Check your environment variables and restart.",
      };
    }

    if (!user) {
      return {
        success: false,
        error: "Please log in before adding a hometown profile.",
      };
    }

    if (!isVerified) {
      return {
        success: false,
        error: "Please verify your email before adding your hometown profile.",
      };
    }

    const normalizedValues = normalizeSubmissionValues(values);
    const validationError = validateStorySubmission(normalizedValues);

    if (validationError) {
      return { success: false, error: validationError };
    }

    let uploadedFilePath = null;
    let savedStory = null;
    let saveSucceeded = false;
    let audioUrl = null;

    isSavingRef.current = true;
    setIsSaving(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const hasAudioStory = Boolean(normalizedValues.audioFile);

      if (hasAudioStory) {
        uploadedFilePath = buildAudioFilePath(normalizedValues.audioFile.name);

        const { error: uploadError } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(uploadedFilePath, normalizedValues.audioFile, {
            upsert: false,
            contentType: normalizedValues.audioFile.type || undefined,
          });

        if (uploadError) {
          console.error("Error uploading audio:", uploadError);
          const message =
            "Could not upload audio. Check storage bucket/policies and try again.";
          setSubmitError(message);
          return {
            success: false,
            error: `${message} (${uploadError.message || "Upload failed"})`,
          };
        }

        const { data: publicUrlData } = supabase.storage
          .from(AUDIO_BUCKET)
          .getPublicUrl(uploadedFilePath);
        audioUrl = sanitizeAudioUrl(publicUrlData?.publicUrl);

        if (!audioUrl) {
          await cleanupUploadedAudio(uploadedFilePath);
          uploadedFilePath = null;
          const message =
            "Audio uploaded but URL generation failed. Please try again.";
          setSubmitError(message);
          return { success: false, error: message };
        }
      }

      let existingProfile = userProfileStory;
      if (!existingProfile) {
        let includeShareText = supportsShareText;
        let includeProfileDetails = supportsProfileDetails;
        let existingRows = null;
        let existingLookupError = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const lookupFields = getStorySelectFields({
            includeShareText,
            includeProfileDetails,
          });
          const lookupResult = await supabase
            .from("stories")
            .select(lookupFields)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

          existingRows = lookupResult.data;
          existingLookupError = lookupResult.error;
          if (!existingLookupError) break;

          const missingColumns = getMissingOptionalColumns(existingLookupError);
          let shouldRetry = false;

          if (includeShareText && missingColumns.has("share_text")) {
            includeShareText = false;
            setSupportsShareText(false);
            shouldRetry = true;
          }
          if (
            includeProfileDetails &&
            (missingColumns.has("majors") || missingColumns.has("occupations"))
          ) {
            includeProfileDetails = false;
            setSupportsProfileDetails(false);
            shouldRetry = true;
          }

          if (!shouldRetry) break;
        }

        if (existingLookupError) {
          console.error(
            "Error checking existing profile:",
            existingLookupError,
          );
        } else {
          existingProfile = sanitizeStoryRow(existingRows?.[0]) || null;
        }
      }

      let hometownLocation = normalizedValues.hometownLocation;
      if (!hometownLocation) {
        hometownLocation = await geocodeHometown(normalizedValues.hometown);
      }

      if (!hometownLocation) {
        const message =
          "Could not locate that hometown. Please choose a suggestion from the list.";
        setSubmitError(message);
        return { success: false, error: message };
      }

      const resolvedAudioUrl =
        audioUrl ||
        (normalizedValues.removeAudio
          ? null
          : sanitizeAudioUrl(existingProfile?.audio_url));
      const previousAudioUrl = sanitizeAudioUrl(existingProfile?.audio_url);
      const hasText = Boolean(normalizedValues.story);
      const hasAudio = Boolean(resolvedAudioUrl);

      const payload = {
        user_id: user.id,
        name: normalizedValues.name,
        pronouns: normalizedValues.pronouns,
        hometown: hometownLocation.label || normalizedValues.hometown,
        country_code: hometownLocation.countryCode || null,
        story: normalizedValues.story,
        graduation_year: normalizedValues.graduationYear,
        majors: normalizedValues.majors,
        occupations: normalizedValues.occupations,
        social_links: normalizeSocialLinks(normalizedValues.socialLinks),
        audio_url: resolvedAudioUrl,
        story_type: getStoryType(hasText, hasAudio),
        latitude: hometownLocation.latitude,
        longitude: hometownLocation.longitude,
      };
      if (supportsShareText) {
        payload.share_text = normalizedValues.shareText || null;
      }
      if (!supportsProfileDetails) {
        delete payload.majors;
        delete payload.occupations;
      }

      let savedData = null;
      let saveError = null;
      let wasUpdate = false;
      const persistProfile = async ({
        includeShareText,
        includeProfileDetails,
      }) => {
        const excludedKeys = new Set();
        if (!includeShareText) excludedKeys.add("share_text");
        if (!includeProfileDetails) {
          excludedKeys.add("majors");
          excludedKeys.add("occupations");
        }

        const persistedPayload = Object.fromEntries(
          Object.entries(payload).filter(([key]) => !excludedKeys.has(key)),
        );
        const selectFields = getStorySelectFields({
          includeShareText,
          includeProfileDetails,
        });

        if (existingProfile?.id) {
          wasUpdate = true;
          const { data: updatedData, error: updateError } = await supabase
            .from("stories")
            .update(persistedPayload)
            .eq("id", existingProfile.id)
            .eq("user_id", user.id)
            .select(selectFields)
            .single();
          return { data: updatedData, error: updateError };
        }

        const { data: insertedData, error: insertError } = await supabase
          .from("stories")
          .insert(persistedPayload)
          .select(selectFields)
          .single();
        return { data: insertedData, error: insertError };
      };

      ({ data: savedData, error: saveError } = await persistProfile({
        includeShareText: supportsShareText,
        includeProfileDetails: supportsProfileDetails,
      }));

      const missingSaveColumns = getMissingOptionalColumns(saveError);
      const shouldRetryWithoutShareText =
        saveError && supportsShareText && missingSaveColumns.has("share_text");
      const shouldRetryWithoutProfileDetails =
        saveError &&
        supportsProfileDetails &&
        (missingSaveColumns.has("majors") ||
          missingSaveColumns.has("occupations"));

      if (shouldRetryWithoutShareText || shouldRetryWithoutProfileDetails) {
        if (shouldRetryWithoutShareText) setSupportsShareText(false);
        if (shouldRetryWithoutProfileDetails) setSupportsProfileDetails(false);

        ({ data: savedData, error: saveError } = await persistProfile({
          includeShareText: shouldRetryWithoutShareText
            ? false
            : supportsShareText,
          includeProfileDetails: shouldRetryWithoutProfileDetails
            ? false
            : supportsProfileDetails,
        }));
      }

      if (saveError) {
        console.error("Error saving profile:", saveError);
        if (uploadedFilePath) await cleanupUploadedAudio(uploadedFilePath);
        const insertMessage = saveError.message || "Save failed";
        const contentConstraintHit = insertMessage.includes(
          "stories_content_check",
        );
        const message = contentConstraintHit
          ? "Your database still requires text/audio content. Remove stories_content_check to allow profile-only submissions."
          : "Could not save your profile. Please try again.";
        setSubmitError(message);
        return { success: false, error: `${message} (${insertMessage})` };
      }

      saveSucceeded = true;
      savedStory = sanitizeStoryRow(savedData);

      const refreshResult = await fetchStories({ silent: true });
      if (!refreshResult.success) {
        if (savedStory) {
          setStories((currentStories) => {
            const withoutSavedStory = currentStories.filter(
              (storyItem) => storyItem.id !== savedStory.id,
            );
            return wasUpdate
              ? [savedStory, ...withoutSavedStory]
              : [savedStory, ...withoutSavedStory];
          });
          setSubmitError(
            "Profile saved, but list refresh failed. Your latest pin was added locally.",
          );
        } else {
          setSubmitError(
            "Profile saved, but list refresh failed. Please refresh the page to see the latest pin.",
          );
        }
      } else {
        setSubmitSuccess(
          wasUpdate
            ? "Profile updated successfully."
            : "Profile saved and pinned successfully.",
        );
      }

      if (savedStory) {
        setSelectedStoryId(savedStory.id);
        setMapFocusTarget({ storyId: savedStory.id, token: Date.now() });
      }

      if (previousAudioUrl && previousAudioUrl !== resolvedAudioUrl) {
        await cleanupStoredAudioByUrl(previousAudioUrl);
      }

      closeModal();
      return { success: true };
    } catch (unexpectedError) {
      console.error("Unexpected error while saving profile:", unexpectedError);
      if (uploadedFilePath && !saveSucceeded)
        await cleanupUploadedAudio(uploadedFilePath);
      const message =
        "Unexpected error while saving your profile. Please try again.";
      setSubmitError(message);
      return { success: false, error: message };
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setSubmitSuccess("");
    setSubmitError("You have logged out.");
    setSelectedStoryId(null);
  };

  const handleRefreshVerification = async () => {
    const result = await refreshUser();
    if (!result.success) {
      setSubmitError(result.error || "Could not refresh verification status.");
      return;
    }

    if (result.user?.email_confirmed_at) {
      setSubmitSuccess(
        "Email verified. You can now add your hometown profile.",
      );
      setSubmitError("");
    } else {
      setSubmitError(
        "Email is still unverified. Please check your inbox and click the verify link.",
      );
    }
  };

  useEffect(() => {
    if (!selectedStoryId) return;
    const selectedStillVisible = filteredStories.some(
      (story) => String(story.id) === String(selectedStoryId),
    );
    if (selectedStillVisible) return;

    setSelectedStoryId(null);
  }, [filteredStories, selectedStoryId]);

  return (
    <div className="app-shell">
      <Header
        onAddStory={openProfileModal}
        isAddMode={isModalOpen}
        user={user}
        isVerified={isVerified}
        onLogin={() => navigate("/login?next=/map")}
        onSignup={() => navigate("/signup?next=/map")}
        onLogout={handleLogout}
      />

      <div className="app-main">
        <StorySidebar
          stories={filteredStories}
          totalStoriesCount={stories.length}
          selectedStoryId={selectedStoryId}
          searchQuery={searchQuery}
          majorFilter={majorFilter}
          majorOptions={majorOptions}
          occupationFilter={occupationFilter}
          occupationOptions={occupationOptions}
          graduationYearFilter={graduationYearFilter}
          graduationYearOptions={graduationYearOptions}
          sortBy={sortBy}
          onSearchChange={setSearchQuery}
          onMajorFilterChange={setMajorFilter}
          onOccupationFilterChange={setOccupationFilter}
          onGraduationYearFilterChange={setGraduationYearFilter}
          onSortChange={setSortBy}
          onSelectStory={handleStorySelectFromList}
          loading={loading}
        />

        <section className="map-panel">
          <Map
            stories={filteredStories}
            selectedStoryId={selectedStoryId}
            onMarkerSelect={handleMarkerSelect}
            onReadStory={handleOpenStoryReader}
            onListenAudio={handleOpenAudioPlayer}
            onShareStory={handleShareStory}
            focusTarget={mapFocusTarget}
            onMapBackgroundClick={handleMapBackgroundClick}
          />

          {user && !isVerified && (
            <div className="auth-restriction-banner">
              <span>
                Please verify your email before adding your hometown profile.
              </span>
              <button type="button" onClick={handleRefreshVerification}>
                I verified my email
              </button>
            </div>
          )}

          {hasActiveFilters &&
            !loading &&
            stories.length > 0 &&
            filteredStories.length === 0 && (
              <div className="map-hint-banner">
                No pins match current search and filters.
              </div>
            )}

          <div className="status-stack">
            {loading && <div className="status-banner">Loading stories...</div>}
            {authLoading && (
              <div className="status-banner">Checking account status...</div>
            )}
            {authError && (
              <div className="status-banner status-banner--error">
                {authError}
              </div>
            )}
            {loadError && (
              <div className="status-banner status-banner--error">
                {loadError}
              </div>
            )}
            {submitError && (
              <div className="status-banner status-banner--warning">
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="status-banner status-banner--success">
                {submitSuccess}
              </div>
            )}
          </div>
        </section>
      </div>

      <AddStoryModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSubmitStory}
        onShareStory={handleShareStory}
        isSaving={isSaving}
        initialValues={profileInitialValues}
        hasExistingProfile={Boolean(userProfileStory)}
      />

      <StoryCardModal
        isOpen={isStoryCardModalOpen}
        imageUrl={storyCardPreviewUrl}
        onDownload={handleStoryCardDownload}
        onClose={closeStoryCardModal}
      />

      <StoryReaderModal
        isOpen={Boolean(storyReaderStory)}
        story={storyReaderStory}
        onClose={handleCloseStoryReader}
      />

      <AudioPlayerModal
        isOpen={Boolean(audioPlayerStory)}
        story={audioPlayerStory}
        onClose={handleCloseAudioPlayer}
      />
    </div>
  );
}
