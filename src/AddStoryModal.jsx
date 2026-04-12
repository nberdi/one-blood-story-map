import { useEffect, useRef, useState } from "react";
import {
  AUDIO_ACCEPT_ATTR,
  AUDIO_HELPER_TEXT,
  GRAD_YEAR_MAX,
  GRAD_YEAR_MIN,
  HOMETOWN_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PRONOUN_OPTIONS,
  SOCIAL_HELPER_TEXT,
  SOCIAL_LINK_MAX_COUNT,
  SOCIAL_LINK_MAX_LENGTH,
  SOCIAL_PLATFORM_OPTIONS,
  SHARE_TEXT_MAX_WORDS,
  STORY_MAX_WORDS,
  getWordCount,
  getAudioValidationError,
  normalizeSubmissionValues,
  validateStorySubmission,
} from "./storyValidation";
import { searchHometownSuggestions } from "./hometownSearch";

function normalizeInitialValues(initialValues) {
  if (!initialValues || typeof initialValues !== "object") {
    return {
      name: "",
      pronounsSelection: "",
      pronounsOther: "",
      hometown: "",
      hometownLocation: null,
      graduationYear: "",
      story: "",
      shareText: "",
      socialLinks: [],
      hasAudio: false,
      audioUrl: "",
    };
  }

  return {
    name: initialValues.name || "",
    pronounsSelection: initialValues.pronounsSelection || "",
    pronounsOther: initialValues.pronounsOther || "",
    hometown: initialValues.hometown || "",
    hometownLocation: initialValues.hometownLocation || null,
    graduationYear: initialValues.graduationYear || "",
    story: initialValues.story || "",
    shareText: initialValues.shareText || "",
    socialLinks: Array.isArray(initialValues.socialLinks)
      ? initialValues.socialLinks
      : [],
    hasAudio: Boolean(initialValues.hasAudio),
    audioUrl:
      typeof initialValues.audioUrl === "string" ? initialValues.audioUrl : "",
  };
}

function limitToWordCount(value, maxWords) {
  if (typeof value !== "string") return "";
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(" ");
}

