(function () {
  "use strict";

  function cleanString(value) {
    return String(value == null ? "" : value).trim();
  }

  function firstNonEmpty() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];

      if (typeof value === "string") {
        const clean = value.trim();

        if (clean) {
          return clean;
        }
      }

      if (
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        return String(value);
      }
    }

    return "";
  }

  function readNested(source, path) {
    if (
      !source ||
      typeof source !== "object"
    ) {
      return undefined;
    }

    return String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce(function (value, key) {
        if (
          value &&
          typeof value === "object" &&
          Object.prototype.hasOwnProperty.call(value, key)
        ) {
          return value[key];
        }

        return undefined;
      }, source);
  }

  function firstValue(source, paths) {
    for (const path of paths) {
      const value = readNested(source, path);

      if (value !== undefined && value !== null) {
        if (
          typeof value !== "string" ||
          value.trim()
        ) {
          return value;
        }
      }
    }

    return undefined;
  }

  function extractUrl(value) {
    if (!value) {
      return "";
    }

    if (typeof value === "string") {
      return value.trim();
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = extractUrl(item);

        if (found) {
          return found;
        }
      }

      return "";
    }

    if (typeof value === "object") {
      return firstNonEmpty(
        value.url,
        value.downloadURL,
        value.downloadUrl,
        value.publicUrl,
        value.storageUrl,
        value.src,
        value.uri,
        value.href
      );
    }

    return "";
  }

  function firstUrl(source, paths) {
    for (const path of paths) {
      const found = extractUrl(
        readNested(source, path)
      );

      if (found) {
        return found;
      }
    }

    return "";
  }

  function toMilliseconds(value) {
    if (!value) {
      return 0;
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value < 100000000000
        ? value * 1000
        : value;
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

    if (value instanceof Date) {
      return value.getTime();
    }

    const parsed = Date.parse(
      String(value)
    );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  function formatTimestamp(value) {
    const milliseconds =
      toMilliseconds(value);

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
      ).format(
        new Date(milliseconds)
      );
    } catch (error) {
      return new Date(
        milliseconds
      ).toLocaleString();
    }
  }

  function normalizeTags(value) {
    const candidates = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,;|]/)
        : [];

    return Array.from(
      new Set(
        candidates
          .map(function (item) {
            if (
              item &&
              typeof item === "object"
            ) {
              return firstNonEmpty(
                item.label,
                item.name,
                item.value,
                item.title
              );
            }

            return cleanString(item);
          })
          .filter(Boolean)
      )
    );
  }

  function normalizeComments(value) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      value =
        value.items ||
        value.comments ||
        value.replies ||
        Object.values(value);
    }

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
            comment.commentId,
            comment.replyId,
            `comment-${index + 1}`
          ),

          author: firstNonEmpty(
            comment.authorName,
            comment.author,
            comment.displayName,
            comment.memberName,
            comment.userName,
            comment.email,
            "DeerCamp Member"
          ),

          text: firstNonEmpty(
            comment.text,
            comment.body,
            comment.comment,
            comment.message,
            comment.reply,
            comment.caption
          ),

          timestamp: formatTimestamp(
            comment.createdAt ||
            comment.createdAtMs ||
            comment.clientCreatedAt ||
            comment.timestamp ||
            comment.date
          ),

          audioUrl: firstNonEmpty(
            comment.audioUrl,
            comment.voiceUrl,
            comment.recordingUrl
          )
        };
      })
      .filter(function (comment) {
        return Boolean(
          comment &&
          (
            comment.text ||
            comment.audioUrl
          )
        );
      });
  }

  function getImageUrl(source) {
    return firstUrl(
      source,
      [
        "imageUrl",
        "photoUrl",
        "displayUrl",
        "mediaUrl",
        "downloadURL",
        "downloadUrl",
        "storageUrl",
        "publicUrl",
        "fullImageUrl",
        "originalUrl",
        "image",
        "photo",
        "media.image",
        "media.photo",
        "media.url",
        "attachment",
        "attachments",
        "images",
        "photos",
        "thumbnailUrl",
        "thumbUrl",
        "thumbnail"
      ]
    );
  }

  function getAudioUrl(source) {
    return firstUrl(
      source,
      [
        "audioUrl",
        "voiceUrl",
        "recordingUrl",
        "voiceRecordingUrl",
        "audioDownloadUrl",
        "voiceDownloadUrl",
        "storageAudioUrl",
        "media.audio",
        "media.voice",
        "audio",
        "voice",
        "recording",
        "audioSegments",
        "segments"
      ]
    );
  }

  function getStory(source) {
    return firstNonEmpty(
      source.transcript,
      source.story,
      source.memory,
      source.body,
      source.caption,
      source.details,
      source.description,
      source.text,
      source.note,
      source.notes,
      source.content,
      source.generatedCaption,
      source.transcriptPreview
    );
  }

  function getTitle(source, mediaType) {
    const explicit = firstNonEmpty(
      source.title,
      source.generatedTitle,
      source.memoryTitle,
      source.postTitle,
      source.headline,
      source.name
    );

    if (explicit) {
      return explicit;
    }

    const caption = firstNonEmpty(
      source.caption,
      source.description
    );

    if (
      caption &&
      caption.length <= 80
    ) {
      return caption;
    }

    return mediaType.includes("voice")
      ? "Field Memory"
      : "Field Photo";
  }

  function adaptFeedItem(id, data) {
    const source =
      data && typeof data === "object"
        ? data
        : {};

    const imageUrl =
      getImageUrl(source);

    const audioUrl =
      getAudioUrl(source);

    const declaredType =
      firstNonEmpty(
        source.mediaType,
        source.type,
        source.contentType,
        source.postType
      ).toLowerCase();

    const mediaType =
      declaredType ||
      (
        audioUrl
          ? imageUrl
            ? "photo-voice"
            : "voice"
          : imageUrl
            ? "photo"
            : "memory"
      );

    const createdAt =
      firstValue(
        source,
        [
          "createdAt",
          "createdAtMs",
          "clientCreatedAt",
          "publishedAt",
          "timestamp",
          "date",
          "capturedAt",
          "updatedAt"
        ]
      );

    const title =
      getTitle(source, mediaType);

    const story =
      getStory(source);

    const author =
      firstNonEmpty(
        source.authorName,
        source.author,
        source.displayName,
        source.memberName,
        source.userName,
        source.createdByName,
        source.email,
        source.authorEmail,
        "DeerCamp Member"
      );

    const room =
      firstNonEmpty(
        source.room,
        source.roomName,
        source.section,
        source.sourceRoom,
        "CampFeed"
      );

    const tags =
      normalizeTags(
        firstValue(
          source,
          [
            "tags",
            "labels",
            "keywords",
            "topics",
            "attributes"
          ]
        )
      );

    const comments =
      normalizeComments(
        firstValue(
          source,
          [
            "comments",
            "replies",
            "commentItems",
            "discussion.comments"
          ]
        )
      );

    const platform =
      firstNonEmpty(
        source.platform,
        source.devicePlatform,
        source.sourcePlatform,
        source.appPlatform,
        source.operatingSystem,
        readNested(source, "deviceInfo.platform"),
        readNested(source, "deviceInfo.os")
      );

    const transcriptionStatus =
      firstNonEmpty(
        source.transcriptionStatus,
        source.transcriptStatus,
        source.aiStatus
      );

    const durationMs = Number(
      source.audioDurationMs ||
      source.voiceDurationMs ||
      source.durationMs ||
      (
        Number(
          source.audioDurationSeconds ||
          source.voiceDurationSeconds ||
          source.durationSeconds ||
          0
        ) * 1000
      ) ||
      0
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
        value: transcriptionStatus
      }
    ].filter(function (item) {
      return Boolean(item.value);
    });

    return {
      schema: "viewerItem.v2",

      id: firstNonEmpty(
        id,
        source.id,
        source.feedId,
        source.memoryId,
        source.localMemoryId
      ),

      campId: firstNonEmpty(
        source.campId,
        source.campID,
        source.campKey
      ),

      contentType: mediaType,

      title,

      subtitle: firstNonEmpty(
        source.subtitle,
        source.categoryLabel,
        source.category,
        source.topic,
        source.typeLabel
      ),

      author,
      room,

      timestamp:
        formatTimestamp(createdAt),

      createdAtMs:
        toMilliseconds(createdAt),

      heroImage: imageUrl
        ? {
            url: imageUrl,
            alt: firstNonEmpty(
              source.imageAlt,
              source.photoAlt,
              title
            )
          }
        : null,

      audio: audioUrl
        ? {
            url: audioUrl,
            durationMs:
              Number.isFinite(durationMs)
                ? durationMs
                : 0,

            contentType: firstNonEmpty(
              source.audioContentType,
              source.voiceContentType,
              source.mimeType,
              readNested(source, "audio.contentType")
            )
          }
        : null,

      story:
        story ||
        "This memory does not yet include a written story.",

      transcript: firstNonEmpty(
        source.transcript,
        source.transcriptText,
        source.transcriptPreview
      ),

      comments,
      tags,
      details,

      source: {
        collection: "feedItems",
        documentId: cleanString(id),

        localMemoryId:
          firstNonEmpty(
            source.localMemoryId,
            source.memoryId
          ),

        selectedFields: {
          imageUrl,
          audioUrl,
          hasStory: Boolean(story),
          mediaType
        },

        raw: source
      }
    };
  }

  window.DeerCampFirestoreAdapter = {
    adaptFeedItem,
    formatTimestamp,
    toMilliseconds,
    getImageUrl,
    getAudioUrl,
    getStory
  };
})();
