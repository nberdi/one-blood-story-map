const CARD_SIZE = 1080;
const FONT_STACK = "system-ui, -apple-system, sans-serif";

export const STORY_CARD_FILENAME = "my-one-blood-story.png";

function getSafeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function getShareTextOnly(shareText) {
  const safeShareText = getSafeText(shareText);
  return safeShareText;
}

function getFlagFromCountryCode(countryCode) {
  if (typeof countryCode !== "string") return "🌍";

  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "🌍";

  const firstRegionalCodePoint =
    0x1f1e6 + (normalized.charCodeAt(0) - "A".charCodeAt(0));
  const secondRegionalCodePoint =
    0x1f1e6 + (normalized.charCodeAt(1) - "A".charCodeAt(0));

  return String.fromCodePoint(firstRegionalCodePoint, secondRegionalCodePoint);
}

function getGraduationText(graduationYear) {
  const year = Number(graduationYear);
  if (Number.isInteger(year) && year > 0) return `Class of ${year}`;
  return "Class year not listed";
}

function drawGlobeIcon(ctx, centerX, centerY, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX - 9, centerY);
  ctx.lineTo(centerX + 9, centerY);
  ctx.moveTo(centerX, centerY - 9);
  ctx.lineTo(centerX, centerY + 9);
  ctx.moveTo(centerX - 5, centerY - 7);
  ctx.bezierCurveTo(
    centerX - 1,
    centerY - 2,
    centerX - 1,
    centerY + 2,
    centerX - 5,
    centerY + 7,
  );
  ctx.moveTo(centerX + 5, centerY - 7);
  ctx.bezierCurveTo(
    centerX + 1,
    centerY - 2,
    centerX + 1,
    centerY + 2,
    centerX + 5,
    centerY + 7,
  );
  ctx.stroke();

  ctx.restore();
}

function getWrappedLines(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text || "").split(/\n+/);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (!words.length) {
      lines.push("");
    } else {
      let currentLine = words[0];

      for (let i = 1; i < words.length; i += 1) {
        const candidateLine = `${currentLine} ${words[i]}`;
        if (ctx.measureText(candidateLine).width <= maxWidth) {
          currentLine = candidateLine;
        } else {
          lines.push(currentLine);
          currentLine = words[i];
        }
      }

      lines.push(currentLine);
    }

    if (paragraphIndex < paragraphs.length - 1) {
      lines.push("");
    }
  });

  return lines;
}

function fitTextToLineCount(ctx, text, maxWidth, maxLines) {
  const allLines = getWrappedLines(ctx, text, maxWidth);
  if (allLines.length <= maxLines) return allLines;

  const limitedLines = allLines.slice(0, maxLines);
  const lastLineIndex = maxLines - 1;
  let lastLine = limitedLines[lastLineIndex];

  while (lastLine && ctx.measureText(`${lastLine}...`).width > maxWidth) {
    const segments = lastLine.split(" ");
    if (segments.length > 1) {
      segments.pop();
      lastLine = segments.join(" ");
      continue;
    }
    lastLine = lastLine.slice(0, -1);
  }

  limitedLines[lastLineIndex] = `${lastLine || ""}...`;
  return limitedLines;
}

export async function generateStoryCard(story) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  const hidePronouns = Boolean(story?.share_hide_pronouns);
  const hideGraduation = Boolean(story?.share_hide_graduation);
  const name = getSafeText(story?.name, "Anonymous");
  const pronouns = hidePronouns
    ? ""
    : getSafeText(story?.pronouns, "Pronouns not listed");
  const hometown = getSafeText(story?.hometown, "Unknown hometown");
  const storyText = getShareTextOnly(story?.share_text);
  const graduationText = hideGraduation
    ? ""
    : getGraduationText(story?.graduation_year);
  const flag = getFlagFromCountryCode(story?.country_code);

  const backgroundGradient = ctx.createLinearGradient(0, 0, 0, CARD_SIZE);
  backgroundGradient.addColorStop(0, "#0F1B2D");
  backgroundGradient.addColorStop(1, "#1A2E4A");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  const glowGradient = ctx.createRadialGradient(540, 330, 18, 540, 330, 160);
  glowGradient.addColorStop(0, "rgba(232, 115, 74, 0.30)");
  glowGradient.addColorStop(1, "rgba(232, 115, 74, 0)");
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(540, 330, 160, 0, Math.PI * 2);
  ctx.fill();

  ctx.textBaseline = "top";

  ctx.textAlign = "left";
  ctx.font = `700 48px ${FONT_STACK}`;
  ctx.fillStyle = "#FFFFFF";
  const oneBloodText = "One Blood";
  ctx.fillText(oneBloodText, 72, 62);
  const oneBloodWidth = ctx.measureText(oneBloodText).width;
  ctx.fillStyle = "#E8734A";
  ctx.fillRect(72, 126, oneBloodWidth, 3);

  ctx.textAlign = "center";
  ctx.font = "120px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(flag, CARD_SIZE / 2, 244);

  ctx.font = `700 52px ${FONT_STACK}`;
  ctx.fillText(name, CARD_SIZE / 2, 392);

  if (pronouns) {
    ctx.font = `500 22px ${FONT_STACK}`;
    ctx.fillStyle = "#AABBCC";
    ctx.fillText(pronouns, CARD_SIZE / 2, 470);
  }

  ctx.font = `700 26px ${FONT_STACK}`;
  ctx.fillStyle = "#E8734A";
  ctx.fillText(hometown, CARD_SIZE / 2, pronouns ? 510 : 470);

  ctx.font = `400 24px ${FONT_STACK}`;
  ctx.fillStyle = "#FFFFFF";
  const storyMaxWidth = CARD_SIZE - 160;
  const storyLineHeight = 36;
  const storyTopY = 580;
  const storyBottomY = 940;
  const maxStoryLines = Math.floor(
    (storyBottomY - storyTopY) / storyLineHeight,
  );
  if (storyText) {
    const storyLines = fitTextToLineCount(
      ctx,
      storyText,
      storyMaxWidth,
      Math.max(maxStoryLines, 1),
    );
    storyLines.forEach((line, index) => {
      ctx.fillText(line, CARD_SIZE / 2, storyTopY + index * storyLineHeight);
    });
  }

  ctx.fillStyle = "#E8734A";
  ctx.fillRect(0, 960, CARD_SIZE, 2);

  ctx.textAlign = "left";
  ctx.font = `500 20px ${FONT_STACK}`;
  ctx.fillStyle = "#AABBCC";
  if (graduationText) {
    ctx.fillText(graduationText, 72, 988);
  }

  const footerText = "oneblood.berea.edu";
  ctx.textAlign = "right";
  ctx.fillText(footerText, CARD_SIZE - 72, 988);
  const footerWidth = ctx.measureText(footerText).width;
  drawGlobeIcon(ctx, CARD_SIZE - 72 - footerWidth - 20, 1001, "#AABBCC");

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => {
      if (!value) {
        reject(new Error("Could not generate PNG card."));
        return;
      }
      resolve(value);
    }, "image/png");
  });

  return blob;
}

export function downloadStoryCardBlob(blob, filename = STORY_CARD_FILENAME) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 0);
}
