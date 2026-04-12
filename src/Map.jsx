import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  getGraduationYearLabel,
  getHometownWithFlag,
  getSocialPlatformLabel,
  sanitizeAudioUrl,
} from "./storyUtils";

// Fixes missing default marker icons when using Leaflet with modern bundlers.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapClickHandler({ onMapBackgroundClick }) {
  useMapEvents({
    click: () => {
      if (onMapBackgroundClick) onMapBackgroundClick();
    },
  });

  return null;
}

function MapFocusController({ focusTarget, stories, markerRefs }) {
  const map = useMap();

  useEffect(() => {
    if (!focusTarget) return;

    const targetStory = stories.find(
      (story) => story.id === focusTarget.storyId,
    );
    if (!targetStory) return;

    map.flyTo(
      [targetStory.latitude, targetStory.longitude],
      Math.max(map.getZoom(), 4),
      {
        animate: true,
        duration: 0.7,
      },
    );

    const marker = markerRefs.current.get(targetStory.id);
    if (marker) marker.openPopup();
  }, [focusTarget, map, markerRefs, stories]);

  return null;
}

function getCoordinateKey(latitude, longitude) {
  const safeLatitude = Number(latitude);
  const safeLongitude = Number(longitude);
  return `${safeLatitude.toFixed(6)},${safeLongitude.toFixed(6)}`;
}

export default function StoryMap({
  stories,
  selectedStoryId,
  onMarkerSelect,
  onReadStory,
  onListenAudio,
  onShareStory,
  focusTarget,
  onMapBackgroundClick,
}) {
  const markerRefs = useRef(new globalThis.Map());
  const [groupCycleIndices, setGroupCycleIndices] = useState({});

  const storyGroups = useMemo(() => {
    const groupedStories = new globalThis.Map();

    stories.forEach((story) => {
      const groupKey = getCoordinateKey(story.latitude, story.longitude);
      const existingGroup = groupedStories.get(groupKey);

      if (existingGroup) {
        existingGroup.stories.push(story);
        return;
      }

      groupedStories.set(groupKey, {
        key: groupKey,
        latitude: story.latitude,
        longitude: story.longitude,
        stories: [story],
      });
    });

    return [...groupedStories.values()];
  }, [stories]);

  useEffect(() => {
    const activeGroupKeys = new Set(storyGroups.map((group) => group.key));

    setGroupCycleIndices((currentIndices) => {
      const nextIndices = {};
      let changed = false;

      Object.entries(currentIndices).forEach(([groupKey, groupIndex]) => {
        if (!activeGroupKeys.has(groupKey)) {
          changed = true;
          return;
        }
        nextIndices[groupKey] = groupIndex;
      });

      return changed ? nextIndices : currentIndices;
    });
  }, [storyGroups]);

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      className="map-root"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onMapBackgroundClick={onMapBackgroundClick} />
      <MapFocusController
        focusTarget={focusTarget}
        stories={stories}
        markerRefs={markerRefs}
      />

      {storyGroups.map((group) => {
        const selectedIndexInGroup = group.stories.findIndex(
          (story) => story.id === selectedStoryId,
        );
        const fallbackCycleIndex = groupCycleIndices[group.key];
        const activeIndex =
          selectedIndexInGroup >= 0
            ? selectedIndexInGroup
            : Number.isInteger(fallbackCycleIndex)
              ? Math.min(fallbackCycleIndex, group.stories.length - 1)
              : 0;
        const activeStory = group.stories[activeIndex] || group.stories[0];
        const hasTextStory = Boolean(activeStory.story?.trim());
        const safeAudioUrl = sanitizeAudioUrl(activeStory.audio_url);
        const graduationLabel = getGraduationYearLabel(
          activeStory.graduation_year,
        );
        const isSelected = group.stories.some(
          (story) => story.id === selectedStoryId,
        );

        return (
          <Marker
            key={group.key}
            position={[group.latitude, group.longitude]}
            zIndexOffset={isSelected ? 200 : 0}
            eventHandlers={{
              click: () => {
                const storedCycleIndex = groupCycleIndices[group.key];
                const hasStoredCycleIndex = Number.isInteger(storedCycleIndex);
                const baseIndex = hasStoredCycleIndex
                  ? storedCycleIndex
                  : selectedIndexInGroup >= 0
                    ? selectedIndexInGroup
                    : 0;
                const nextIndex = hasStoredCycleIndex
                  ? (baseIndex + 1) % group.stories.length
                  : 0;

                setGroupCycleIndices((currentIndices) => ({
                  ...currentIndices,
                  [group.key]: nextIndex,
                }));
                onMarkerSelect(group.stories[nextIndex]);
              },
            }}
            ref={(marker) => {
              if (!marker) {
                group.stories.forEach((storyItem) =>
                  markerRefs.current.delete(storyItem.id),
                );
                return;
              }
              group.stories.forEach((storyItem) => {
                markerRefs.current.set(storyItem.id, marker);
              });
            }}
          >
            <Popup>
              <div className="popup-card">
                <div className="popup-card__top">
                  <h3>{activeStory.name?.trim() || "Anonymous"}</h3>
                </div>
                {activeStory.pronouns && (
                  <p className="popup-card__date">{activeStory.pronouns}</p>
                )}

                <p className="popup-card__hometown">
                  {getHometownWithFlag(
                    activeStory.hometown,
                    activeStory.country_code,
                  )}
                </p>
                {graduationLabel && (
                  <p className="popup-card__date">{graduationLabel}</p>
                )}
                {group.stories.length > 1 && (
                  <p className="popup-card__date">
                    Story {activeIndex + 1} of {group.stories.length}
                  </p>
                )}

                {hasTextStory && onReadStory ? (
                  <button
                    type="button"
                    className="popup-card__read-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onReadStory(activeStory);
                    }}
                  >
                    Read the story
                  </button>
                ) : safeAudioUrl ? (
                  <p className="popup-card__story popup-card__story--muted">
                    Audio story only. Press play to listen.
                  </p>
                ) : (
                  <p className="popup-card__story popup-card__story--muted">
                    Profile added. No text or audio story yet.
                  </p>
                )}
                {safeAudioUrl && (
                  <button
                    type="button"
                    className="popup-card__listen-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (onListenAudio) onListenAudio(activeStory);
                    }}
                  >
                    Listen to audio
                  </button>
                )}
                {onShareStory && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onShareStory(activeStory);
                    }}
                    style={{
                      display: "block",
                      marginTop:
                        hasTextStory && onReadStory ? "0.82rem" : "0.55rem",
                      border: "none",
                      borderRadius: "999px",
                      padding: "0.28rem 0.62rem",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      background: "#E8734A",
                      color: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    Share
                  </button>
                )}

                {Array.isArray(activeStory.social_links) &&
                  activeStory.social_links.length > 0 && (
                    <div className="popup-card__social">
                      {activeStory.social_links.map((link, index) => (
                        <a
                          key={`${activeStory.id}-${link.platform}-${index}`}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {getSocialPlatformLabel(link.platform)}
                        </a>
                      ))}
                    </div>
                  )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
