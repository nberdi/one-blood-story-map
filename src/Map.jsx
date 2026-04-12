import { useEffect, useRef } from "react";
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

function MapReadyReporter({ onMapReady }) {
  const map = useMap();

  useEffect(() => {
    if (!onMapReady) return undefined;
    onMapReady(map);

    return () => {
      onMapReady(null);
    };
  }, [map, onMapReady]);

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

export default function StoryMap({
  stories,
  selectedStoryId,
  onMarkerSelect,
  onReadStory,
  onListenAudio,
  onShareStory,
  focusTarget,
  onMapReady,
  onMapBackgroundClick,
}) {
  const markerRefs = useRef(new globalThis.Map());

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

      <MapReadyReporter onMapReady={onMapReady} />
      <MapClickHandler onMapBackgroundClick={onMapBackgroundClick} />
      <MapFocusController
        focusTarget={focusTarget}
        stories={stories}
        markerRefs={markerRefs}
      />

      {stories.map((story) => {
        const hasTextStory = Boolean(story.story?.trim());
        const safeAudioUrl = sanitizeAudioUrl(story.audio_url);
        const graduationLabel = getGraduationYearLabel(story.graduation_year);
        const isSelected = selectedStoryId === story.id;

        return (
          <Marker
            key={story.id}
            position={[story.latitude, story.longitude]}
            zIndexOffset={isSelected ? 200 : 0}
            eventHandlers={{
              click: () => onMarkerSelect(story),
            }}
            ref={(marker) => {
              if (!marker) {
                markerRefs.current.delete(story.id);
                return;
              }
              markerRefs.current.set(story.id, marker);
            }}
          >
            <Popup>
              <div className="popup-card">
                <div className="popup-card__top">
                  <h3>{story.name?.trim() || "Anonymous"}</h3>
                </div>
                {story.pronouns && (
                  <p className="popup-card__date">{story.pronouns}</p>
                )}

                <p className="popup-card__hometown">
                  {getHometownWithFlag(story.hometown, story.country_code)}
                </p>
                {graduationLabel && (
                  <p className="popup-card__date">{graduationLabel}</p>
                )}

                {hasTextStory && onReadStory ? (
                  <button
                    type="button"
                    className="popup-card__read-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onReadStory(story);
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
                      if (onListenAudio) onListenAudio(story);
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
                      onShareStory(story);
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

                {Array.isArray(story.social_links) &&
                  story.social_links.length > 0 && (
                    <div className="popup-card__social">
                      {story.social_links.map((link, index) => (
                        <a
                          key={`${story.id}-${link.platform}-${index}`}
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