export default function AddStoryModal({
  isOpen,
  onClose,
  onSubmit,
  onShareStory,
  isSaving,
  initialValues,
  hasExistingProfile,
}) {
  const [name, setName] = useState("");
  const [pronounsSelection, setPronounsSelection] = useState("");
  const [pronounsOther, setPronounsOther] = useState("");
  const [hometown, setHometown] = useState("");
  const [selectedHometown, setSelectedHometown] = useState(null);
  const [hometownSuggestions, setHometownSuggestions] = useState([]);
  const [hometownSearchError, setHometownSearchError] = useState("");
  const [isSearchingHometown, setIsSearchingHometown] = useState(false);
  const [graduationYear, setGraduationYear] = useState("");
  const [story, setStory] = useState("");
  const [shareText, setShareText] = useState("");
  const [socialLinks, setSocialLinks] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [initialHadAudio, setInitialHadAudio] = useState(false);
  const [initialAudioUrl, setInitialAudioUrl] = useState("");
  const [hasSavedAudio, setHasSavedAudio] = useState(false);
  const [removeSavedAudio, setRemoveSavedAudio] = useState(false);
  const [error, setError] = useState("");
  const audioInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const normalizedInitialValues = normalizeInitialValues(initialValues);

    setName(normalizedInitialValues.name);
    setPronounsSelection(normalizedInitialValues.pronounsSelection);
    setPronounsOther(normalizedInitialValues.pronounsOther);
    setHometown(normalizedInitialValues.hometown);
    setSelectedHometown(normalizedInitialValues.hometownLocation);
    setHometownSuggestions([]);
    setHometownSearchError("");
    setIsSearchingHometown(false);
    setGraduationYear(normalizedInitialValues.graduationYear);
    setStory(normalizedInitialValues.story);
    setShareText(normalizedInitialValues.shareText);
    setSocialLinks(normalizedInitialValues.socialLinks);
    setAudioFile(null);
    setInitialHadAudio(normalizedInitialValues.hasAudio);
    setInitialAudioUrl(normalizedInitialValues.audioUrl);
    setHasSavedAudio(normalizedInitialValues.hasAudio);
    setRemoveSavedAudio(false);
    setError("");
  }, [isOpen, initialValues]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const query = hometown.trim();
    if (selectedHometown && selectedHometown.label === query) {
      setHometownSuggestions([]);
      setHometownSearchError("");
      setIsSearchingHometown(false);
      return undefined;
    }

    if (query.length < 2) {
      setHometownSuggestions([]);
      setHometownSearchError("");
      setIsSearchingHometown(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearchingHometown(true);
        setHometownSearchError("");
        const results = await searchHometownSuggestions(query, {
          signal: controller.signal,
        });
        setHometownSuggestions(results);
      } catch (searchError) {
        if (searchError?.name === "AbortError") return;
        console.error("Hometown search failed:", searchError);
        setHometownSearchError(
          "Could not load hometown suggestions right now.",
        );
        setHometownSuggestions([]);
      } finally {
        setIsSearchingHometown(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [hometown, isOpen, selectedHometown]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSaving) return;

    const values = normalizeSubmissionValues({
      name,
      pronounsSelection,
      pronounsOther,
      hometown,
      hometownLocation: selectedHometown,
      graduationYear,
      story,
      shareText,
      socialLinks,
      audioFile,
      removeAudio: removeSavedAudio && !audioFile,
    });
    const validationError = validateStorySubmission(values);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const result = await onSubmit(values);
      const normalizedError =
        typeof result?.error === "string" && result.error.trim()
          ? result.error
          : "Could not save your profile. Please try again.";

      if (!result?.success) {
        setError(normalizedError);
      }
    } catch (submitError) {
      console.error("Profile submit failed:", submitError);
      setError(
        typeof submitError?.message === "string" && submitError.message.trim()
          ? submitError.message
          : "Could not save your profile. Please try again.",
      );
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    setSelectedHometown(suggestion);
    setHometown(suggestion.label);
    setHometownSuggestions([]);
    setHometownSearchError("");
    if (error) setError("");
  };

  const handleAudioChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;

    if (!selectedFile) {
      setAudioFile(null);
      setHasSavedAudio(removeSavedAudio ? false : initialHadAudio);
      if (error) setError("");
      return;
    }

    const audioValidationError = getAudioValidationError(selectedFile);
    if (audioValidationError) {
      setError(audioValidationError);
      setAudioFile(null);
      event.target.value = "";
      return;
    }

    setAudioFile(selectedFile);
    setHasSavedAudio(false);
    setRemoveSavedAudio(false);
    if (error) setError("");
  };

  const handleRemoveSavedAudio = () => {
    setAudioFile(null);
    setHasSavedAudio(false);
    setRemoveSavedAudio(true);
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (error) setError("");
  };

  const handleRestoreSavedAudio = () => {
    setRemoveSavedAudio(false);
    setHasSavedAudio(initialHadAudio);
    if (error) setError("");
  };

  const handleClearSelectedAudio = () => {
    setAudioFile(null);
    setHasSavedAudio(initialHadAudio);
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (error) setError("");
  };

  const handleAddSocialLink = () => {
    if (socialLinks.length >= SOCIAL_LINK_MAX_COUNT) {
      setError(
        `You can add up to ${SOCIAL_LINK_MAX_COUNT} social links (one per platform).`,
      );
      return;
    }
    setSocialLinks((currentLinks) => [
      ...currentLinks,
      { platform: "", value: "" },
    ]);
    if (error) setError("");
  };

  const handleSocialChange = (index, key, value) => {
    setSocialLinks((currentLinks) =>
      currentLinks.map((link, linkIndex) =>
        linkIndex === index ? { ...link, [key]: value } : link,
      ),
    );
    if (error) setError("");
  };

  const handleRemoveSocial = (index) => {
    setSocialLinks((currentLinks) =>
      currentLinks.filter((_, linkIndex) => linkIndex !== index),
    );
    if (error) setError("");
  };

  const isPlatformTakenInOtherRow = (platformValue, rowIndex) =>
    socialLinks.some(
      (link, linkIndex) =>
        linkIndex !== rowIndex &&
        (link.platform || "").toLowerCase() === platformValue,
    );

  const handleShareMyStory = () => {
    if (!onShareStory) return;

    const parsedGraduationYear = Number(graduationYear);
    const normalizedGraduationYear = Number.isInteger(parsedGraduationYear)
      ? parsedGraduationYear
      : null;
    const resolvedPronouns =
      pronounsSelection === "other" ? pronounsOther : pronounsSelection;

    onShareStory({
      name,
      pronouns: resolvedPronouns,
      hometown,
      country_code:
        selectedHometown?.countryCode ||
        initialValues?.hometownLocation?.countryCode ||
        null,
      story,
      share_text: shareText,
      graduation_year: normalizedGraduationYear,
    });
  };

  const storyWordCount = getWordCount(story);
  const shareTextWordCount = getWordCount(shareText);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => !isSaving && onClose()}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>{hasExistingProfile ? "Edit Profile" : "Create Profile"}</h2>
        <p className="coords">
          Your hometown pin will be placed automatically when you submit.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="name">
            Name <span className="required-mark">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError("");
            }}
            placeholder="Your name"
            required
          />

          <label htmlFor="pronouns">
            Pronouns <span className="required-mark">*</span>
          </label>
          <select
            id="pronouns"
            value={pronounsSelection}
            onChange={(event) => {
              setPronounsSelection(event.target.value);
              if (event.target.value !== "other") {
                setPronounsOther("");
              }
              if (error) setError("");
            }}
            required
          >
            <option value="">Select pronouns</option>
            {PRONOUN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {pronounsSelection === "other" && (
            <>
              <label htmlFor="pronounsOther">
                Your pronouns <span className="required-mark">*</span>
              </label>
              <input
                id="pronounsOther"
                type="text"
                value={pronounsOther}
                onChange={(event) => {
                  setPronounsOther(event.target.value);
                  if (error) setError("");
                }}
                placeholder="Write your pronouns"
                required
              />
            </>
          )}

          <label htmlFor="hometown">
            Hometown <span className="required-mark">*</span>
          </label>
          <input
            id="hometown"
            type="text"
            value={hometown}
            maxLength={HOMETOWN_MAX_LENGTH}
            onChange={(event) => {
              setHometown(event.target.value);
              setSelectedHometown(null);
              if (error) setError("");
            }}
            placeholder="Start typing city, state/country..."
            required
            autoComplete="off"
          />
          <p className="helper-text">
            Pick a suggested result for best map placement.
          </p>
          {isSearchingHometown && (
            <p className="helper-text">Searching locations...</p>
          )}
          {hometownSearchError && (
            <p className="form-error">{hometownSearchError}</p>
          )}
          {hometownSuggestions.length > 0 && (
            <div className="hometown-suggestions">
              {hometownSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="hometown-suggestion"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}

          <label htmlFor="story">Text Story (optional)</label>
          <textarea
            id="story"
            value={story}
            onChange={(event) => {
              setStory(event.target.value);
              if (error) setError("");
            }}
            placeholder="Share a short story..."
            rows={5}
          />
          <p className="char-count">
            {storyWordCount}/{STORY_MAX_WORDS} words
          </p>
          <p className="helper-text">Up to {STORY_MAX_WORDS} words.</p>

          <label htmlFor="shareText">Share Text (for card, optional)</label>
          <textarea
            id="shareText"
            value={shareText}
            onChange={(event) => {
              setShareText(
                limitToWordCount(event.target.value, SHARE_TEXT_MAX_WORDS),
              );
              if (error) setError("");
            }}
            placeholder="Write up to 100 words for your share card..."
            rows={3}
          />
          <p className="char-count">
            {shareTextWordCount}/{SHARE_TEXT_MAX_WORDS} words
          </p>
          <p className="helper-text">
            This text is used on your Share card. If empty, your Text Story is
            used.
          </p>

          <label htmlFor="graduationYear">
            Graduation Year <span className="required-mark">*</span>
          </label>
          <input
            id="graduationYear"
            type="number"
            min={GRAD_YEAR_MIN}
            max={GRAD_YEAR_MAX}
            value={graduationYear}
            onChange={(event) => {
              setGraduationYear(event.target.value);
              if (error) setError("");
            }}
            placeholder={`${GRAD_YEAR_MIN}-${GRAD_YEAR_MAX}`}
            required
          />

          <label>Social Media Profiles (optional)</label>
          <div className="social-links-builder">
            {socialLinks.length === 0 && (
              <p className="helper-text">
                No profiles added yet. Click Add Social Link.
              </p>
            )}

            {socialLinks.map((link, index) => (
              <div
                className="social-link-row"
                key={`${index}-${link.platform}`}
              >
                <select
                  value={link.platform}
                  onChange={(event) =>
                    handleSocialChange(index, "platform", event.target.value)
                  }
                  disabled={isSaving}
                >
                  <option value="">Choose platform</option>
                  {SOCIAL_PLATFORM_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={isPlatformTakenInOtherRow(option.value, index)}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={link.value}
                  onChange={(event) =>
                    handleSocialChange(index, "value", event.target.value)
                  }
                  placeholder="@handle or profile URL"
                  maxLength={SOCIAL_LINK_MAX_LENGTH}
                  disabled={isSaving}
                />

                <button
                  type="button"
                  className="btn-secondary social-link-remove"
                  onClick={() => handleRemoveSocial(index)}
                  disabled={isSaving}
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              className="btn-secondary social-link-add"
              onClick={handleAddSocialLink}
              disabled={isSaving || socialLinks.length >= SOCIAL_LINK_MAX_COUNT}
            >
              Add Social Link
            </button>
          </div>
          <p className="helper-text">{SOCIAL_HELPER_TEXT}</p>

          <label htmlFor="audio">Audio Story (optional)</label>
          <input
            id="audio"
            ref={audioInputRef}
            type="file"
            accept={AUDIO_ACCEPT_ATTR}
            onChange={handleAudioChange}
            disabled={isSaving}
          />
          <p className="helper-text">
            Record or upload a 1-minute cultural story.
          </p>
          <p className="helper-text">{AUDIO_HELPER_TEXT}</p>
          {hasSavedAudio && !audioFile && (
            <>
              <p className="file-meta">
                Current audio is saved. Upload a new file to replace it, or
                remove it.
              </p>
              {initialAudioUrl && (
                <audio
                  controls
                  src={initialAudioUrl}
                  style={{ width: "100%", margin: "0.35rem 0 0.45rem" }}
                />
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRemoveSavedAudio}
                disabled={isSaving}
                style={{ marginBottom: "0.45rem" }}
              >
                Remove current audio
              </button>
            </>
          )}
          {removeSavedAudio && !audioFile && (
            <>
              <p className="file-meta">
                Current audio will be removed when you save.
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRestoreSavedAudio}
                disabled={isSaving}
                style={{ marginBottom: "0.45rem" }}
              >
                Keep current audio
              </button>
            </>
          )}
          {audioFile && (
            <>
              <p className="file-meta">Selected: {audioFile.name}</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClearSelectedAudio}
                disabled={isSaving}
                style={{ marginBottom: "0.45rem" }}
              >
                Clear selected audio
              </button>
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            {onShareStory && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleShareMyStory}
                disabled={isSaving}
                style={{
                  marginRight: "auto",
                  border: "1px solid rgba(232, 115, 74, 0.38)",
                  color: "#c75c38",
                  background: "rgba(232, 115, 74, 0.12)",
                }}
              >
                Share my story
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving
                ? audioFile
                  ? "Uploading..."
                  : "Saving..."
                : hasExistingProfile
                  ? "Update Profile"
                  : "Create Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
