import { useEffect, useMemo, useRef } from "react";
import {
  getGraduationYearLabel,
  getHometownWithFlag,
  getStoryPreview,
  getStoryTypeFromRecord,
  getStoryTypeLabel,
} from "./storyUtils";

export default function StorySidebar({
  stories,
  totalStoriesCount,
  selectedStoryId,
  searchQuery,
  hometownFilter,
  graduationYearFilter,
  graduationYearOptions,
  storyTypeFilter,
  sortBy,
  onSearchChange,
  onHometownFilterChange,
  onGraduationYearFilterChange,
  onStoryTypeFilterChange,
  onSortChange,
  onSelectStory,
  loading,
}) {
  const itemRefs = useRef(new Map());

  useEffect(() => {
    const selectedElement = itemRefs.current.get(selectedStoryId);
    if (!selectedElement) return;
    selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedStoryId]);

  const noStoriesYet = totalStoriesCount === 0;
  const hasNoMatches = totalStoriesCount > 0 && stories.length === 0;

  const sidebarMetaText = useMemo(() => {
    if (loading) return "Loading stories...";
    if (noStoriesYet) return "No stories yet.";
    if (hasNoMatches) return "No stories match your filters.";
    return `${stories.length} stories shown`;
  }, [loading, noStoriesYet, hasNoMatches, stories.length]);

  return (
    <aside className="story-sidebar">
      <div className="story-sidebar__header">
        <h2>Browse Stories</h2>
        <p>Search, filter, and jump to stories on the map.</p>
      </div>

      <div className="story-sidebar__filters">
        <label htmlFor="search">
          Search
          <input
            id="search"
            type="text"
            placeholder="Name, hometown, or story text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <label htmlFor="hometown-filter">
          Hometown Filter
          <input
            id="hometown-filter"
            type="text"
            placeholder="Filter hometown"
            value={hometownFilter}
            onChange={(event) => onHometownFilterChange(event.target.value)}
          />
        </label>

        <label htmlFor="type-filter">
          Story Type
          <select
            id="type-filter"
            value={storyTypeFilter}
            onChange={(event) => onStoryTypeFilterChange(event.target.value)}
          >
            <option value="all">All</option>
            <option value="text">Text</option>
            <option value="audio">Audio</option>
          </select>
        </label>

        <label htmlFor="graduation-year-filter">
          Graduation Year
          <select
            id="graduation-year-filter"
            value={graduationYearFilter}
            onChange={(event) =>
              onGraduationYearFilterChange(event.target.value)
            }
          >
            <option value="all">All years</option>
            {graduationYearOptions.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="sort">
          Sort
          <select
            id="sort"
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="hometown">Hometown A-Z</option>
          </select>
        </label>
      </div>

      <p className="story-sidebar__meta">{sidebarMetaText}</p>

      <div className="story-list" role="list">
        {noStoriesYet && !loading && (
          <div className="story-list__empty">
            <h3>No stories yet</h3>
            <p>Be the first to add a story by clicking Add Story.</p>
          </div>
        )}

        {hasNoMatches && !loading && (
          <div className="story-list__empty">
            <h3>No matching stories</h3>
            <p>Try clearing your search or changing the filters.</p>
          </div>
        )}

        {stories.map((story) => {
          const storyType = getStoryTypeFromRecord(story);
          const hasAudio = Boolean(story.audio_url);
          const preview = getStoryPreview(story.story, hasAudio);
          const graduationLabel = getGraduationYearLabel(story.graduation_year);
          const isSelected = selectedStoryId === story.id;

          return (
            <button
              key={story.id}
              type="button"
              className={`story-list__item ${isSelected ? "story-list__item--selected" : ""}`}
              onClick={() => onSelectStory(story)}
              ref={(element) => {
                if (!element) {
                  itemRefs.current.delete(story.id);
                  return;
                }
                itemRefs.current.set(story.id, element);
              }}
            >
              <div className="story-list__item-top">
                <h3>{story.name || "Anonymous"}</h3>
                <span className="story-badge">
                  {getStoryTypeLabel(storyType)}
                </span>
              </div>
              {story.pronouns && (
                <p className="story-list__pronouns">{story.pronouns}</p>
              )}

              <p className="story-list__hometown">
                {getHometownWithFlag(story.hometown, story.country_code)}
              </p>
              <p className="story-list__preview">{preview}</p>
              {graduationLabel && (
                <p className="story-list__class-year">{graduationLabel}</p>
              )}

              {hasAudio && (
                <div className="story-list__meta">
                  <span className="story-list__audio-flag">Audio</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
