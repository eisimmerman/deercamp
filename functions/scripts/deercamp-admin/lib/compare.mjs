import { normalizeFirestoreValue } from "./serialization.mjs";

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function compareObjects(leftValue, rightValue) {
  const left = normalizeFirestoreValue(leftValue || {});
  const right = normalizeFirestoreValue(rightValue || {});

  const keys = Array.from(
    new Set([...Object.keys(left), ...Object.keys(right)])
  ).sort();

  const onlyLeft = [];
  const onlyRight = [];
  const changed = [];
  const matching = [];

  for (const key of keys) {
    const hasLeft = Object.prototype.hasOwnProperty.call(left, key);
    const hasRight = Object.prototype.hasOwnProperty.call(right, key);

    if (hasLeft && !hasRight) {
      onlyLeft.push(key);
      continue;
    }

    if (!hasLeft && hasRight) {
      onlyRight.push(key);
      continue;
    }

    if (stableStringify(left[key]) === stableStringify(right[key])) {
      matching.push(key);
    } else {
      changed.push({
        field: key,
        left: left[key],
        right: right[key]
      });
    }
  }

  return { onlyLeft, onlyRight, changed, matching };
}
