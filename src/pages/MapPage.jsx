import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "../Header";
import Map from "../Map";
import StorySidebar from "../StorySidebar";
import AddStoryModal from "../AddStoryModal";
import StoryCardModal from "../components/StoryCardModal";
import AudioPlayerModal from "../components/AudioPlayerModal";
import StoryReaderModal from "../components/StoryReaderModal";
import ImageViewerModal from "../components/ImageViewerModal";
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
  IMAGE_BUCKET,
  STORIES_FETCH_MAX,
  STORIES_FETCH_PAGE_SIZE,
  buildAudioFilePath,
  buildImageFilePath,
  getGraduationYearOptions,
  getStoryType,
  sanitizeAudioUrl,
  sanitizeImageUrl,
  sanitizeStoryRow,
  sanitizeStoryRows,
} from "../storyUtils";

const BEREA_COORDINATES = {
  latitude: 37.5739,
  longitude: -84.2963,
};

const STORY_SELECT_FIELDS_BASE =
  "id,name,pronouns,hometown,country_code,story,audio_url,story_type,graduation_year,social_links,latitude,longitude,created_at,user_id";

function getStorySelectFields({
  includeShareText,
  includeProfileDetails,
  includeImage,
}) {
  const selectFields = [STORY_SELECT_FIELDS_BASE];
  if (includeImage) selectFields.push("image_url");
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

  if (
    (detailText.includes("image_url") && detailText.includes("column")) ||
    detailText.includes("image_url does not exist")
  ) {
    missingColumns.add("image_url");
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

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);

  const arcLength =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(toRadians(fromLatitude)) *
      Math.cos(toRadians(toLatitude)) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  const angle = 2 * Math.atan2(Math.sqrt(arcLength), Math.sqrt(1 - arcLength));
  return earthRadiusKm * angle;
}

