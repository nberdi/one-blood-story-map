import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "../Header";
import Map from "../Map";
import StorySidebar from "../StorySidebar";
import AddStoryModal from "../AddStoryModal";
import { useArcLayer } from "../hooks/useArcLayer";
import { geocodeHometown } from "../hometownSearch";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "../router";
import { supabase, supabaseConfigError } from "../supabaseClient";
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
  getStoryTypeFromRecord,
  sanitizeAudioUrl,
  sanitizeStoryRow,
  sanitizeStoryRows,
} from "../storyUtils";

const STORY_SELECT_FIELDS =
  "id,name,pronouns,hometown,country_code,story,audio_url,story_type,graduation_year,social_links,latitude,longitude,created_at,user_id";

function includesQuery(value, query) {
  return typeof value === "string" && value.toLowerCase().includes(query);
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
  const [isSaving, setIsSaving] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hometownFilter, setHometownFilter] = useState("");
  const [graduationYearFilter, setGraduationYearFilter] = useState("all");
  const [storyTypeFilter, setStoryTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const fetchRequestIdRef = useRef(0);
  const isSavingRef = useRef(false);

  const fetchStories = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++fetchRequestIdRef.current;
    if (!silent) setLoading(true);
    setLoadError("");

    if (!supabase) {
      const configMessage =
        supabaseConfigError ||
        "Supabase is not configured. Check your environment variables.";
      setLoadError(configMessage);
      if (!silent && requestId === fetchRequestIdRef.current) setLoading(false);
      return { success: false, error: configMessage };
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("stories")
        .select(STORY_SELECT_FIELDS)
        .order("created_at", { ascending: false })
        .limit(STORIES_FETCH_LIMIT);

      if (requestId !== fetchRequestIdRef.current) {
        return { success: false, stale: true };
      }

      if (fetchError) {
        console.error("Error loading stories:", fetchError);
        setLoadError("Could not load stories right now.");
        return { success: false, error: fetchError.message || "Fetch failed" };
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
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const filteredStories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const hometownQuery = hometownFilter.trim().toLowerCase();

    let nextStories = stories.filter((story) => {
      if (query) {
        const searchMatch =
          includesQuery(story.name, query) ||
          includesQuery(story.hometown, query) ||
          includesQuery(story.story, query);
        if (!searchMatch) return false;
      }

      if (hometownQuery && !includesQuery(story.hometown, hometownQuery)) {
        return false;
      }

      if (storyTypeFilter !== "all") {
        const type = getStoryTypeFromRecord(story);
        if (type !== storyTypeFilter) return false;
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
    hometownFilter,
    graduationYearFilter,
    storyTypeFilter,
    sortBy,
  ]);

  const graduationYearOptions = useMemo(
    () => getGraduationYearOptions(stories),
    [stories],
  );
  const { selectPin, clearArcs } = useArcLayer(mapInstance, filteredStories);

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
      socialLinks: Array.isArray(userProfileStory.social_links)
        ? userProfileStory.social_links.map((link) => ({
            platform: link?.platform || "",
            value: link?.url || "",
          }))
        : [],
      hasAudio: Boolean(userProfileStory.audio_url),
    };
  }, [userProfileStory]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    hometownFilter.trim().length > 0 ||
    graduationYearFilter !== "all" ||
    storyTypeFilter !== "all";

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

  const handleMarkerSelect = useCallback(
    (story) => {
      if (!story) return;
      setSelectedStoryId(story.id);
      selectPin(story);
    },
    [selectPin],
  );

  const handleStorySelectFromList = useCallback(
    (story) => {
      setSelectedStoryId(story.id);
      setMapFocusTarget({ storyId: story.id, token: Date.now() });
      selectPin(story);
    },
    [selectPin],
  );

  const handleMapBackgroundClick = useCallback(() => {
    setSelectedStoryId(null);
    clearArcs();
  }, [clearArcs]);

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
        const { data: existingRows, error: existingLookupError } =
          await supabase
            .from("stories")
            .select(STORY_SELECT_FIELDS)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

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
        audioUrl || sanitizeAudioUrl(existingProfile?.audio_url);
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
        social_links: normalizeSocialLinks(normalizedValues.socialLinks),
        audio_url: resolvedAudioUrl,
        story_type: getStoryType(hasText, hasAudio),
        latitude: hometownLocation.latitude,
        longitude: hometownLocation.longitude,
      };

      let savedData = null;
      let saveError = null;
      let wasUpdate = false;

      if (existingProfile?.id) {
        wasUpdate = true;
        const { data: updatedData, error: updateError } = await supabase
          .from("stories")
          .update(payload)
          .eq("id", existingProfile.id)
          .eq("user_id", user.id)
          .select(STORY_SELECT_FIELDS)
          .single();

        savedData = updatedData;
        saveError = updateError;
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from("stories")
          .insert(payload)
          .select(STORY_SELECT_FIELDS)
          .single();

        savedData = insertedData;
        saveError = insertError;
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
        selectPin(savedStory);
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
    clearArcs();
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
    clearArcs();
  }, [clearArcs, filteredStories, selectedStoryId]);

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
          hometownFilter={hometownFilter}
          storyTypeFilter={storyTypeFilter}
          graduationYearFilter={graduationYearFilter}
          graduationYearOptions={graduationYearOptions}
          sortBy={sortBy}
          onSearchChange={setSearchQuery}
          onHometownFilterChange={setHometownFilter}
          onGraduationYearFilterChange={setGraduationYearFilter}
          onStoryTypeFilterChange={setStoryTypeFilter}
          onSortChange={setSortBy}
          onSelectStory={handleStorySelectFromList}
          loading={loading}
        />

        <section className="map-panel">
          <Map
            stories={filteredStories}
            selectedStoryId={selectedStoryId}
            onMarkerSelect={handleMarkerSelect}
            focusTarget={mapFocusTarget}
            onMapReady={setMapInstance}
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
        isSaving={isSaving}
        initialValues={profileInitialValues}
        hasExistingProfile={Boolean(userProfileStory)}
      />
    </div>
  );
}
