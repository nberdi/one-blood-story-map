import { useEffect, useMemo, useRef } from "react";
import { getGraduationYearLabel, getHometownWithFlag } from "./storyUtils";

export default function StorySidebar({
  stories,
  totalStoriesCount,
  distanceHighlights,
  selectedStoryId,
  searchQuery,
  majorFilter,
  majorOptions,
  occupationFilter,
  occupationOptions,
  graduationYearFilter,
  graduationYearOptions,
  sortBy,
  onSearchChange,
  onMajorFilterChange,
  onOccupationFilterChange,
  onGraduationYearFilterChange,
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

  const distanceSummary = useMemo(() => {
    if (!distanceHighlights?.closest || !distanceHighlights?.farthest) {
      return null;
    }

    const formatDistance = (distanceKm) => {
      const km = Number(distanceKm) || 0;
      const miles = km * 0.621371;
      return `${km.toFixed(0)} km (${miles.toFixed(0)} mi)`;
    };

    return {
      closest: {
        name: distanceHighlights.closest.story?.name || "Anonymous",
        distance: formatDistance(distanceHighlights.closest.distanceKm),
      },
      farthest: {
        name: distanceHighlights.farthest.story?.name || "Anonymous",
        distance: formatDistance(distanceHighlights.farthest.distanceKm),
      },
    };
  }, [distanceHighlights]);

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
            placeholder="Name, hometown, major, occupation, or story text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <label htmlFor="major-filter">
          Major
          <select
            id="major-filter"
            value={majorFilter}
            onChange={(event) => onMajorFilterChange(event.target.value)}
          >
            <option value="">All majors</option>
            {majorOptions.map((majorOption) => (
              <option key={majorOption} value={majorOption}>
                {majorOption}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="occupation-filter">
          Occupation
          <select
            id="occupation-filter"
            value={occupationFilter}
            onChange={(event) => onOccupationFilterChange(event.target.value)}
          >
            <option value="">All occupations</option>
            {occupationOptions.map((occupationOption) => (
              <option key={occupationOption} value={occupationOption}>
                {occupationOption}
              </option>
            ))}
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
      {distanceSummary && (
        <div className="story-sidebar__distance">
          <p className="story-sidebar__distance-title">From Berea, KY</p>
          <p className="story-sidebar__distance-item">
            Closest: <strong>{distanceSummary.closest.name}</strong>{" "}
            <span>{distanceSummary.closest.distance}</span>
          </p>
          <p className="story-sidebar__distance-item">
            Farthest: <strong>{distanceSummary.farthest.name}</strong>{" "}
            <span>{distanceSummary.farthest.distance}</span>
          </p>
        </div>
      )}

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
              </div>
              {story.pronouns && (
                <p className="story-list__pronouns">{story.pronouns}</p>
              )}

              <p className="story-list__hometown">
                {getHometownWithFlag(story.hometown, story.country_code)}
              </p>
              {graduationLabel && (
                <p className="story-list__class-year">{graduationLabel}</p>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
