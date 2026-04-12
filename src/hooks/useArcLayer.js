import { useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import "./useArcLayer.css";

const ARC_STROKE_COLOR = "rgba(232, 115, 74, 0.55)";
const ARC_STROKE_WIDTH = 1.5;
const INTERMEDIATE_POINTS = 50;
const DRAW_DURATION_MS = 600;
const DRAW_STAGGER_MS = 30;
const FADE_OUT_MS = 300;
const FULL_DRAW_PIN_LIMIT = 200;
const NEAREST_TARGET_LIMIT = 40;

function isValidStoryPoint(story) {
  if (!story || story.id === null || story.id === undefined) return false;
  const lat = Number(story.latitude);
  const lng = Number(story.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function sanitizeCountryCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function haversineKm(fromStory, toStory) {
  const lat1 = toRadians(Number(fromStory.latitude));
  const lat2 = toRadians(Number(toStory.latitude));
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(
    Number(toStory.longitude) - Number(fromStory.longitude),
  );

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function unwrapLongitudes(points) {
  if (!points.length) return points;

  const unwrapped = [{ ...points[0] }];
  let previousLng = points[0].lng;

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    let currentLng = point.lng;

    while (currentLng - previousLng > 180) currentLng -= 360;
    while (currentLng - previousLng < -180) currentLng += 360;

    unwrapped.push({ lat: point.lat, lng: currentLng });
    previousLng = currentLng;
  }

  return unwrapped;
}

function buildGreatCirclePoints(
  sourceStory,
  targetStory,
  intermediatePointCount = INTERMEDIATE_POINTS,
) {
  const lat1 = toRadians(Number(sourceStory.latitude));
  const lng1 = toRadians(Number(sourceStory.longitude));
  const lat2 = toRadians(Number(targetStory.latitude));
  const lng2 = toRadians(Number(targetStory.longitude));

  const x1 = Math.cos(lat1) * Math.cos(lng1);
  const y1 = Math.cos(lat1) * Math.sin(lng1);
  const z1 = Math.sin(lat1);

  const x2 = Math.cos(lat2) * Math.cos(lng2);
  const y2 = Math.cos(lat2) * Math.sin(lng2);
  const z2 = Math.sin(lat2);

  const dot = clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1);
  const delta = Math.acos(dot);

  if (delta === 0) {
    return [
      { lat: Number(sourceStory.latitude), lng: Number(sourceStory.longitude) },
      { lat: Number(targetStory.latitude), lng: Number(targetStory.longitude) },
    ];
  }

  const sinDelta = Math.sin(delta);
  const segmentCount = intermediatePointCount + 1;
  const points = [];

  for (let step = 0; step <= segmentCount; step += 1) {
    const fraction = step / segmentCount;
    const a = Math.sin((1 - fraction) * delta) / sinDelta;
    const b = Math.sin(fraction * delta) / sinDelta;

    const x = a * x1 + b * x2;
    const y = a * y1 + b * y2;
    const z = a * z1 + b * z2;

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lng = Math.atan2(y, x);

    points.push({ lat: toDegrees(lat), lng: toDegrees(lng) });
  }

  return unwrapLongitudes(points);
}

function getPathD(map, points) {
  return points
    .map((point, index) => {
      const projectedPoint = map.latLngToContainerPoint([point.lat, point.lng]);
      const command = index === 0 ? "M" : "L";
      return `${command} ${projectedPoint.x.toFixed(2)} ${projectedPoint.y.toFixed(2)}`;
    })
    .join(" ");
}

function findStoryById(stories, storyId) {
  return stories.find((story) => String(story.id) === String(storyId));
}

function getConnectedCountryCount(stories) {
  const countries = new Set();

  stories.forEach((story) => {
    const code = sanitizeCountryCode(story.country_code);
    if (code) countries.add(code);
  });

  return countries.size;
}

function getArcTargets(selectedStory, stories) {
  const others = stories.filter(
    (story) => String(story.id) !== String(selectedStory.id),
  );

  if (stories.length <= FULL_DRAW_PIN_LIMIT) {
    return { allOthers: others, drawTargets: others };
  }

  const nearestStories = [...others]
    .map((story) => ({ story, distance: haversineKm(selectedStory, story) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEAREST_TARGET_LIMIT)
    .map((entry) => entry.story);

  return { allOthers: others, drawTargets: nearestStories };
}

export function useArcLayer(map, stories) {
  const storiesRef = useRef(stories);
  const overlayRef = useRef(null);
  const selectedStoryIdRef = useRef(null);
  const fadeTimerRef = useRef(null);

  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  const ensureOverlay = useCallback(() => {
    if (!map) return null;
    if (overlayRef.current) return overlayRef.current;

    const overlayPane = map.getPanes().overlayPane;

    const root = L.DomUtil.create("div", "arc-layer-root", overlayPane);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "arc-layer-svg");
    root.appendChild(svg);

    const label = L.DomUtil.create("div", "arc-layer-label", root);

    overlayRef.current = {
      root,
      svg,
      label,
      active: null,
    };

    return overlayRef.current;
  }, [map]);

  const updateOverlayLayout = useCallback(() => {
    if (!map) return;
    const overlay = ensureOverlay();
    if (!overlay) return;

    const mapSize = map.getSize();
    overlay.root.style.width = `${mapSize.x}px`;
    overlay.root.style.height = `${mapSize.y}px`;

    overlay.svg.setAttribute("width", String(mapSize.x));
    overlay.svg.setAttribute("height", String(mapSize.y));
    overlay.svg.setAttribute("viewBox", `0 0 ${mapSize.x} ${mapSize.y}`);

    const paneOffset =
      typeof map._getMapPanePos === "function"
        ? map._getMapPanePos()
        : L.point(0, 0);
    overlay.root.style.transform = `translate(${-paneOffset.x}px, ${-paneOffset.y}px)`;
  }, [ensureOverlay, map]);

  const removeActiveLayer = useCallback((immediate = false) => {
    const overlay = overlayRef.current;
    if (!overlay || !overlay.active) return;

    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    const activeGroup = overlay.active.group;
    overlay.active = null;

    if (immediate) {
      activeGroup.remove();
      overlay.label.textContent = "";
      overlay.label.classList.remove(
        "arc-layer-label--visible",
        "arc-layer-label--fadeout",
      );
      return;
    }

    activeGroup.classList.add("arc-layer-group--fadeout");
    overlay.label.classList.add("arc-layer-label--fadeout");

    fadeTimerRef.current = window.setTimeout(() => {
      activeGroup.remove();

      const currentOverlay = overlayRef.current;
      if (currentOverlay) {
        currentOverlay.label.textContent = "";
        currentOverlay.label.classList.remove(
          "arc-layer-label--visible",
          "arc-layer-label--fadeout",
        );
      }

      fadeTimerRef.current = null;
    }, FADE_OUT_MS);
  }, []);

  const positionLabel = useCallback(
    (overlay, selectedStory, totalConnections, countryCount) => {
      if (!map || !overlay) return;

      const anchorPoint = map.latLngToContainerPoint([
        selectedStory.latitude,
        selectedStory.longitude,
      ]);
      overlay.label.textContent = `Connected to ${totalConnections} people across ${countryCount} countries`;
      overlay.label.style.left = `${anchorPoint.x}px`;
      overlay.label.style.top = `${anchorPoint.y + 34}px`;
      overlay.label.classList.remove("arc-layer-label--fadeout");
      overlay.label.classList.add("arc-layer-label--visible");
    },
    [map],
  );

  const drawForSelection = useCallback(
    (selectedStory, options = {}) => {
      const { animate = true } = options;

      if (!map || !isValidStoryPoint(selectedStory)) return;

      const overlay = ensureOverlay();
      if (!overlay) return;

      const visibleStories = (
        Array.isArray(storiesRef.current) ? storiesRef.current : []
      ).filter(isValidStoryPoint);
      const selectedFromVisible =
        findStoryById(visibleStories, selectedStory.id) ||
        (isValidStoryPoint(selectedStory) ? selectedStory : null);

      if (!selectedFromVisible) return;

      const { allOthers, drawTargets } = getArcTargets(
        selectedFromVisible,
        visibleStories,
      );

      updateOverlayLayout();
      removeActiveLayer(true);

      if (!drawTargets.length) {
        selectedStoryIdRef.current = selectedFromVisible.id;
        positionLabel(overlay, selectedFromVisible, 0, 0);
        return;
      }

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "arc-layer-group");

      const arcs = [];

      drawTargets.forEach((targetStory, index) => {
        const points = buildGreatCirclePoints(
          selectedFromVisible,
          targetStory,
          INTERMEDIATE_POINTS,
        );
        const pathElement = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );

        pathElement.setAttribute("class", "arc-layer-path");
        pathElement.setAttribute("fill", "none");
        pathElement.setAttribute("stroke", ARC_STROKE_COLOR);
        pathElement.setAttribute("stroke-width", String(ARC_STROKE_WIDTH));
        pathElement.setAttribute("stroke-linecap", "round");
        pathElement.setAttribute("d", getPathD(map, points));
        pathElement.dataset.targetId = String(targetStory.id);

        group.appendChild(pathElement);

        const length = Math.max(pathElement.getTotalLength(), 1);
        pathElement.style.strokeDasharray = `${length}`;

        if (animate) {
          pathElement.style.strokeDashoffset = `${length}`;
          pathElement.style.animationDuration = `${DRAW_DURATION_MS}ms`;
          pathElement.style.animationDelay = `${index * DRAW_STAGGER_MS}ms`;
          pathElement.classList.add("arc-layer-path--draw");
        } else {
          pathElement.style.strokeDashoffset = "0";
        }

        arcs.push({ targetId: String(targetStory.id), pathElement });
      });

      const sourcePoint = map.latLngToContainerPoint([
        Number(selectedFromVisible.latitude),
        Number(selectedFromVisible.longitude),
      ]);
      const originPulse = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      originPulse.setAttribute("class", "arc-layer-origin-pulse");
      originPulse.setAttribute("cx", sourcePoint.x.toFixed(2));
      originPulse.setAttribute("cy", sourcePoint.y.toFixed(2));
      originPulse.setAttribute("r", "5");
      group.appendChild(originPulse);

      overlay.svg.appendChild(group);

      const countryCount = getConnectedCountryCount(allOthers);
      positionLabel(
        overlay,
        selectedFromVisible,
        allOthers.length,
        countryCount,
      );

      overlay.active = {
        group,
        arcs,
        selectedStoryId: String(selectedFromVisible.id),
      };

      selectedStoryIdRef.current = String(selectedFromVisible.id);
    },
    [ensureOverlay, map, positionLabel, removeActiveLayer, updateOverlayLayout],
  );

  const redrawActiveGeometry = useCallback(() => {
    if (!map) return;

    const overlay = overlayRef.current;
    if (!overlay || !overlay.active) return;

    const visibleStories = (
      Array.isArray(storiesRef.current) ? storiesRef.current : []
    ).filter(isValidStoryPoint);
    const selectedStory = findStoryById(
      visibleStories,
      overlay.active.selectedStoryId,
    );

    if (!selectedStory) {
      selectedStoryIdRef.current = null;
      removeActiveLayer(true);
      return;
    }

    updateOverlayLayout();

    const storyById = new Map(
      visibleStories.map((story) => [String(story.id), story]),
    );

    overlay.active.arcs.forEach((arc) => {
      const targetStory = storyById.get(arc.targetId);
      if (!targetStory) {
        arc.pathElement.setAttribute("d", "");
        return;
      }

      const points = buildGreatCirclePoints(
        selectedStory,
        targetStory,
        INTERMEDIATE_POINTS,
      );
      arc.pathElement.setAttribute("d", getPathD(map, points));
    });

    const pulseElement = overlay.active.group.querySelector(
      ".arc-layer-origin-pulse",
    );
    if (pulseElement) {
      const sourcePoint = map.latLngToContainerPoint([
        selectedStory.latitude,
        selectedStory.longitude,
      ]);
      pulseElement.setAttribute("cx", sourcePoint.x.toFixed(2));
      pulseElement.setAttribute("cy", sourcePoint.y.toFixed(2));
    }

    const allOthers = visibleStories.filter(
      (story) => String(story.id) !== String(selectedStory.id),
    );
    const countryCount = getConnectedCountryCount(allOthers);
    positionLabel(overlay, selectedStory, allOthers.length, countryCount);
  }, [map, positionLabel, removeActiveLayer, updateOverlayLayout]);

  useEffect(() => {
    if (!map) return undefined;

    const handleMove = () => {
      redrawActiveGeometry();
    };

    map.on("move", handleMove);
    map.on("zoomend", handleMove);
    map.on("resize", handleMove);

    return () => {
      map.off("move", handleMove);
      map.off("zoomend", handleMove);
      map.off("resize", handleMove);
    };
  }, [map, redrawActiveGeometry]);

  useEffect(() => {
    if (!map) return;

    const selectedId = selectedStoryIdRef.current;
    if (!selectedId) return;

    const selectedStory = findStoryById(
      Array.isArray(stories) ? stories : [],
      selectedId,
    );
    if (!selectedStory) {
      selectedStoryIdRef.current = null;
      removeActiveLayer(true);
      return;
    }

    drawForSelection(selectedStory, { animate: false });
  }, [drawForSelection, map, removeActiveLayer, stories]);

  useEffect(
    () => () => {
      if (fadeTimerRef.current) {
        window.clearTimeout(fadeTimerRef.current);
      }

      if (overlayRef.current?.root) {
        overlayRef.current.root.remove();
      }

      overlayRef.current = null;
    },
    [],
  );

  const selectPin = useCallback(
    (story) => {
      if (!story || !isValidStoryPoint(story)) {
        selectedStoryIdRef.current = null;
        removeActiveLayer(false);
        return;
      }

      drawForSelection(story, { animate: true });
    },
    [drawForSelection, removeActiveLayer],
  );

  const clearArcs = useCallback(() => {
    selectedStoryIdRef.current = null;
    removeActiveLayer(false);
  }, [removeActiveLayer]);

  return { selectPin, clearArcs };
}