function normalizeDistancePin(story) {
  if (!story) return null;
  const latitude = Number(story.latitude);
  const longitude = Number(story.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const rawId = story.id;
  if (rawId === null || rawId === undefined) return null;

  return {
    id: rawId,
    name: story.name || "Anonymous",
    latitude,
    longitude,
  };
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
  const [imageViewerStory, setImageViewerStory] = useState(null);
  const [supportsShareText, setSupportsShareText] = useState(true);
  const [supportsProfileDetails, setSupportsProfileDetails] = useState(true);
  const [supportsImage, setSupportsImage] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [majorFilter, setMajorFilter] = useState("");
  const [occupationFilter, setOccupationFilter] = useState("");
  const [graduationYearFilter, setGraduationYearFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [distanceModeEnabled, setDistanceModeEnabled] = useState(false);
  const [distanceComparePins, setDistanceComparePins] = useState([]);

  const fetchRequestIdRef = useRef(0);
  const isSavingRef = useRef(false);
  const lastDistancePinRef = useRef(null);

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
        let includeImage = supportsImage;
        let selectFields = "";
        let firstPageData = null;
        let fetchError = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          selectFields = getStorySelectFields({
            includeShareText,
            includeProfileDetails,
            includeImage,
          });
          const firstPageResult = await supabase
            .from("stories")
            .select(selectFields)
            .order("created_at", { ascending: false })
            .range(0, STORIES_FETCH_PAGE_SIZE - 1);

          firstPageData = firstPageResult.data;
          fetchError = firstPageResult.error;

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
          if (includeImage && missingColumns.has("image_url")) {
            includeImage = false;
            setSupportsImage(false);
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

        let allRows = Array.isArray(firstPageData) ? [...firstPageData] : [];
        let fetchOffset = allRows.length;

        while (
          fetchOffset > 0 &&
          fetchOffset % STORIES_FETCH_PAGE_SIZE === 0 &&
          fetchOffset < STORIES_FETCH_MAX
        ) {
          if (requestId !== fetchRequestIdRef.current) {
            return { success: false, stale: true };
          }

          const rangeEnd = Math.min(
            fetchOffset + STORIES_FETCH_PAGE_SIZE - 1,
            STORIES_FETCH_MAX - 1,
          );
          const { data: nextPageData, error: nextPageError } = await supabase
            .from("stories")
            .select(selectFields)
            .order("created_at", { ascending: false })
            .range(fetchOffset, rangeEnd);

          if (nextPageError) {
            console.error(
              "Error loading additional story pages:",
              nextPageError,
            );
            setLoadError("Could not load all stories right now.");
            break;
          }

          const normalizedRows = Array.isArray(nextPageData)
            ? nextPageData
            : [];
          if (!normalizedRows.length) break;

          allRows = allRows.concat(normalizedRows);
          fetchOffset += normalizedRows.length;

          if (normalizedRows.length < STORIES_FETCH_PAGE_SIZE) break;
        }

        if (requestId !== fetchRequestIdRef.current) {
          return { success: false, stale: true };
        }

        const sanitizedStories = sanitizeStoryRows(allRows);
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
    [supportsImage, supportsProfileDetails, supportsShareText],
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

  const bereaDistanceHighlights = useMemo(() => {
    let closest = null;
    let farthest = null;

    stories.forEach((story) => {
      if (!Number.isFinite(story.latitude) || !Number.isFinite(story.longitude))
        return;

      const distanceKm = getDistanceKm(
        BEREA_COORDINATES.latitude,
        BEREA_COORDINATES.longitude,
        story.latitude,
        story.longitude,
      );

      const summaryItem = { story, distanceKm };
      if (!closest || distanceKm < closest.distanceKm) closest = summaryItem;
      if (!farthest || distanceKm > farthest.distanceKm) farthest = summaryItem;
    });

    if (!closest || !farthest) return null;
    return { closest, farthest };
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
      hasImage: Boolean(userProfileStory.image_url),
      imageUrl: userProfileStory.image_url || "",
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

  const handlePinDistanceSelect = useCallback(
    (story) => {
      const normalizedPin = normalizeDistancePin(story);
      if (!normalizedPin) return;
      lastDistancePinRef.current = normalizedPin;

      if (!distanceModeEnabled) return;

      setDistanceComparePins((currentPins) => {
        if (currentPins.length === 0) return [normalizedPin];

        if (currentPins.length === 1) {
          if (String(currentPins[0].id) === String(normalizedPin.id)) {
            return currentPins;
          }
          return [currentPins[0], normalizedPin];
        }

        // After a full pair is selected, any next click starts a new comparison.
        return [normalizedPin];
      });
    },
    [distanceModeEnabled],
  );

  const clearDistanceCompare = useCallback(() => {
    setDistanceComparePins([]);
  }, []);

  const toggleDistanceMode = useCallback(() => {
    setDistanceModeEnabled((isEnabled) => {
      const nextValue = !isEnabled;
      if (!nextValue) {
        setDistanceComparePins([]);
      } else {
        const latestPin = lastDistancePinRef.current;
        if (latestPin) {
          setDistanceComparePins([latestPin]);
        }
      }
      return nextValue;
    });
  }, []);

  const handleOpenStoryReader = useCallback((story) => {
    if (!story) return;
    setStoryReaderStory(story);
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

  const handleOpenImageViewer = useCallback((story) => {
    if (!story) return;
    setImageViewerStory(story);
  }, []);

  const handleCloseImageViewer = useCallback(() => {
    setImageViewerStory(null);
  }, []);

  const closeStoryCardModal = useCallback(() => {
    setIsStoryCardModalOpen(false);
    setStoryCardBlob(null);
    setStoryCardPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return "";
    });
  }, []);

  const distanceCompareSummary = useMemo(() => {
    if (distanceComparePins.length !== 2) return null;

    const [pinA, pinB] = distanceComparePins;
    const distanceKm = getDistanceKm(
      pinA.latitude,
      pinA.longitude,
      pinB.latitude,
      pinB.longitude,
    );
    const distanceMi = distanceKm * 0.621371;

    return {
      pinA,
      pinB,
      distanceKm,
      distanceMi,
    };
  }, [distanceComparePins]);

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

  const cleanupUploadedImage = useCallback(async (filePath) => {
    if (!filePath || !supabase) return;
    const { error: cleanupError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .remove([filePath]);
    if (cleanupError) {
      console.error("Uploaded image cleanup failed:", cleanupError);
    }
  }, []);

  const getStoragePathFromUrl = useCallback((publicUrl, bucketName) => {
    if (!publicUrl || !bucketName) return "";
    try {
      const parsedUrl = new URL(publicUrl);
      const bucketSegment = `/${bucketName}/`;
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
      const filePath = getStoragePathFromUrl(audioPublicUrl, AUDIO_BUCKET);
      if (!filePath) return;
      await cleanupUploadedAudio(filePath);
    },
    [cleanupUploadedAudio, getStoragePathFromUrl],
  );

  const cleanupStoredImageByUrl = useCallback(
    async (imagePublicUrl) => {
      const filePath = getStoragePathFromUrl(imagePublicUrl, IMAGE_BUCKET);
      if (!filePath) return;
      await cleanupUploadedImage(filePath);
    },
    [cleanupUploadedImage, getStoragePathFromUrl],
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

    let uploadedAudioFilePath = null;
    let uploadedImageFilePath = null;
    let savedStory = null;
    let saveSucceeded = false;
    let audioUrl = null;
    let imageUrl = null;

    isSavingRef.current = true;
    setIsSaving(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const hasAudioStory = Boolean(normalizedValues.audioFile);
      const hasImageStory = Boolean(normalizedValues.imageFile);

      if (hasAudioStory) {
        uploadedAudioFilePath = buildAudioFilePath(
          normalizedValues.audioFile.name,
          user.id,
        );

        const { error: uploadError } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(uploadedAudioFilePath, normalizedValues.audioFile, {
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
          .getPublicUrl(uploadedAudioFilePath);
        audioUrl = sanitizeAudioUrl(publicUrlData?.publicUrl);

        if (!audioUrl) {
          await cleanupUploadedAudio(uploadedAudioFilePath);
          uploadedAudioFilePath = null;
          const message =
            "Audio uploaded but URL generation failed. Please try again.";
          setSubmitError(message);
          return { success: false, error: message };
        }
      }

      if (hasImageStory) {
        if (!supportsImage) {
          return {
            success: false,
            error:
              "Image upload needs an image_url column in your stories table.",
          };
        }

        uploadedImageFilePath = buildImageFilePath(
          normalizedValues.imageFile.name,
          user.id,
        );

        const { error: uploadError } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(uploadedImageFilePath, normalizedValues.imageFile, {
            upsert: false,
            contentType: normalizedValues.imageFile.type || undefined,
          });

        if (uploadError) {
          console.error("Error uploading image:", uploadError);
          if (uploadedAudioFilePath) {
            await cleanupUploadedAudio(uploadedAudioFilePath);
            uploadedAudioFilePath = null;
          }
          const message =
            "Could not upload image. Check storage bucket/policies and try again.";
          setSubmitError(message);
          return {
            success: false,
            error: `${message} (${uploadError.message || "Upload failed"})`,
          };
        }

        const { data: publicUrlData } = supabase.storage
          .from(IMAGE_BUCKET)
          .getPublicUrl(uploadedImageFilePath);
        imageUrl = sanitizeImageUrl(publicUrlData?.publicUrl);

        if (!imageUrl) {
          await cleanupUploadedImage(uploadedImageFilePath);
          uploadedImageFilePath = null;
          if (uploadedAudioFilePath) {
            await cleanupUploadedAudio(uploadedAudioFilePath);
            uploadedAudioFilePath = null;
          }
          const message =
            "Image uploaded but URL generation failed. Please try again.";
          setSubmitError(message);
          return { success: false, error: message };
        }
      }

      let existingProfile = userProfileStory;
      if (!existingProfile) {
        let includeShareText = supportsShareText;
        let includeProfileDetails = supportsProfileDetails;
        let includeImage = supportsImage;
        let existingRows = null;
        let existingLookupError = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const lookupFields = getStorySelectFields({
            includeShareText,
            includeProfileDetails,
            includeImage,
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
          if (includeImage && missingColumns.has("image_url")) {
            includeImage = false;
            setSupportsImage(false);
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
      const resolvedImageUrl =
        imageUrl ||
        (normalizedValues.removeImage
          ? null
          : sanitizeImageUrl(existingProfile?.image_url));
      const previousAudioUrl = sanitizeAudioUrl(existingProfile?.audio_url);
      const previousImageUrl = sanitizeImageUrl(existingProfile?.image_url);
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
        image_url: resolvedImageUrl,
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
      if (!supportsImage) {
        delete payload.image_url;
      }

      let savedData = null;
      let saveError = null;
      let wasUpdate = false;
      const persistProfile = async ({
        includeShareText,
        includeProfileDetails,
        includeImage,
      }) => {
        const excludedKeys = new Set();
        if (!includeShareText) excludedKeys.add("share_text");
        if (!includeProfileDetails) {
          excludedKeys.add("majors");
          excludedKeys.add("occupations");
        }
        if (!includeImage) excludedKeys.add("image_url");

        const persistedPayload = Object.fromEntries(
          Object.entries(payload).filter(([key]) => !excludedKeys.has(key)),
        );
        const selectFields = getStorySelectFields({
          includeShareText,
          includeProfileDetails,
          includeImage,
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
        includeImage: supportsImage,
      }));

      const missingSaveColumns = getMissingOptionalColumns(saveError);
      const shouldRetryWithoutShareText =
        saveError && supportsShareText && missingSaveColumns.has("share_text");
      const shouldRetryWithoutProfileDetails =
        saveError &&
        supportsProfileDetails &&
        (missingSaveColumns.has("majors") ||
          missingSaveColumns.has("occupations"));
      const shouldRetryWithoutImage =
        saveError && supportsImage && missingSaveColumns.has("image_url");
      const imageMutationRequested = Boolean(
        normalizedValues.imageFile ||
        normalizedValues.removeImage ||
        sanitizeImageUrl(existingProfile?.image_url),
      );

      if (shouldRetryWithoutImage && imageMutationRequested) {
        if (uploadedAudioFilePath)
          await cleanupUploadedAudio(uploadedAudioFilePath);
        if (uploadedImageFilePath)
          await cleanupUploadedImage(uploadedImageFilePath);
        setSupportsImage(false);
        const message =
          "Image saving is not available yet. Add image_url column to the stories table.";
        setSubmitError(message);
        return { success: false, error: message };
      }

      if (
        shouldRetryWithoutShareText ||
        shouldRetryWithoutProfileDetails ||
        shouldRetryWithoutImage
      ) {
        if (shouldRetryWithoutShareText) setSupportsShareText(false);
        if (shouldRetryWithoutProfileDetails) setSupportsProfileDetails(false);
        if (shouldRetryWithoutImage) setSupportsImage(false);

        ({ data: savedData, error: saveError } = await persistProfile({
          includeShareText: shouldRetryWithoutShareText
            ? false
            : supportsShareText,
          includeProfileDetails: shouldRetryWithoutProfileDetails
            ? false
            : supportsProfileDetails,
          includeImage: shouldRetryWithoutImage ? false : supportsImage,
        }));
      }

      if (saveError) {
        console.error("Error saving profile:", saveError);
        if (uploadedAudioFilePath)
          await cleanupUploadedAudio(uploadedAudioFilePath);
        if (uploadedImageFilePath)
          await cleanupUploadedImage(uploadedImageFilePath);
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
      if (previousImageUrl && previousImageUrl !== resolvedImageUrl) {
        await cleanupStoredImageByUrl(previousImageUrl);
      }

      closeModal();
      return { success: true };
    } catch (unexpectedError) {
      console.error("Unexpected error while saving profile:", unexpectedError);
      if (uploadedAudioFilePath && !saveSucceeded)
        await cleanupUploadedAudio(uploadedAudioFilePath);
      if (uploadedImageFilePath && !saveSucceeded)
        await cleanupUploadedImage(uploadedImageFilePath);
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

    if (result.user?.email_confirmed_at || result.user?.confirmed_at) {
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
          distanceHighlights={bereaDistanceHighlights}
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
            onViewImage={handleOpenImageViewer}
            onShareStory={handleShareStory}
            onPinDistanceSelect={handlePinDistanceSelect}
            focusTarget={mapFocusTarget}
            onMapBackgroundClick={handleMapBackgroundClick}
          />

          <button
            type="button"
            className={`distance-mode-toggle ${distanceModeEnabled ? "distance-mode-toggle--active" : ""}`}
            onClick={toggleDistanceMode}
          >
            Distance Mode: {distanceModeEnabled ? "On" : "Off"}
          </button>

          {distanceModeEnabled && distanceComparePins.length > 0 && (
            <div className="distance-compare-banner">
              {distanceCompareSummary ? (
                <p>
                  {distanceCompareSummary.pinA.name} to{" "}
                  {distanceCompareSummary.pinB.name}:{" "}
                  {distanceCompareSummary.distanceKm.toFixed(0)} km (
                  {distanceCompareSummary.distanceMi.toFixed(0)} mi)
                </p>
              ) : (
                <p>
                  First pin selected:{" "}
                  <strong>{distanceComparePins[0]?.name || "Unknown"}</strong>.
                  Click another pin to compare distance.
                </p>
              )}
              <button type="button" onClick={clearDistanceCompare}>
                Clear
              </button>
            </div>
          )}

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

      <ImageViewerModal
        isOpen={Boolean(imageViewerStory)}
        story={imageViewerStory}
        onClose={handleCloseImageViewer}
      />
    </div>
  );
}
