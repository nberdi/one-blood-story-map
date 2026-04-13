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
  sanitizeImageUrl,
} from "./storyUtils";

const BEREA_COORDINATES = [37.5739, -84.2963];
const BEREA_STORY = {
  id: "berea-college-home-base",
  name: "Berea College",
  hometown: "Berea, KY, USA",
  country_code: "US",
  latitude: 37.5739,
  longitude: -84.2963,
  image_url: "/berea-college.jpg",
  share_hide_pronouns: true,
  share_hide_graduation: true,
  share_text:
    "Berea College is one of the most unique colleges in the U.S., mainly because every student receives a full tuition scholarship, meaning no one pays tuition. Founded in 1855, it was the first college in the South to be both coeducational and racially integrated. Another interesting fact is that all students are required to work on campus, gaining real job experience while studying. The college also focuses on students with financial need, making it highly selective. Despite its small size, Berea has a strong reputation for producing graduates with little to no debt and strong leadership skills.",
  story: `Berea College is a small private liberal arts college in Kentucky that stands out because of its mission and structure. It was founded in 1855 with a strong focus on equality and access to education, and it remains one of the few colleges in the United States where every admitted student receives a full tuition scholarship. The school is intentionally designed for students with financial need, which creates a community of highly motivated people from diverse backgrounds who are serious about making the most of their opportunity.

What really defines Berea is its work program. Every student works on campus while studying, usually around 10 hours a week, in roles that can range from academic support and IT to administration or crafts. This is not just about earning money; it is meant to build responsibility, real-world skills, and a sense of contribution to the community. Academically, Berea offers over 30 majors with small class sizes and close interaction with professors, which makes the learning environment more personal compared to larger universities.

Overall, Berea College is known for combining strong academics with a purpose-driven experience. Students graduate with little to no debt, practical work experience, and a mindset focused on service and leadership. While it may not have the scale or social scene of big universities, it offers something different: a tight-knit community and a clear mission centered on opportunity, equality, and growth.`,
};
const BEREA_PIN_ICON = L.icon({
  iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 46">
      <path fill="#d62828" d="M17 1C8.2 1 1 8.2 1 17c0 11.5 14.2 26.2 14.8 26.8a1.8 1.8 0 0 0 2.4 0C18.8 43.2 33 28.5 33 17 33 8.2 25.8 1 17 1z"/>
      <circle cx="17" cy="17" r="7.5" fill="#ffffff"/>
    </svg>`,
  )}`,
  shadowUrl: markerShadow,
  iconSize: [34, 46],
  iconAnchor: [17, 44],
  popupAnchor: [0, -36],
  shadowSize: [41, 41],
  shadowAnchor: [12, 40],
});

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

function BereaCollegeMarker({
  onReadStory,
  onViewImage,
  onShareStory,
  onPinDistanceSelect,
}) {
  const map = useMap();
  const bereaMarkerRef = useRef(null);
  const bereaImageUrl = sanitizeImageUrl(BEREA_STORY.image_url);

  return (
    <Marker
      position={BEREA_COORDINATES}
      icon={BEREA_PIN_ICON}
      zIndexOffset={350}
      ref={bereaMarkerRef}
      eventHandlers={{
        click: () => {
          map.flyTo(BEREA_COORDINATES, Math.max(map.getZoom(), 4), {
            animate: true,
            duration: 0.7,
          });
          if (onPinDistanceSelect) onPinDistanceSelect(BEREA_STORY);

          window.setTimeout(() => {
            if (bereaMarkerRef.current) bereaMarkerRef.current.openPopup();
          }, 0);
        },
      }}
    >
      <Popup>
        <div className="popup-card">
          <div className="popup-card__top">
            <h3>Berea College</h3>
          </div>
          <p className="popup-card__hometown">Berea, KY, USA 🇺🇸</p>
          {onReadStory && (
            <button
              type="button"
              className="popup-card__read-btn"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onReadStory(BEREA_STORY);
              }}
            >
              Read the story
            </button>
          )}
          {bereaImageUrl && onViewImage && (
            <button
              type="button"
              className="popup-card__image-btn"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onViewImage(BEREA_STORY);
              }}
            >
              See image
            </button>
          )}
          {onShareStory && (
            <button
              type="button"
              className="popup-card__share-btn"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onShareStory(BEREA_STORY);
              }}
            >
              Share
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function StoryMap({
  stories,
  selectedStoryId,
  onMarkerSelect,
  onReadStory,
  onListenAudio,
  onViewImage,
  onShareStory,
  onPinDistanceSelect,
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
      <BereaCollegeMarker
        onReadStory={onReadStory}
        onViewImage={onViewImage}
        onShareStory={onShareStory}
        onPinDistanceSelect={onPinDistanceSelect}
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
        const safeImageUrl = sanitizeImageUrl(activeStory.image_url);
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
                const nextStory = group.stories[nextIndex];
                onMarkerSelect(nextStory);
                if (onPinDistanceSelect) onPinDistanceSelect(nextStory);
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

                {hasTextStory && onReadStory && (
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
                {safeImageUrl && onViewImage && (
                  <button
                    type="button"
                    className="popup-card__image-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onViewImage(activeStory);
                    }}
                  >
                    See image
                  </button>
                )}
                {onShareStory && (
                  <button
                    type="button"
                    className="popup-card__share-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onShareStory(activeStory);
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
