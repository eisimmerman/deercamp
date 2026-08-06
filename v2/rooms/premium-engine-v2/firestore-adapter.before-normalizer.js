(function () {
  "use strict";

  function firstNonEmpty(...values) {
    for (const value of values) {
      const clean = String(value || "").trim();

      if (clean) {
        return clean;
      }
    }

    return "";
  }

  function toMilliseconds(value) {
    if (!value) {
      return 0;
    }

    if (typeof value === "number") {
      return value;
    }

    if (
      value &&
      typeof value.toMillis === "function"
    ) {
      return value.toMillis();
    }

    if (
      value &&
      typeof value.seconds === "number"
    ) {
      return value.seconds * 1000;
    }

    const parsed = Date.parse(String(value));

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function formatTimestamp(value) {
    const milliseconds = toMilliseconds(value);

    if (!milliseconds) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat(
        undefined,
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }
      ).format(new Date(milliseconds));
    } catch (error) {
      return new Date(milliseconds).toLocaleString();
    }
  }

  function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(function (item) {
        return String(item || "").trim();
      })
      .filter(Boolean);
  }

  function normalizeComments(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(function (comment, index) {
        if (typeof comment === "string") {
          return {
            id: `comment-${index + 1}`,
            author: "DeerCamp Member",
            text: comment,
            timestamp: ""
          };
        }

        if (
          !comment ||
          typeof comment !== "object"
        ) {
          return null;
        }

        return {
          id: firstNonEmpty(
            comment.id,
            `comment-${index + 1}`
          ),
          author: firstNonEmpty(
            comment.authorName,
            comment.author,
            comment.memberName,
            "DeerCamp Member"
          ),
          text: firstNonEmpty(
            comment.text,
            comment.body,
            comment.comment
          ),
          timestamp: formatTimestamp(
            comment.createdAt ||
            comment.createdAtMs ||
            comment.timestamp
          )
        };
      })
      .filter(function (comment) {
        return comment && comment.text;
      });
  }

  function adaptFeedItem(id, data) {
    const source =
      data && typeof data === "object"
        ? data
        : {};

    const createdAt =
      source.createdAt ||
      source.createdAtMs ||
      source.clientCreatedAt;

    const title = firstNonEmpty(
      source.title,
      source.generatedTitle,
      "Field Memory"
    );

    const story = firstNonEmpty(
      source.transcript,
      source.body,
      source.caption,
      source.transcriptPreview,
      "This memory does not yet include a story."
    );

    const imageUrl = firstNonEmpty(
      source.imageUrl,
      source.displayUrl,
      source.thumbnailUrl,
      source.thumbUrl
    );

    const audioUrl = firstNonEmpty(
      source.audioUrl,
      source.voiceUrl
    );

    const author = firstNonEmpty(
      source.authorName,
      source.author,
      "DeerCamp Member"
    );

    const mediaType = firstNonEmpty(
      source.mediaType,
      source.type,
      audioUrl ? "photo-voice" : "photo"
    );

    const tags = normalizeStringArray(
      source.tags
    );

    const platform = firstNonEmpty(
      source.platform,
      source.devicePlatform,
      source.sourcePlatform
    );

    const details = [
      {
        label: "Media",
        value: mediaType
      },
      {
        label: "Captured",
        value: formatTimestamp(createdAt)
      },
      {
        label: "Platform",
        value: platform
      },
      {
        label: "Transcription",
        value: firstNonEmpty(
          source.transcriptionStatus,
          audioUrl ? "pending" : "not applicable"
        )
      }
    ].filter(function (item) {
      return item.value;
    });

    return {
      schema: "viewerItem.v2",
      id: String(id || source.id || "").trim(),
      campId: firstNonEmpty(source.campId),
      contentType: mediaType,
      title,
      subtitle: firstNonEmpty(
        source.category,
        "CampFeed Memory"
      ),
      author,
      room: firstNonEmpty(
        source.room,
        "CampFeed"
      ),
      timestamp: formatTimestamp(createdAt),
      createdAtMs: toMilliseconds(createdAt),

      heroImage: imageUrl
        ? {
            url: imageUrl,
            alt: firstNonEmpty(
              source.imageAlt,
              title
            )
          }
        : null,

      audio: audioUrl
        ? {
            url: audioUrl,
            durationMs: Number(
              source.audioDurationMs ||
              source.voiceDurationMs ||
              0
            ),
            contentType: firstNonEmpty(
              source.audioContentType,
              source.voiceContentType
            )
          }
        : null,

      story,
      transcript: firstNonEmpty(
        source.transcript,
        source.transcriptPreview
      ),

      comments: normalizeComments(
        source.comments
      ),

      tags,
      details,

      source: {
        collection: "feedItems",
        documentId: String(id || "").trim(),
        localMemoryId: firstNonEmpty(
          source.localMemoryId
        ),
        raw: source
      }
    };
  }

  window.DeerCampFirestoreAdapter = {
    adaptFeedItem,
    formatTimestamp,
    toMilliseconds
  };
})();
